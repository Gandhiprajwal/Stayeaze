import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import 'main_screens.dart';

class PaymentsTab extends StatefulWidget {
  final UserSession session;
  const PaymentsTab({super.key, required this.session});

  @override
  State<PaymentsTab> createState() => _PaymentsTabState();
}

class _PaymentsTabState extends State<PaymentsTab> {
  List<dynamic> _payments = [];
  bool _loading = true;
  String _searchQuery = '';
  String _filterMethod = 'ALL';

  final List<String> _methods = ['ALL', 'CASH', 'UPI', 'RAZORPAY', 'BANK_TRANSFER', 'CARD'];

  Future<void> _loadPayments() async {
    try {
      final cached = await ApiService.getPayments(widget.session.token);
      if (cached.isNotEmpty && mounted) {
        setState(() { _payments = cached; _loading = false; });
      }
    } catch (_) {}
    try {
      final fresh = await ApiService.getPayments(widget.session.token, forceRefresh: true);
      if (mounted) setState(() { _payments = fresh; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  void initState() {
    super.initState();
    _loadPayments();
  }

  double get _totalCollected {
    double sum = 0;
    for (var p in _payments) {
      if (p['status']?.toString().toLowerCase() == 'success') {
        sum += (p['amount'] ?? 0).toDouble();
      }
    }
    return sum;
  }

  double get _totalPending {
    double sum = 0;
    for (var p in _payments) {
      if (p['status']?.toString().toLowerCase() == 'pending') {
        sum += (p['amount'] ?? 0).toDouble();
      }
    }
    return sum;
  }

  IconData _methodIcon(String method) {
    switch (method.toLowerCase()) {
      case 'cash': return Icons.money_rounded;
      case 'upi': return Icons.qr_code_rounded;
      case 'razorpay': return Icons.credit_card_rounded;
      case 'bank_transfer': return Icons.account_balance_rounded;
      case 'card': return Icons.credit_card_outlined;
      default: return Icons.payment_rounded;
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'success': return const Color(0xFF059669);
      case 'failed': return const Color(0xFFDC2626);
      default: return const Color(0xFFD97706);
    }
  }

  Future<void> _showRecordPaymentDialog() async {
    final amountCtrl = TextEditingController();
    final tenantCtrl = TextEditingController();
    final refCtrl = TextEditingController();
    String selectedMethod = 'cash';
    String selectedStatus = 'success';

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx2, setS) => ModalSheetWidget(
          title: 'Record Payment',
          icon: Icons.add_card_rounded,
          color: const Color(0xFF059669),
          fields: [
            ModalSheetField(ctrl: tenantCtrl, label: 'Tenant Name', hint: 'Alex Morgan'),
            ModalSheetField(ctrl: amountCtrl, label: 'Amount (₹)', hint: '8000', isNumber: true),
            ModalSheetField(ctrl: refCtrl, label: 'Payment Reference', hint: 'TXN123456'),
          ],
          extraWidgets: [
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: selectedMethod,
              dropdownColor: Colors.white,
              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
              decoration: const InputDecoration(labelText: 'Payment Method'),
              items: const [
                DropdownMenuItem(value: 'cash', child: Text('Cash')),
                DropdownMenuItem(value: 'upi', child: Text('UPI')),
                DropdownMenuItem(value: 'razorpay', child: Text('Razorpay')),
                DropdownMenuItem(value: 'bank_transfer', child: Text('Bank Transfer')),
                DropdownMenuItem(value: 'card', child: Text('Card / POS')),
                DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
              ],
              onChanged: (v) { if (v != null) setS(() => selectedMethod = v); },
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: selectedStatus,
              dropdownColor: Colors.white,
              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
              decoration: const InputDecoration(labelText: 'Status'),
              items: const [
                DropdownMenuItem(value: 'success', child: Text('Success')),
                DropdownMenuItem(value: 'pending', child: Text('Pending')),
                DropdownMenuItem(value: 'failed', child: Text('Failed')),
              ],
              onChanged: (v) { if (v != null) setS(() => selectedStatus = v); },
            ),
          ],
          onSave: () async {
            await ApiService.createPayment(widget.session.token, {
              'tenantName': tenantCtrl.text.trim(),
              'amount': double.tryParse(amountCtrl.text) ?? 0,
              'method': selectedMethod,
              'status': selectedStatus,
              'paymentReference': refCtrl.text.trim(),
              'date': DateTime.now().toIso8601String().split('T')[0],
            });
            _loadPayments();
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _payments.where((p) {
      final name = p['tenantName']?.toString().toLowerCase() ?? '';
      final method = p['method']?.toString().toLowerCase() ?? '';
      final q = _searchQuery.toLowerCase();
      final matchesSearch = name.contains(q) || method.contains(q);
      final matchesMethod = _filterMethod == 'ALL' || method == _filterMethod.toLowerCase();
      return matchesSearch && matchesMethod;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: ModernAppBarWidget(
        title: 'Payments',
        icon: Icons.payments_rounded,
        color: const Color(0xFF059669),
        count: _payments.length,
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF059669),
        icon: const Icon(Icons.add_card_rounded, color: Colors.white),
        label: const Text('Record Payment', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: _showRecordPaymentDialog,
      ),
      body: _loading && _payments.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(children: [
                  Expanded(child: MiniStatCardWidget(label: 'Total Collected', value: '₹${_totalCollected.toStringAsFixed(0)}', color: const Color(0xFF059669), icon: Icons.trending_up_rounded)),
                  const SizedBox(width: 10),
                  Expanded(child: MiniStatCardWidget(label: 'Pending', value: '₹${_totalPending.toStringAsFixed(0)}', color: const Color(0xFFD97706), icon: Icons.pending_actions_rounded)),
                ]),
              ),
              SearchBarWidget(
                hint: 'Search by tenant or method...',
                color: const Color(0xFF059669),
                onChanged: (v) => setState(() => _searchQuery = v),
              ),
              FilterChipsWidget(
                options: _methods,
                selected: _filterMethod,
                color: const Color(0xFF059669),
                onSelected: (v) => setState(() => _filterMethod = v),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _loadPayments,
                  child: filtered.isEmpty
                      ? const EmptyStateWidget(label: 'No payments found.', icon: Icons.payments_outlined)
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                          itemCount: filtered.length,
                          itemBuilder: (ctx, i) {
                            final p = filtered[i];
                            final status = p['status']?.toString() ?? 'pending';
                            final method = p['method']?.toString() ?? 'cash';
                            final sColor = _statusColor(status);

                            return AnimatedCardWidget(
                              index: i,
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
                                    decoration: BoxDecoration(color: sColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                                    child: Icon(_methodIcon(method), color: sColor, size: 22),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          p['tenantName'] ?? 'Tenant',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A)),
                                        ),
                                        const SizedBox(height: 4),
                                        Row(children: [
                                          InfoPillWidget(icon: Icons.credit_card_rounded, label: method.toUpperCase().replaceAll('_', ' '), color: const Color(0xFF059669)),
                                          if (p['date'] != null) ...[
                                            const SizedBox(width: 6),
                                            Text(p['date'], style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                                          ],
                                        ]),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text('₹${p['amount'] ?? 0}', style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 17)),
                                      const SizedBox(height: 4),
                                      StatusBadgeWidget(label: status.toUpperCase(), color: sColor),
                                    ],
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
