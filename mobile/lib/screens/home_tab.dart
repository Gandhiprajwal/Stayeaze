import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import 'login_screen.dart';

class HomeTab extends StatefulWidget {
  final UserSession session;
  const HomeTab({super.key, required this.session});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  int _propertiesCount = 0;
  int _residentsCount = 0;
  int _complaintsCount = 0;
  bool _loading = true;

  Future<void> _fetchOverview() async {
    try {
      final props = await ApiService.getProperties(widget.session.token);
      final residents = await ApiService.getTenants(widget.session.token);

      setState(() {
        _propertiesCount = props.length;
        _residentsCount = residents.length;
        _complaintsCount = 2; // Mocked support tasks count
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchOverview();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'StayEaze Dashboard',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, letterSpacing: 0.5),
        ),
        backgroundColor: const Color(0xFF0B0F19),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.power_settings_new_rounded, color: Color(0xFFEF4444)),
            onPressed: () async {
              await ApiService.clearSession();
              if (!context.mounted) return;
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (context) => const LoginScreen()),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Premium Welcome Backdrop card
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF1E294B), Color(0xFF0F172A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF334155), width: 1),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x146366F1),
                          blurRadius: 20,
                          offset: Offset(0, 10),
                        )
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0x336366F1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.admin_panel_settings_rounded, color: Color(0xFF818CF8), size: 24),
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Text(
                                'System Operator Profile',
                                style: TextStyle(fontSize: 13, color: Color(0xFF818CF8), fontWeight: FontWeight.bold, letterSpacing: 0.8),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        Text(
                          'Hi, ${widget.session.username}',
                          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Role Privilege Level: ${widget.session.role}',
                          style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  
                  // Metric grid header
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Operations Metrics',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Metrics Cards
                  _buildModernMetricCard('Managed Properties', '$_propertiesCount', Icons.domain_rounded, Colors.blue, 'Operational'),
                  const SizedBox(height: 16),
                  _buildModernMetricCard('Active Residents', '$_residentsCount', Icons.people_alt_rounded, Colors.green, 'Registered'),
                  const SizedBox(height: 16),
                  _buildModernMetricCard('Support Complaints', '$_complaintsCount', Icons.build_circle_rounded, Colors.orange, 'Assigned tasks'),
                ],
              ),
            ),
    );
  }

  Widget _buildModernMetricCard(String title, String val, IconData icon, Color color, String subText) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      decoration: BoxDecoration(
        color: const Color(0xFF131A2E),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF1E2942), width: 1.2),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: color.withAlpha(30),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, size: 28, color: color),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  subText,
                  style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                ),
              ],
            ),
          ),
          Text(
            val,
            style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
