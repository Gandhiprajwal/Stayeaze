import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';

class SecurityTab extends StatefulWidget {
  final UserSession session;
  const SecurityTab({super.key, required this.session});

  @override
  State<SecurityTab> createState() => _SecurityTabState();
}

class _SecurityTabState extends State<SecurityTab> {
  List _incidents = [];
  bool _loading = true;

  Future<void> _loadIncidents() async {
    // 1. Instantly load cached value to render UI immediately
    try {
      final cachedData = await ApiService.getSafetyIncidents(widget.session.token);
      if (cachedData.isNotEmpty) {
        setState(() {
          _incidents = cachedData;
          _loading = false;
        });
      }
    } catch (_) {}

    // 2. Fetch fresh update from network in background
    try {
      final freshData = await ApiService.getSafetyIncidents(widget.session.token, forceRefresh: true);
      if (mounted) {
        setState(() {
          _incidents = freshData;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted && _incidents.isEmpty) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _loadIncidents();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Security Registry', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: const Color(0xFF0B0F19),
        elevation: 0,
      ),
      body: _loading && _incidents.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              itemCount: _incidents.length,
              itemBuilder: (context, index) {
                final incident = _incidents[index];
                final isHigh = incident['severity'] == 'HIGH';
                return Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF131A2E),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isHigh ? const Color(0x4DEF4444) : const Color(0xFF1E2942),
                      width: 1.2,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isHigh ? const Color(0x1FEF4444) : const Color(0x1FF59E0B),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isHigh ? Icons.gpp_bad_rounded : Icons.shield_rounded,
                          color: isHigh ? const Color(0xFFEF4444) : const Color(0xFFF59E0B),
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              incident['description'] ?? 'Safety incident report log',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Reported by: ${incident['reportedBy']} (${incident['severity']})',
                              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Status Text
                      Text(
                        incident['status'] ?? 'OPEN',
                        style: TextStyle(
                          color: incident['status'] == 'RESOLVED' ? const Color(0xFF34D399) : const Color(0xFFF59E0B),
                          fontWeight: FontWeight.w900,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
