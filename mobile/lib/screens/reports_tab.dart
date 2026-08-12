import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import 'main_screens.dart';

class ReportsTab extends StatefulWidget {
  final UserSession session;
  const ReportsTab({super.key, required this.session});

  @override
  State<ReportsTab> createState() => _ReportsTabState();
}

class _ReportsTabState extends State<ReportsTab> {
  Map<String, dynamic>? _summary;
  bool _loading = true;

  int _totalProperties = 0;
  int _totalTenants = 0;
  int _totalInvoices = 0;
  int _totalComplaints = 0;
  double _totalRevenue = 0;
  double _pendingRevenue = 0;

  Future<void> _loadReports() async {
    setState(() => _loading = true);
    try {
      final summary = await ApiService.getReportsSummary(widget.session.token);
      if (summary != null && mounted) {
        setState(() { _summary = summary; });
      }
    } catch (_) {}

    try {
      final props = await ApiService.getProperties(widget.session.token, forceRefresh: true);
      final tenants = await ApiService.getTenants(widget.session.token, forceRefresh: true);
      final invoices = await ApiService.getInvoices(widget.session.token, forceRefresh: true);
      final complaints = await ApiService.getComplaints(widget.session.token, forceRefresh: true);

      double collected = 0;
      double pending = 0;
      for (final inv in invoices) {
        final amt = (inv['amount'] ?? inv['totalAmount'] ?? 0).toDouble();
        if (inv['status']?.toString().toUpperCase() == 'PAID') {
          collected += amt;
        } else {
          pending += amt;
        }
      }

      if (mounted) {
        setState(() {
          _totalProperties = props.length;
          _totalTenants = tenants.length;
          _totalInvoices = invoices.length;
          _totalComplaints = complaints.length;
          _totalRevenue = collected;
          _pendingRevenue = pending;
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
    _loadReports();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: const ModernAppBarWidget(
        title: 'Reports & Analytics',
        icon: Icons.analytics_rounded,
        color: Color(0xFF4F46E5),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadReports,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  // Banner Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF3730A3)]),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: const [BoxShadow(color: Color(0x334F46E5), blurRadius: 16, offset: Offset(0, 8))],
                    ),
                    child: Row(children: [
                      Container(
                        width: 50, height: 50,
                        decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
                        child: const Icon(Icons.analytics_rounded, color: Colors.white, size: 28),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Text('Business Analytics', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
                          const SizedBox(height: 2),
                          Text('Generated ${DateTime.now().toString().split(' ')[0]}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                        ]),
                      ),
                    ]),
                  ),
                  const SizedBox(height: 20),

                  const Text('Occupancy & Operations', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.35,
                    children: [
                      _reportCard('Properties', _totalProperties.toString(), Icons.domain_rounded, const Color(0xFFEEF2FF), const Color(0xFF4F46E5)),
                      _reportCard('Residents', _totalTenants.toString(), Icons.people_alt_rounded, const Color(0xFFECFDF5), const Color(0xFF059669)),
                      _reportCard('Invoices', _totalInvoices.toString(), Icons.receipt_long_rounded, const Color(0xFFFFFBEB), const Color(0xFFD97706)),
                      _reportCard('Complaints', _totalComplaints.toString(), Icons.report_problem_rounded, const Color(0xFFFEF2F2), const Color(0xFFDC2626)),
                    ],
                  ),
                  const SizedBox(height: 20),

                  const Text('Financial Summary', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
                    ),
                    child: Column(children: [
                      _revenueRow('Total Revenue Collected', '₹${_totalRevenue.toStringAsFixed(0)}', const Color(0xFF059669)),
                      const Divider(height: 24, color: Color(0xFFE2E8F0)),
                      _revenueRow('Total Pending Dues', '₹${_pendingRevenue.toStringAsFixed(0)}', const Color(0xFFDC2626)),
                      const Divider(height: 24, color: Color(0xFFE2E8F0)),
                      _revenueRow('Gross Invoiced Amount', '₹${(_totalRevenue + _pendingRevenue).toStringAsFixed(0)}', const Color(0xFF4F46E5)),
                      if (_totalRevenue + _pendingRevenue > 0) ...[
                        const Divider(height: 24, color: Color(0xFFE2E8F0)),
                        _revenueRow('Collection Rate',
                            '${((_totalRevenue / (_totalRevenue + _pendingRevenue)) * 100).toStringAsFixed(1)}%',
                            const Color(0xFF4F46E5)),
                      ],
                    ]),
                  ),
                  const SizedBox(height: 20),

                  if (_summary != null) ...[
                    const Text('Backend System Report', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
                      ),
                      child: Column(
                        children: (_summary!.entries.map((e) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            Text(e.key.replaceAll('_', ' ').toUpperCase(), style: const TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.w600)),
                            Text(e.value.toString(), style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 14)),
                          ]),
                        ))).toList(),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _reportCard(String label, String value, IconData icon, Color bg, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: color, size: 20),
        ),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(color: color, fontSize: 24, fontWeight: FontWeight.w800)),
          Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.w500)),
        ]),
      ]),
    );
  }

  Widget _revenueRow(String label, String value, Color color) {
    return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 13, fontWeight: FontWeight.w500)),
      Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 16)),
    ]);
  }
}
