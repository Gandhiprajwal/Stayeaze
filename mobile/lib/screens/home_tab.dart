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

class _HomeTabState extends State<HomeTab> with SingleTickerProviderStateMixin {
  int _propertiesCount = 0;
  int _residentsCount = 0;
  int _invoicesCount = 0;
  int _complaintsCount = 0;
  Map<String, dynamic>? _sysMetrics;
  bool _loading = true;
  late AnimationController _animCtrl;

  Future<void> _fetchOverview() async {
    try {
      final props = await ApiService.getProperties(widget.session.token);
      final residents = await ApiService.getTenants(widget.session.token);
      final invoices = await ApiService.getInvoices(widget.session.token);
      final complaints = await ApiService.getComplaints(widget.session.token);
      final metrics = await ApiService.getSystemMetrics(widget.session.token);
      if (mounted) {
        setState(() {
          _propertiesCount = props.length;
          _residentsCount = residents.length;
          _invoicesCount = invoices.length;
          _complaintsCount = complaints.length;
          _sysMetrics = metrics;
          _loading = false;
        });
        _animCtrl.forward(from: 0.0);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
    _fetchOverview();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  LinearGradient _getRoleGradient() {
    final role = widget.session.role.toUpperCase();
    if (role == 'SUPER_ADMIN') return const LinearGradient(colors: [Color(0xFF6D28D9), Color(0xFF4F46E5)], begin: Alignment.topLeft, end: Alignment.bottomRight);
    if (role == 'PROPERTY_OWNER' || role == 'OWNER') return const LinearGradient(colors: [Color(0xFF1D4ED8), Color(0xFF2563EB)], begin: Alignment.topLeft, end: Alignment.bottomRight);
    if (role == 'PROPERTY_MANAGER' || role == 'MANAGER') return const LinearGradient(colors: [Color(0xFF047857), Color(0xFF059669)], begin: Alignment.topLeft, end: Alignment.bottomRight);
    return const LinearGradient(colors: [Color(0xFF0E7490), Color(0xFF0891B2)], begin: Alignment.topLeft, end: Alignment.bottomRight);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 0,
        title: Row(children: [
          Container(
            width: 32, height: 32,
            margin: const EdgeInsets.only(left: 8),
            decoration: BoxDecoration(gradient: _getRoleGradient(), borderRadius: BorderRadius.circular(8)),
            child: const Icon(Icons.hotel_class, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          const Text('StayEaze', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF0F172A))),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF64748B)),
            onPressed: _fetchOverview,
            tooltip: 'Refresh',
          ),
          GestureDetector(
            onTap: () async {
              final nav = Navigator.of(context);
              await ApiService.clearSession();
              nav.pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
            },
            child: Container(
              margin: const EdgeInsets.only(right: 14),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: const Row(children: [
                Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 15),
                SizedBox(width: 5),
                Text('Sign Out', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold, fontSize: 12)),
              ]),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchOverview,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // ── Hero Welcome Card ────────────────────
                  _buildHeroCard(),
                  const SizedBox(height: 16),

                  // ── Role Action Buttons ──────────────────
                  _buildQuickActions(),
                  const SizedBox(height: 20),

                  // ── Section Label ────────────────────────
                  _sectionLabel('Key Metrics'),
                  const SizedBox(height: 12),

                  // ── 4-up KPI Grid ────────────────────────
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.35,
                    children: [
                      _kpiCard('Properties', _propertiesCount, Icons.domain_rounded, const Color(0xFF4F46E5), const Color(0xFFEEF2FF)),
                      _kpiCard('Residents', _residentsCount, Icons.people_alt_rounded, const Color(0xFF059669), const Color(0xFFECFDF5)),
                      _kpiCard('Invoices', _invoicesCount, Icons.receipt_long_rounded, const Color(0xFFD97706), const Color(0xFFFFFBEB)),
                      _kpiCard('Complaints', _complaintsCount, Icons.report_problem_rounded, const Color(0xFFDC2626), const Color(0xFFFEF2F2)),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // ── Infrastructure Health ────────────────
                  _sectionLabel('Infrastructure Status'),
                  const SizedBox(height: 12),
                  _buildHealthCard(),
                  const SizedBox(height: 20),
                ],
              ),
            ),
    );
  }

  Widget _buildHeroCard() {
    return TweenAnimationBuilder<double>(
      duration: const Duration(milliseconds: 500),
      tween: Tween(begin: 0.92, end: 1.0),
      builder: (ctx, val, child) => Transform.scale(scale: val, child: child),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: _getRoleGradient(),
          borderRadius: BorderRadius.circular(20),
          boxShadow: const [BoxShadow(color: Color(0x334F46E5), blurRadius: 16, offset: Offset(0, 8))],
        ),
        child: Row(children: [
          Container(
            width: 50, height: 50,
            decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
            child: Center(
              child: Text(
                widget.session.username.isNotEmpty ? widget.session.username[0].toUpperCase() : 'A',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 22),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Welcome back,', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12)),
            Text(
              widget.session.username,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 20),
              maxLines: 1, overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(20)),
              child: Text(
                widget.session.role.replaceAll('_', ' '),
                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
          ])),
          const Icon(Icons.chevron_right_rounded, color: Colors.white54),
        ]),
      ),
    );
  }

  Widget _buildQuickActions() {
    final role = widget.session.role.toUpperCase();
    final actions = <Map<String, dynamic>>[];

    if (role == 'SUPER_ADMIN') {
      actions.add({'label': 'Cloud\nGateways', 'icon': Icons.cloud_done_rounded, 'color': const Color(0xFF7C3AED), 'bg': const Color(0xFFF5F3FF)});
      actions.add({'label': 'Add\nStaff', 'icon': Icons.person_add_rounded, 'color': const Color(0xFF4F46E5), 'bg': const Color(0xFFEEF2FF)});
    }
    if (role == 'SUPER_ADMIN' || role == 'PROPERTY_OWNER' || role == 'OWNER') {
      actions.add({'label': 'New\nProperty', 'icon': Icons.domain_add_rounded, 'color': const Color(0xFF2563EB), 'bg': const Color(0xFFEFF6FF)});
    }
    if (role != 'TENANT') {
      actions.add({'label': 'Check-In\nTenant', 'icon': Icons.person_add_alt_1_rounded, 'color': const Color(0xFF059669), 'bg': const Color(0xFFECFDF5)});
    }
    actions.add({'label': 'Log\nTicket', 'icon': Icons.report_problem_rounded, 'color': const Color(0xFFDC2626), 'bg': const Color(0xFFFEF2F2)});

    return SizedBox(
      height: 86,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: actions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (ctx, i) {
          final a = actions[i];
          return GestureDetector(
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Use the sidebar to navigate to ${a['label'].toString().replaceAll('\n', ' ')}')),
            ),
            child: Container(
              width: 76,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: a['bg'] as Color,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: (a['color'] as Color).withValues(alpha: 0.2)),
                boxShadow: [BoxShadow(color: (a['color'] as Color).withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, 3))],
              ),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(a['icon'] as IconData, color: a['color'] as Color, size: 24),
                const SizedBox(height: 6),
                Text(
                  a['label'] as String,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: a['color'] as Color, fontSize: 9, fontWeight: FontWeight.bold, height: 1.2),
                ),
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _kpiCard(String title, int count, IconData icon, Color color, Color bg) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [BoxShadow(color: Color(0x06000000), blurRadius: 12, offset: Offset(0, 4))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20),
          ),
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.5), shape: BoxShape.circle),
          ),
        ]),
        const SizedBox(height: 10),
        TweenAnimationBuilder<double>(
          duration: const Duration(milliseconds: 1000),
          tween: Tween(begin: 0, end: count.toDouble()),
          builder: (_, val, __) => Text(
            val.toInt().toString(),
            style: const TextStyle(color: Color(0xFF0F172A), fontSize: 26, fontWeight: FontWeight.w800),
          ),
        ),
        Text(title, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.w500)),
      ]),
    );
  }

  Widget _buildHealthCard() {
    final services = <Map<String, String>>[
      {'key': 'redis', 'name': 'Redis'},
      {'key': 'database', 'name': 'PostgreSQL'},
      {'key': 'awsS3', 'name': 'AWS S3'},
      {'key': 'twilio', 'name': 'Twilio'},
      {'key': 'razorpay', 'name': 'Razorpay'},
    ];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [BoxShadow(color: Color(0x06000000), blurRadius: 12, offset: Offset(0, 4))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 34, height: 34,
            decoration: const BoxDecoration(color: Color(0xFFECFDF5), shape: BoxShape.circle),
            child: const Icon(Icons.sensors_rounded, color: Color(0xFF059669), size: 18),
          ),
          const SizedBox(width: 10),
          const Text('Live Infrastructure', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 15)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(6)),
            child: const Text('LIVE', style: TextStyle(color: Color(0xFF059669), fontSize: 10, fontWeight: FontWeight.bold)),
          ),
        ]),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: services.map((s) {
            dynamic statusObj = _sysMetrics?['services']?[s['key']];
            String statusStr = 'Connected';
            if (statusObj is String) statusStr = statusObj;
            if (statusObj is Map && statusObj['status'] != null) statusStr = statusObj['status'].toString();
            final isUp = statusStr.toLowerCase() == 'connected' || statusStr.toLowerCase() == 'up';

            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isUp ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: isUp ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 600),
                  width: 7, height: 7,
                  decoration: BoxDecoration(
                    color: isUp ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                    shape: BoxShape.circle,
                    boxShadow: isUp
                        ? [const BoxShadow(color: Color(0x6616A34A), blurRadius: 5, spreadRadius: 1)]
                        : [],
                  ),
                ),
                const SizedBox(width: 6),
                Text(s['name']!, style: TextStyle(color: isUp ? const Color(0xFF15803D) : const Color(0xFFB91C1C), fontSize: 11, fontWeight: FontWeight.bold)),
              ]),
            );
          }).toList(),
        ),
      ]),
    );
  }

  Widget _sectionLabel(String label) {
    return Row(children: [
      Text(label, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16)),
      const Spacer(),
    ]);
  }
}
