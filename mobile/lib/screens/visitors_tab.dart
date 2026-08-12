import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import 'main_screens.dart';

class VisitorsTab extends StatefulWidget {
  final UserSession session;
  const VisitorsTab({super.key, required this.session});

  @override
  State<VisitorsTab> createState() => _VisitorsTabState();
}

class _VisitorsTabState extends State<VisitorsTab> {
  List<dynamic> _visitors = [];
  bool _loading = true;
  String _searchQuery = '';

  Future<void> _loadVisitors() async {
    try {
      final cached = await ApiService.getVisitors(widget.session.token);
      if (cached.isNotEmpty && mounted) {
        setState(() { _visitors = cached; _loading = false; });
      }
    } catch (_) {}
    try {
      final fresh = await ApiService.getVisitors(widget.session.token, forceRefresh: true);
      if (mounted) setState(() { _visitors = fresh; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  void initState() {
    super.initState();
    _loadVisitors();
  }

  Future<void> _showAddVisitorDialog() async {
    final nameCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    final hostCtrl = TextEditingController();
    final purposeCtrl = TextEditingController();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ModalSheetWidget(
        title: 'Register Visitor',
        icon: Icons.person_pin_rounded,
        color: const Color(0xFF0891B2),
        fields: [
          ModalSheetField(ctrl: nameCtrl, label: 'Visitor Name', hint: 'Full Name'),
          ModalSheetField(ctrl: mobileCtrl, label: 'Mobile Number', hint: '+919876543210', isNumber: true),
          ModalSheetField(ctrl: hostCtrl, label: 'Host Tenant / Room', hint: 'Room 101 - Alex'),
          ModalSheetField(ctrl: purposeCtrl, label: 'Purpose of Visit', hint: 'Family Visit'),
        ],
        onSave: () async {
          await ApiService.createVisitor(widget.session.token, {
            'visitorName': nameCtrl.text.trim(),
            'mobileNumber': mobileCtrl.text.trim(),
            'hostTenant': hostCtrl.text.trim(),
            'purpose': purposeCtrl.text.trim(),
            'checkInTime': DateTime.now().toIso8601String(),
          });
          _loadVisitors();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _visitors.where((v) {
      final name = v['visitorName']?.toString().toLowerCase() ?? '';
      final host = v['hostTenant']?.toString().toLowerCase() ?? '';
      final q = _searchQuery.toLowerCase();
      return name.contains(q) || host.contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: ModernAppBarWidget(
        title: 'Visitors Log',
        icon: Icons.person_pin_rounded,
        color: const Color(0xFF0891B2),
        count: _visitors.length,
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF0891B2),
        icon: const Icon(Icons.person_pin_rounded, color: Colors.white),
        label: const Text('Register Visitor', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: _showAddVisitorDialog,
      ),
      body: _loading && _visitors.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              SearchBarWidget(
                hint: 'Search visitor name or host...',
                color: const Color(0xFF0891B2),
                onChanged: (v) => setState(() => _searchQuery = v),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _loadVisitors,
                  child: filtered.isEmpty
                      ? const EmptyStateWidget(label: 'No visitor records found.', icon: Icons.person_pin_outlined)
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                          itemCount: filtered.length,
                          itemBuilder: (ctx, i) {
                            final v = filtered[i];
                            final isCheckedOut = v['checkOutTime'] != null;

                            return AnimatedCardWidget(
                              index: i,
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: isCheckedOut ? const Color(0xFFBBF7D0) : const Color(0xFFBAE6FD)),
                                  boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
                                ),
                                child: Row(children: [
                                  Container(
                                    width: 46, height: 46,
                                    decoration: BoxDecoration(color: const Color(0xFFE0F2FE), borderRadius: BorderRadius.circular(12)),
                                    child: const Icon(Icons.person_pin_rounded, color: Color(0xFF0891B2), size: 24),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(v['visitorName'] ?? 'Visitor', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                                        const SizedBox(height: 4),
                                        Row(children: [
                                          if (v['hostTenant'] != null) InfoPillWidget(icon: Icons.home_rounded, label: 'Host: ${v['hostTenant']}', color: const Color(0xFF0891B2)),
                                          if (v['purpose'] != null) ...[
                                            const SizedBox(width: 6),
                                            InfoPillWidget(icon: Icons.info_outline_rounded, label: v['purpose'], color: const Color(0xFF64748B)),
                                          ],
                                        ]),
                                        if (v['mobileNumber'] != null) ...[
                                          const SizedBox(height: 4),
                                          Text('Mobile: ${v['mobileNumber']}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                                        ],
                                      ],
                                    ),
                                  ),
                                  StatusBadgeWidget(
                                    label: isCheckedOut ? 'CHECKED OUT' : 'INSIDE',
                                    color: isCheckedOut ? const Color(0xFF059669) : const Color(0xFF0891B2),
                                  ),
                                ]),
                              ),
                            );
                          },
                        ),
                ),
              ),
            ]),
    );
  }
}
