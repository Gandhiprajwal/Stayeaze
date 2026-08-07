import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_session.dart';

const String apiBaseUrl = 'http://127.0.0.1:8080/api/v1';

class ApiService {
  // SharedPreferences Keys
  static const String keyToken = 'se_token';
  static const String keyUsername = 'se_username';
  static const String keyRole = 'se_role';
  static const String keyOrgId = 'se_org_id';
  
  static const String cacheProperties = 'cache_properties';
  static const String cacheTenants = 'cache_tenants';
  static const String cacheIncidents = 'cache_incidents';

  static Map<String, String> _getHeaders(String? token) {
    final headers = {'Content-Type': 'application/json'};
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  // Session Management
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
      return UserSession(
        token: token,
        username: username,
        role: role,
        orgId: orgId,
      );
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
  }

  // Local Cache Helpers
  static Future<void> setCache(String key, String jsonValue) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, jsonValue);
  }

  static Future<String?> getCache(String key) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(key);
  }

  // Auth APIs
  static Future<http.Response> login(String email, String password) async {
    return http.post(
      Uri.parse('$apiBaseUrl/auth/login'),
      headers: _getHeaders(null),
      body: jsonEncode({'email': email, 'password': password}),
    );
  }

  // Properties API with Caching
  static Future<List<dynamic>> getProperties(String token, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cachedData = await getCache(cacheProperties);
      if (cachedData != null) {
        // Return cached list immediately in background-refresh pattern
        return jsonDecode(cachedData) as List;
      }
    }

    final response = await http.get(
      Uri.parse('$apiBaseUrl/properties'),
      headers: _getHeaders(token),
    );

    if (response.statusCode == 200) {
      await setCache(cacheProperties, response.body);
      return jsonDecode(response.body) as List;
    }
    throw Exception('Failed to load properties');
  }

  // Tenants API with Caching
  static Future<List<dynamic>> getTenants(String token, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cachedData = await getCache(cacheTenants);
      if (cachedData != null) {
        return jsonDecode(cachedData) as List;
      }
    }

    final response = await http.get(
      Uri.parse('$apiBaseUrl/tenants'),
      headers: _getHeaders(token),
    );

    if (response.statusCode == 200) {
      await setCache(cacheTenants, response.body);
      return jsonDecode(response.body) as List;
    }
    throw Exception('Failed to load tenants');
  }

  // Safety Incidents API with Caching
  static Future<List<dynamic>> getSafetyIncidents(String token, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cachedData = await getCache(cacheIncidents);
      if (cachedData != null) {
        return jsonDecode(cachedData) as List;
      }
    }

    final response = await http.get(
      Uri.parse('$apiBaseUrl/safety-incidents'),
      headers: _getHeaders(token),
    );

    if (response.statusCode == 200) {
      await setCache(cacheIncidents, response.body);
      return jsonDecode(response.body) as List;
    }
    throw Exception('Failed to load safety incidents');
  }
}
