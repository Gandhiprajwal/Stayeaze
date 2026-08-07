import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';

class PropertiesTab extends StatefulWidget {
  final UserSession session;
  const PropertiesTab({super.key, required this.session});

  @override
  State<PropertiesTab> createState() => _PropertiesTabState();
}

class _PropertiesTabState extends State<PropertiesTab> {
  List _propertiesList = [];
  bool _loading = true;

  Future<void> _loadProperties() async {
    // 1. Instantly load cached value to render UI immediately
    try {
      final cachedData = await ApiService.getProperties(widget.session.token);
      if (cachedData.isNotEmpty) {
        setState(() {
          _propertiesList = cachedData;
          _loading = false;
        });
      }
    } catch (_) {}

    // 2. Fetch fresh update from network in background
    try {
      final freshData = await ApiService.getProperties(widget.session.token, forceRefresh: true);
      if (mounted) {
        setState(() {
          _propertiesList = freshData;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted && _propertiesList.isEmpty) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _loadProperties();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Managed Layouts', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: const Color(0xFF0B0F19),
        elevation: 0,
      ),
      body: _loading && _propertiesList.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              itemCount: _propertiesList.length,
              itemBuilder: (context, index) {
                final prop = _propertiesList[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: const Color(0xFF131A2E),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF1E2942), width: 1.2),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0x1F6366F1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.domain_rounded, color: Color(0xFF818CF8), size: 24),
                      ),
                      const SizedBox(width: 18),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              prop['name'] ?? 'Guest Hostel',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              prop['address'] ?? 'No address registered',
                              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: Color(0xFF64748B), size: 24),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
