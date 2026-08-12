import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import 'main_screens.dart';

class BookingsTab extends StatefulWidget {
  final UserSession session;
  const BookingsTab({super.key, required this.session});

  @override
  State<BookingsTab> createState() => _BookingsTabState();
}

class _BookingsTabState extends State<BookingsTab> {
  List<dynamic> _bookings = [];
  bool _loading = true;
  String _searchQuery = '';
  String _filterStatus = 'ALL';

  Future<void> _loadBookings() async {
    try {
      final cached = await ApiService.getBookings(widget.session.token);
      if (cached.isNotEmpty && mounted) {
        setState(() { _bookings = cached; _loading = false; });
      }
    } catch (_) {}
    try {
      final fresh = await ApiService.getBookings(widget.session.token, forceRefresh: true);
      if (mounted) setState(() { _bookings = fresh; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  void initState() {
    super.initState();
    _loadBookings();
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'CONFIRMED': return const Color(0xFF059669);
      case 'CHECKED_IN': return const Color(0xFF4F46E5);
      case 'CANCELLED': return const Color(0xFFDC2626);
      case 'EXPIRED': return const Color(0xFF64748B);
      default: return const Color(0xFFD97706);
    }
  }

  Future<void> _showBookingDialog({Map<String, dynamic>? existing}) async {
    final nameCtrl = TextEditingController(text: existing?['tenantName'] ?? '');
    final emailCtrl = TextEditingController(text: existing?['tenantEmail'] ?? '');
    final phoneCtrl = TextEditingController(text: existing?['tenantPhone'] ?? '');
    final rentCtrl = TextEditingController(text: (existing?['rent'] ?? 8000).toString());
    final depositCtrl = TextEditingController(text: (existing?['deposit'] ?? 16000).toString());
    String selectedStatus = existing?['status'] ?? 'PENDING';

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx2, setS) => ModalSheetWidget(
          title: existing != null ? 'Edit Booking' : 'New Booking',
          icon: Icons.calendar_today_rounded,
          color: const Color(0xFF0891B2),
          fields: [
            ModalSheetField(ctrl: nameCtrl, label: 'Tenant Name', hint: 'Alex Morgan'),
            ModalSheetField(ctrl: emailCtrl, label: 'Email', hint: 'alex@example.com'),
            ModalSheetField(ctrl: phoneCtrl, label: 'Mobile Phone', hint: '+919876543210'),
            ModalSheetField(ctrl: rentCtrl, label: 'Monthly Rent (₹)', hint: '8000', isNumber: true),
            ModalSheetField(ctrl: depositCtrl, label: 'Deposit Amount (₹)', hint: '16000', isNumber: true),
          ],
          extraWidgets: [
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: selectedStatus,
              dropdownColor: Colors.white,
              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
              decoration: const InputDecoration(labelText: 'Status'),
              items: const [
                DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
                DropdownMenuItem(value: 'CONFIRMED', child: Text('Confirmed')),
                DropdownMenuItem(value: 'CHECKED_IN', child: Text('Checked In')),
                DropdownMenuItem(value: 'CANCELLED', child: Text('Cancelled')),
              ],
              onChanged: (v) { if (v != null) setS(() => selectedStatus = v); },
            ),
          ],
          onSave: () async {
            final body = {
              'tenantName': nameCtrl.text.trim(),
              'tenantEmail': emailCtrl.text.trim(),
              'tenantPhone': phoneCtrl.text.trim(),
              'rent': int.tryParse(rentCtrl.text) ?? 8000,
              'deposit': int.tryParse(depositCtrl.text) ?? 16000,
              'status': selectedStatus,
              'checkInDate': DateTime.now().toIso8601String().split('T')[0],
              'durationMonths': 6,
              'source': 'direct',
            };
            if (existing != null) {
              await ApiService.updateBooking(widget.session.token, existing['id'].toString(), body);
            } else {
              await ApiService.createBooking(widget.session.token, body);
            }
            _loadBookings();
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _bookings.where((b) {
      final name = b['tenantName']?.toString().toLowerCase() ?? '';
      final q = _searchQuery.toLowerCase();
      final matchesSearch = name.contains(q);
      final status = b['status']?.toString().toUpperCase() ?? '';
      final matchesFilter = _filterStatus == 'ALL' || status == _filterStatus;
      return matchesSearch && matchesFilter;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: ModernAppBarWidget(
        title: 'Bookings',
        icon: Icons.calendar_today_rounded,
        color: const Color(0xFF0891B2),
        count: _bookings.length,
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF0891B2),
        icon: const Icon(Icons.calendar_today_rounded, color: Colors.white),
        label: const Text('New Booking', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () => _showBookingDialog(),
      ),
      body: _loading && _bookings.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              SearchBarWidget(
                hint: 'Search bookings by tenant...',
                color: const Color(0xFF0891B2),
                onChanged: (v) => setState(() => _searchQuery = v),
              ),
              FilterChipsWidget(
                options: const ['ALL', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED'],
                selected: _filterStatus,
                color: const Color(0xFF0891B2),
                onSelected: (v) => setState(() => _filterStatus = v),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _loadBookings,
                  child: filtered.isEmpty
                      ? const EmptyStateWidget(label: 'No bookings found.', icon: Icons.calendar_today_outlined)
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                          itemCount: filtered.length,
                          itemBuilder: (ctx, i) {
                            final b = filtered[i];
                            final status = b['status']?.toString().toUpperCase() ?? 'PENDING';
                            final sColor = _statusColor(status);
                            return AnimatedCardWidget(
                              index: i,
                              child: GestureDetector(
                                onTap: () => _showBookingDialog(existing: Map<String, dynamic>.from(b)),
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(18),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                    boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
                                  ),
                                  child: Row(children: [
                                    Container(
                                      width: 46, height: 46,
                                      decoration: BoxDecoration(
                                        color: sColor.withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Icon(Icons.calendar_today_rounded, color: sColor, size: 22),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            b['tenantName'] ?? 'Unknown Tenant',
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A)),
                                          ),
                                          const SizedBox(height: 4),
                                          Row(children: [
                                            InfoPillWidget(icon: Icons.currency_rupee_rounded, label: '${b['rent'] ?? 0}/mo', color: const Color(0xFF0891B2)),
                                            const SizedBox(width: 6),
                                            InfoPillWidget(icon: Icons.lock_outline_rounded, label: 'Deposit ₹${b['deposit'] ?? 0}', color: const Color(0xFF64748B)),
                                          ]),
                                          if (b['checkInDate'] != null) ...[
                                            const SizedBox(height: 4),
                                            Text('Check-in: ${b['checkInDate']}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                                          ],
                                        ],
                                      ),
                                    ),
                                    StatusBadgeWidget(label: status.replaceAll('_', ' '), color: sColor),
                                  ]),
                                ),
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
