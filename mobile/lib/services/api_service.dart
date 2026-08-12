import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_session.dart';

String get apiBaseUrl {
  if (kIsWeb) {
    return 'http://127.0.0.1:8080/api/v1';
  }
  try {
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:8080/api/v1';
    }
  } catch (_) {}
  return 'http://127.0.0.1:8080/api/v1';
}


class ApiService {
  // SharedPreferences Keys
  static const String keyToken = 'se_token';
  static const String keyUsername = 'se_username';
  static const String keyRole = 'se_role';
  static const String keyOrgId = 'se_org_id';
  static const String keyCustomHost = 'se_custom_host';

  // Cache Keys
  static const String cacheProperties = 'cache_properties';
  static const String cacheTenants = 'cache_tenants';
  static const String cacheIncidents = 'cache_incidents';
  static const String cacheInvoices = 'cache_invoices';
  static const String cacheComplaints = 'cache_complaints';
  static const String cacheUsers = 'cache_users';
  static const String cacheBookings = 'cache_bookings';
  static const String cachePayments = 'cache_payments';
  static const String cacheMaintenance = 'cache_maintenance';
  static const String cacheVisitors = 'cache_visitors';
  static const String cacheAuditLogs = 'cache_audit_logs';

  static Map<String, String> _getHeaders(String? token) {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  // ─── Session Management ───────────────────────────────────────────────────

  static Future<void> saveSession(UserSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyToken, session.token);
    await prefs.setString(keyUsername, session.username);
    await prefs.setString(keyRole, session.role);
    await prefs.setString(keyOrgId, session.orgId);
  }

  static Future<UserSession?> getSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(keyToken);
    final username = prefs.getString(keyUsername);
    final role = prefs.getString(keyRole);
    final orgId = prefs.getString(keyOrgId);

    if (token != null && username != null && role != null && orgId != null) {
      return UserSession(token: token, username: username, role: role, orgId: orgId);
    }
    return null;
  }

  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(keyToken);
    await prefs.remove(keyUsername);
    await prefs.remove(keyRole);
    await prefs.remove(keyOrgId);
    await prefs.remove(cacheProperties);
    await prefs.remove(cacheTenants);
    await prefs.remove(cacheIncidents);
    await prefs.remove(cacheInvoices);
    await prefs.remove(cacheComplaints);
    await prefs.remove(cacheUsers);
    await prefs.remove(cacheBookings);
    await prefs.remove(cachePayments);
    await prefs.remove(cacheMaintenance);
    await prefs.remove(cacheVisitors);
    await prefs.remove(cacheAuditLogs);
  }

  // ─── Cache Helpers ────────────────────────────────────────────────────────

  static Future<void> setCache(String key, String jsonValue) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, jsonValue);
  }

  static Future<String?> getCache(String key) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(key);
  }

  // ─── Host Resolution ──────────────────────────────────────────────────────

  static Future<String> getActiveBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final customHost = prefs.getString(keyCustomHost);
    if (customHost != null && customHost.isNotEmpty) {
      return customHost.endsWith('/api/v1') ? customHost : 'http://$customHost/api/v1';
    }
    return apiBaseUrl;
  }

  static Future<void> setCustomHost(String host) async {
    final prefs = await SharedPreferences.getInstance();
    String formatted = host.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'http://$formatted';
    }
    if (!formatted.endsWith('/api/v1')) {
      formatted = '$formatted/api/v1';
    }
    await prefs.setString(keyCustomHost, formatted);
  }

  static List<String> getCandidateBaseUrls() {
    return [
      'http://10.0.2.2:8080/api/v1',
      'http://192.168.1.6:8080/api/v1',
      'http://127.0.0.1:8080/api/v1',
      'http://localhost:8080/api/v1',
    ];
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  static Future<http.Response> login(String email, String password) async {
    final activeUrl = await getActiveBaseUrl();
    final candidateUrls = <String>{activeUrl, ...getCandidateBaseUrls()}.toList();

    Object? lastError;
    for (final baseUrl in candidateUrls) {
      try {
        final res = await http.post(
          Uri.parse('$baseUrl/auth/login'),
          headers: _getHeaders(null),
          body: jsonEncode({'email': email, 'password': password}),
        ).timeout(const Duration(seconds: 4));

        if (res.statusCode == 200 || res.statusCode == 401 || res.statusCode == 400) {
          await setCustomHost(baseUrl);
          return res;
        }
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError ?? Exception('Connection refused across all backend hosts');
  }

  // ─── Response Parser ──────────────────────────────────────────────────────

  static List<dynamic> _parseList(String jsonString) {
    try {
      final decoded = jsonDecode(jsonString);
      if (decoded is List) return decoded;
      if (decoded is Map<String, dynamic>) {
        if (decoded['data'] is List) return decoded['data'] as List;
        if (decoded['content'] is List) return decoded['content'] as List;
        if (decoded['items'] is List) return decoded['items'] as List;
      }
    } catch (_) {}
    return [];
  }

  // ─── Generic GET with Cache ───────────────────────────────────────────────

  static Future<List<dynamic>> _cachedGet(
    String token,
    String endpoint,
    String cacheKey, {
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh) {
      final cached = await getCache(cacheKey);
      if (cached != null) return _parseList(cached);
    }
    final baseUrl = await getActiveBaseUrl();
    try {
      final response = await http.get(
        Uri.parse('$baseUrl$endpoint'),
        headers: _getHeaders(token),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        await setCache(cacheKey, response.body);
        return _parseList(response.body);
      }
    } catch (_) {}
    return [];
  }

  // ─── Properties ───────────────────────────────────────────────────────────

  static Future<List<dynamic>> getProperties(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/properties', cacheProperties, forceRefresh: forceRefresh);

  static Future<http.Response> createProperty(String token, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.post(Uri.parse('$baseUrl/properties'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  // ─── Tenants ──────────────────────────────────────────────────────────────

  static Future<List<dynamic>> getTenants(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/tenants', cacheTenants, forceRefresh: forceRefresh);

  static Future<http.Response> createTenant(String token, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.post(Uri.parse('$baseUrl/tenants'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  // ─── Invoices ─────────────────────────────────────────────────────────────

  static Future<List<dynamic>> getInvoices(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/invoices', cacheInvoices, forceRefresh: forceRefresh);

  static Future<http.Response> createInvoice(String token, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.post(Uri.parse('$baseUrl/invoices'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  // ─── Complaints ───────────────────────────────────────────────────────────

  static Future<List<dynamic>> getComplaints(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/complaints', cacheComplaints, forceRefresh: forceRefresh);

  static Future<http.Response> createComplaint(String token, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.post(Uri.parse('$baseUrl/complaints'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  static Future<List<dynamic>> getUsers(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/users', cacheUsers, forceRefresh: forceRefresh);

  static Future<http.Response> createUser(String token, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.post(Uri.parse('$baseUrl/users'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  // ─── Beds ─────────────────────────────────────────────────────────────────

  static Future<List<dynamic>> getBeds(String token) =>
      _cachedGet(token, '/beds', 'cache_beds');

  // ─── Bookings ─────────────────────────────────────────────────────────────

  static Future<List<dynamic>> getBookings(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/bookings', cacheBookings, forceRefresh: forceRefresh);

  static Future<http.Response> createBooking(String token, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.post(Uri.parse('$baseUrl/bookings'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  static Future<http.Response> updateBooking(String token, String id, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.put(Uri.parse('$baseUrl/bookings/$id'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  static Future<http.Response> deleteBooking(String token, String id) async {
    final baseUrl = await getActiveBaseUrl();
    return http.delete(Uri.parse('$baseUrl/bookings/$id'), headers: _getHeaders(token));
  }

  // ─── Payments ─────────────────────────────────────────────────────────────

  static Future<List<dynamic>> getPayments(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/payments', cachePayments, forceRefresh: forceRefresh);

  static Future<http.Response> createPayment(String token, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.post(Uri.parse('$baseUrl/payments'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  // ─── Maintenance Requests ─────────────────────────────────────────────────

  static Future<List<dynamic>> getMaintenanceRequests(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/maintenance-requests', cacheMaintenance, forceRefresh: forceRefresh);

  static Future<http.Response> createMaintenanceRequest(String token, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.post(Uri.parse('$baseUrl/maintenance-requests'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  static Future<http.Response> updateMaintenanceRequest(String token, String id, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.put(Uri.parse('$baseUrl/maintenance-requests/$id'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  // ─── Visitors ─────────────────────────────────────────────────────────────

  static Future<List<dynamic>> getVisitors(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/visitors', cacheVisitors, forceRefresh: forceRefresh);

  static Future<http.Response> createVisitor(String token, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.post(Uri.parse('$baseUrl/visitors'), headers: _getHeaders(token), body: jsonEncode(body));
  }

  // ─── Audit Logs ───────────────────────────────────────────────────────────

  static Future<List<dynamic>> getAuditLogs(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/audit-logs', cacheAuditLogs, forceRefresh: forceRefresh);

  // ─── Reports / Summary ────────────────────────────────────────────────────

  static Future<Map<String, dynamic>?> getReportsSummary(String token) async {
    try {
      final baseUrl = await getActiveBaseUrl();
      final response = await http.get(
        Uri.parse('$baseUrl/reports/summary'),
        headers: _getHeaders(token),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) return decoded;
      }
    } catch (_) {}
    return null;
  }

  // ─── System Integrations ─────────────────────────────────────────────────

  static Future<Map<String, dynamic>?> getSystemIntegrations(String token) async {
    try {
      final baseUrl = await getActiveBaseUrl();
      final response = await http.get(
        Uri.parse('$baseUrl/system/integrations'),
        headers: _getHeaders(token),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) return decoded;
      }
    } catch (_) {}
    return null;
  }

  static Future<http.Response> updateSystemIntegrations(String token, Map<String, dynamic> body) async {
    final baseUrl = await getActiveBaseUrl();
    return http.put(
      Uri.parse('$baseUrl/system/integrations'),
      headers: _getHeaders(token),
      body: jsonEncode(body),
    );
  }

  // ─── System Metrics ───────────────────────────────────────────────────────

  static Future<Map<String, dynamic>?> getSystemMetrics(String token) async {
    try {
      final baseUrl = await getActiveBaseUrl();
      final response = await http.get(
        Uri.parse('$baseUrl/system/metrics'),
        headers: _getHeaders(token),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) return decoded;
      }
    } catch (_) {}
    return null;
  }

  // ─── Safety Incidents (legacy) ────────────────────────────────────────────

  static Future<List<dynamic>> getSafetyIncidents(String token, {bool forceRefresh = false}) =>
      _cachedGet(token, '/safety-incidents', cacheIncidents, forceRefresh: forceRefresh);
}
