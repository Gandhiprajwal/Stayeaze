import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';

class ResidentsTab extends StatefulWidget {
  final UserSession session;
  const ResidentsTab({super.key, required this.session});

  @override
  State<ResidentsTab> createState() => _ResidentsTabState();
}

class _ResidentsTabState extends State<ResidentsTab> {
  List _tenantsList = [];
  bool _loading = true;

  Future<void> _loadTenants() async {
    // 1. Instantly load cached value to render UI immediately
    try {
      final cachedData = await ApiService.getTenants(widget.session.token);
      if (cachedData.isNotEmpty) {
        setState(() {
          _tenantsList = cachedData;
          _loading = false;
        });
      }
    } catch (_) {}

    // 2. Fetch fresh update from network in background
    try {
      final freshData = await ApiService.getTenants(widget.session.token, forceRefresh: true);
      if (mounted) {
        setState(() {
          _tenantsList = freshData;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted && _tenantsList.isEmpty) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _loadTenants();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Occupancy Roster', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: const Color(0xFF0B0F19),
        elevation: 0,
      ),
      body: _loading && _tenantsList.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              itemCount: _tenantsList.length,
              itemBuilder: (context, index) {
                final tenant = _tenantsList[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF131A2E),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF1E2942), width: 1.2),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: const BoxDecoration(
                          color: Color(0x1F10B981),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.person_rounded, color: Color(0xFF34D399), size: 24),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${tenant['firstName']} ${tenant['lastName']}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Mobile: ${tenant['mobileNumber']}',
                              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      // Status Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0x3310B981),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'ACTIVE',
                          style: TextStyle(fontSize: 10, color: Color(0xFF34D399), fontWeight: FontWeight.bold),
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
