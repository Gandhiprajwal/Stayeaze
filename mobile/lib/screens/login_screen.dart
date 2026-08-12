import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String _errorMessage = '';

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final navigator = Navigator.of(context);

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final response = await ApiService.login(
        _emailController.text.trim(),
        _passwordController.text,
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        final session = UserSession(
          token: data['accessToken'] ?? '',
          username: data['username'] ?? data['email'] ?? '',
          role: (data['roles'] != null && (data['roles'] as List).isNotEmpty) ? data['roles'][0] : 'USER',
          orgId: data['orgId'] ?? '',
        );

        await ApiService.saveSession(session);

        navigator.pushReplacement(
          MaterialPageRoute(
            builder: (context) => DashboardScreen(session: session),
          ),
        );
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Authentication failed.';
        });
      }
    } catch (e) {
      debugPrint('Connection Error exception details: $e');
      final activeHost = await ApiService.getActiveBaseUrl();
      setState(() {
        _errorMessage = 'Unable to reach backend ($activeHost). Tap ⚙️ top-right to configure host IP (e.g. 10.0.2.2:8080 or 192.168.1.6:8080).';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _showServerConfigDialog() async {
    final currentUrl = await ApiService.getActiveBaseUrl();
    final controller = TextEditingController(text: currentUrl.replaceAll('http://', '').replaceAll('/api/v1', ''));
    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Row(
          children: [
            Icon(Icons.dns_rounded, color: Color(0xFF4F46E5)),
            SizedBox(width: 10),
            Text('Server Connection IP', style: TextStyle(color: Color(0xFF0F172A), fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Specify host PC IP & port (e.g. 192.168.1.6:8080 or 10.0.2.2:8080):',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
              decoration: const InputDecoration(
                hintText: '192.168.1.6:8080 or 10.0.2.2:8080',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF4F46E5)),
            onPressed: () async {
              if (controller.text.trim().isNotEmpty) {
                await ApiService.setCustomHost(controller.text.trim());
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('API Host updated to ${controller.text.trim()}')),
                );
              }
              if (!ctx.mounted) return;
              Navigator.pop(ctx);
            },
            child: const Text('Save Host', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_ethernet_rounded, color: Color(0xFF4F46E5)),
            tooltip: 'Configure Backend Server IP',
            onPressed: _showServerConfigDialog,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF4F46E5), Color(0xFF3730A3)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Color(0x334F46E5),
                            blurRadius: 20,
                            spreadRadius: 2,
                            offset: Offset(0, 8),
                          )
                        ],
                      ),
                      child: const Icon(
                        Icons.hotel_class,
                        size: 52,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'StayEaze Console',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'PG & Hostel Enterprise SaaS Mobile Portal',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(height: 36),

                  if (_errorMessage.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFECACA)),
                      ),
                      child: Text(
                        _errorMessage,
                        style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],

                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(color: Color(0xFF0F172A)),
                    decoration: const InputDecoration(
                      labelText: 'Email Address',
                      hintText: 'admin@stayeaze.com',
                      prefixIcon: Icon(Icons.email_outlined, color: Color(0xFF64748B)),
                    ),
                    validator: (v) => v == null || v.isEmpty ? 'Please enter email' : null,
                  ),
                  const SizedBox(height: 16),

                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    style: const TextStyle(color: Color(0xFF0F172A)),
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      hintText: '••••••••',
                      prefixIcon: Icon(Icons.lock_outline, color: Color(0xFF64748B)),
                    ),
                    validator: (v) => v == null || v.isEmpty ? 'Please enter password' : null,
                  ),
                  const SizedBox(height: 24),

                  ElevatedButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4F46E5),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),

                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                          )
                        : const Text(
                            'Sign In to Console',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
