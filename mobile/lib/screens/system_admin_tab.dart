import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import 'main_screens.dart';

class SystemAdminTab extends StatefulWidget {
  final UserSession session;
  const SystemAdminTab({super.key, required this.session});

  @override
  State<SystemAdminTab> createState() => _SystemAdminTabState();
}

class _SystemAdminTabState extends State<SystemAdminTab> {
  Map<String, dynamic>? _metrics;
  bool _loading = true;

  bool _redisEnabled = false;
  bool _awsEnabled = false;
  bool _twilioEnabled = false;
  bool _smtpEnabled = false;
  bool _razorpayEnabled = false;
  bool _rateLimitsEnabled = false;

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final integrations = await ApiService.getSystemIntegrations(widget.session.token);
      final metrics = await ApiService.getSystemMetrics(widget.session.token);
      if (mounted) {
        setState(() {
          _metrics = metrics;
          if (integrations != null) {
            _redisEnabled = integrations['redis']?['enabled'] == true;
            _awsEnabled = integrations['awsS3']?['enabled'] == true;
            _twilioEnabled = integrations['twilio']?['enabled'] == true;
            _smtpEnabled = integrations['smtp']?['enabled'] == true;
            _razorpayEnabled = integrations['razorpay']?['enabled'] == true;
            _rateLimitsEnabled = integrations['rateLimiting']?['enabled'] == true;
          }
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _saveIntegrations() async {
    try {
      await ApiService.updateSystemIntegrations(widget.session.token, {
        'redis': {'enabled': _redisEnabled},
        'awsS3': {'enabled': _awsEnabled},
        'twilio': {'enabled': _twilioEnabled},
        'smtp': {'enabled': _smtpEnabled},
        'razorpay': {'enabled': _razorpayEnabled},
        'rateLimiting': {'enabled': _rateLimitsEnabled},
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('System integrations updated successfully!')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error saving: $e')));
    }
  }

  Widget _integrationCard({
    required String name,
    required String description,
    required IconData icon,
    required Color color,
    required bool enabled,
    required ValueChanged<bool> onToggle,
    String? statusFromMetrics,
  }) {
    final isConnected = statusFromMetrics?.toLowerCase() == 'connected' || statusFromMetrics?.toLowerCase() == 'up';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: enabled ? color.withValues(alpha: 0.3) : const Color(0xFFE2E8F0)),
        boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
      ),
      child: Row(children: [
        Container(
          width: 46, height: 46,
          decoration: BoxDecoration(
            color: enabled ? color.withValues(alpha: 0.12) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: enabled ? color : const Color(0xFF94A3B8), size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(name, style: TextStyle(color: enabled ? const Color(0xFF0F172A) : const Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 15)),
              if (statusFromMetrics != null) ...[
                const SizedBox(width: 8),
                Container(
                  width: 8, height: 8,
                  decoration: BoxDecoration(
                    color: isConnected ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ]),
            const SizedBox(height: 2),
            Text(description, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
          ]),
        ),
        Switch(
          value: enabled,
          onChanged: onToggle,
          activeThumbColor: color,
          activeTrackColor: color.withValues(alpha: 0.3),
        ),
      ]),
    );
  }

  String? _getServiceStatus(String key) {
    final services = _metrics?['services'];
    if (services == null) return null;
    final statusObj = services[key];
    if (statusObj is String) return statusObj;
    if (statusObj is Map) return statusObj['status']?.toString();
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: const ModernAppBarWidget(
        title: 'System Admin',
        icon: Icons.admin_panel_settings_rounded,
        color: Color(0xFF4F46E5),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  // Health Header
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF3730A3)]),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: const [BoxShadow(color: Color(0x334F46E5), blurRadius: 16, offset: Offset(0, 8))],
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Row(children: [
                        Icon(Icons.shield_rounded, color: Colors.white, size: 24),
                        SizedBox(width: 10),
                        Text('Infrastructure Status', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17)),
                      ]),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _metricBadge('Redis', _getServiceStatus('redis')),
                          _metricBadge('Database', _getServiceStatus('database')),
                          _metricBadge('AWS S3', _getServiceStatus('awsS3')),
                          _metricBadge('Twilio', _getServiceStatus('twilio')),
                          _metricBadge('Razorpay', _getServiceStatus('razorpay')),
                        ],
                      ),
                    ]),
                  ),
                  const SizedBox(height: 20),

                  const Text('Cloud Service Integrations', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 4),
                  const Text('Enable or disable cloud gateway services in real time', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                  const SizedBox(height: 14),

                  _integrationCard(
                    name: 'Redis Cache L2',
                    description: 'Distributed caching for performance',
                    icon: Icons.memory_rounded,
                    color: const Color(0xFFDC2626),
                    enabled: _redisEnabled,
                    statusFromMetrics: _getServiceStatus('redis'),
                    onToggle: (v) => setState(() => _redisEnabled = v),
                  ),
                  _integrationCard(
                    name: 'AWS S3 Storage',
                    description: 'Cloud file & document storage',
                    icon: Icons.cloud_rounded,
                    color: const Color(0xFFD97706),
                    enabled: _awsEnabled,
                    statusFromMetrics: _getServiceStatus('awsS3'),
                    onToggle: (v) => setState(() => _awsEnabled = v),
                  ),
                  _integrationCard(
                    name: 'Twilio SMS Gateway',
                    description: 'SMS notifications & OTP delivery',
                    icon: Icons.sms_rounded,
                    color: const Color(0xFF059669),
                    enabled: _twilioEnabled,
                    statusFromMetrics: _getServiceStatus('twilio'),
                    onToggle: (v) => setState(() => _twilioEnabled = v),
                  ),
                  _integrationCard(
                    name: 'SMTP Email Server',
                    description: 'Email notifications & invoices',
                    icon: Icons.email_rounded,
                    color: const Color(0xFF0891B2),
                    enabled: _smtpEnabled,
                    onToggle: (v) => setState(() => _smtpEnabled = v),
                  ),
                  _integrationCard(
                    name: 'Razorpay Payments',
                    description: 'Online payment gateway (UPI, Cards)',
                    icon: Icons.payments_rounded,
                    color: const Color(0xFF4F46E5),
                    enabled: _razorpayEnabled,
                    statusFromMetrics: _getServiceStatus('razorpay'),
                    onToggle: (v) => setState(() => _razorpayEnabled = v),
                  ),
                  _integrationCard(
                    name: 'API Rate Limiting',
                    description: 'Throttle requests for security',
                    icon: Icons.speed_rounded,
                    color: const Color(0xFF7C3AED),
                    enabled: _rateLimitsEnabled,
                    onToggle: (v) => setState(() => _rateLimitsEnabled = v),
                  ),

                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.save_rounded, color: Colors.white),
                      label: const Text('Save Integration Settings', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4F46E5),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: _saveIntegrations,
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _metricBadge(String name, String? status) {
    final isUp = status?.toLowerCase() == 'connected' || status?.toLowerCase() == 'up';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white12,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 6, height: 6,
          decoration: BoxDecoration(
            color: status == null ? Colors.white54 : (isUp ? Colors.greenAccent : Colors.redAccent),
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(name, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
      ]),
    );
  }
}
