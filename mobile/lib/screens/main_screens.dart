import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';

class PropertiesTab extends StatefulWidget {
  final UserSession session;
  const PropertiesTab({super.key, required this.session});
  @override
  State<PropertiesTab> createState() => _PropertiesTabState();
}

class _PropertiesTabState extends State<PropertiesTab> with SingleTickerProviderStateMixin {
  List<dynamic> _properties = [];
  bool _loading = true;
  String _searchQuery = '';
  late AnimationController _animCtrl;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _load();
  }

  @override
  void dispose() { _animCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final cached = await ApiService.getProperties(widget.session.token);
      if (cached.isNotEmpty && mounted) { setState(() { _properties = cached; _loading = false; }); _animCtrl.forward(from: 0); }
    } catch (_) {}
    try {
      final fresh = await ApiService.getProperties(widget.session.token, forceRefresh: true);
      if (mounted) { setState(() { _properties = fresh; _loading = false; }); _animCtrl.forward(from: 0); }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _showPropertyDialog({Map<String, dynamic>? existing}) async {
    final nameCtrl = TextEditingController(text: existing?['name'] ?? '');
    final addressCtrl = TextEditingController(text: existing?['address'] ?? '');
    final totalBedsCtrl = TextEditingController(text: (existing?['totalBeds'] ?? '').toString());
    final rentCtrl = TextEditingController(text: (existing?['baseRent'] ?? '').toString());
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ModalSheetWidget(
        title: existing != null ? 'Edit Property' : 'Add New Property',
        icon: Icons.domain_rounded,
        color: const Color(0xFF4F46E5),
        fields: [
          ModalSheetField(ctrl: nameCtrl, label: 'Property Name', hint: 'Sunrise PG Homes'),
          ModalSheetField(ctrl: addressCtrl, label: 'Address', hint: '123 MG Road, Bengaluru'),
          ModalSheetField(ctrl: totalBedsCtrl, label: 'Total Beds', hint: '20', isNumber: true),
          ModalSheetField(ctrl: rentCtrl, label: 'Base Rent (₹)', hint: '8000', isNumber: true),
        ],
        onSave: () async {
          await ApiService.createProperty(widget.session.token, {
            'name': nameCtrl.text.trim(),
            'address': addressCtrl.text.trim(),
            'totalBeds': int.tryParse(totalBedsCtrl.text) ?? 0,
            'baseRent': int.tryParse(rentCtrl.text) ?? 0,
          });
          _load();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _properties.where((p) => (p['name']?.toString().toLowerCase() ?? '').contains(_searchQuery.toLowerCase())).toList();
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: ModernAppBarWidget(title: 'Properties', icon: Icons.domain_rounded, color: const Color(0xFF4F46E5), count: _properties.length),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF4F46E5),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Add Property', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () => _showPropertyDialog(),
      ),
      body: _loading && _properties.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              SearchBarWidget(hint: 'Search properties...', color: const Color(0xFF4F46E5), onChanged: (v) => setState(() => _searchQuery = v)),
              Expanded(
                child: RefreshIndicator(onRefresh: _load, child: filtered.isEmpty
                    ? const EmptyStateWidget(label: 'No properties found', icon: Icons.domain_outlined)
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                        itemCount: filtered.length,
                        itemBuilder: (ctx, i) {
                          final p = filtered[i];
                          final total = p['totalBeds'] ?? p['totalRooms'] ?? 0;
                          final occupied = p['occupiedBeds'] ?? p['occupiedRooms'] ?? 0;
                          final pct = total > 0 ? occupied / total : 0.0;
                          return AnimatedCardWidget(
                            index: i,
                            child: GestureDetector(
                              onTap: () => _showPropertyDialog(existing: Map<String, dynamic>.from(p)),
                              child: Container(
                                padding: const EdgeInsets.all(18),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                  boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
                                ),
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Row(children: [
                                    Container(width: 46, height: 46,
                                      decoration: BoxDecoration(
                                        gradient: const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF4F46E5)]),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: const Icon(Icons.domain_rounded, color: Colors.white, size: 22),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Text(p['name'] ?? 'Property', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
                                      Text(p['address'] ?? 'Address not set', maxLines: 1, overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                                    ])),
                                    StatusBadgeWidget(
                                      label: '${(pct * 100).toStringAsFixed(0)}% Full',
                                      color: pct > 0.8 ? const Color(0xFFDC2626) : pct > 0.5 ? const Color(0xFFD97706) : const Color(0xFF059669),
                                    ),
                                  ]),
                                  const SizedBox(height: 14),
                                  Row(children: [
                                    InfoPillWidget(icon: Icons.bed_rounded, label: '$total Beds', color: const Color(0xFF4F46E5)),
                                    const SizedBox(width: 8),
                                    InfoPillWidget(icon: Icons.people_rounded, label: '$occupied Occupied', color: const Color(0xFF059669)),
                                    if (p['baseRent'] != null) ...[
                                      const SizedBox(width: 8),
                                      InfoPillWidget(icon: Icons.currency_rupee_rounded, label: '${p['baseRent']}/mo', color: const Color(0xFFD97706)),
                                    ],
                                  ]),
                                  const SizedBox(height: 12),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: pct.clamp(0.0, 1.0),
                                      backgroundColor: const Color(0xFFF1F5F9),
                                      valueColor: AlwaysStoppedAnimation<Color>(pct > 0.8 ? const Color(0xFFDC2626) : const Color(0xFF4F46E5)),
                                      minHeight: 6,
                                    ),
                                  ),
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

// ── Residents ────────────────────────────────────────────────────────────────
class ResidentsTab extends StatefulWidget {
  final UserSession session;
  const ResidentsTab({super.key, required this.session});
  @override
  State<ResidentsTab> createState() => _ResidentsTabState();
}

class _ResidentsTabState extends State<ResidentsTab> {
  List<dynamic> _residents = [];
  bool _loading = true;
  String _searchQuery = '';
  String _filterStatus = 'ALL';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final d = await ApiService.getTenants(widget.session.token);
      if (d.isNotEmpty && mounted) setState(() { _residents = d; _loading = false; });
    } catch (_) {}
    try {
      final d = await ApiService.getTenants(widget.session.token, forceRefresh: true);
      if (mounted) setState(() { _residents = d; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _showDialog({Map<String, dynamic>? e}) async {
    final nameCtrl = TextEditingController(text: e?['name'] ?? e?['fullName'] ?? '');
    final emailCtrl = TextEditingController(text: e?['email'] ?? '');
    final phoneCtrl = TextEditingController(text: e?['phone'] ?? e?['mobileNumber'] ?? '');
    final rentCtrl = TextEditingController(text: (e?['monthlyRent'] ?? '').toString());
    await showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (ctx) => ModalSheetWidget(
        title: e != null ? 'Edit Resident' : 'Check-In Resident',
        icon: Icons.person_add_rounded, color: const Color(0xFF059669),
        fields: [
          ModalSheetField(ctrl: nameCtrl, label: 'Full Name', hint: 'Alex Morgan'),
          ModalSheetField(ctrl: emailCtrl, label: 'Email', hint: 'alex@example.com'),
          ModalSheetField(ctrl: phoneCtrl, label: 'Phone', hint: '+919876543210'),
          ModalSheetField(ctrl: rentCtrl, label: 'Monthly Rent (₹)', hint: '8000', isNumber: true),
        ],
        onSave: () async {
          await ApiService.createTenant(widget.session.token, {
            'name': nameCtrl.text.trim(),
            'email': emailCtrl.text.trim(),
            'phone': phoneCtrl.text.trim(),
            'monthlyRent': int.tryParse(rentCtrl.text) ?? 0,
            'checkInDate': DateTime.now().toIso8601String().split('T')[0],
          });
          _load();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _residents.where((r) {
      final name = (r['name'] ?? r['fullName'] ?? '').toString().toLowerCase();
      final matchQ = name.contains(_searchQuery.toLowerCase());
      final status = (r['status'] ?? 'ACTIVE').toString().toUpperCase();
      final matchF = _filterStatus == 'ALL' || status == _filterStatus;
      return matchQ && matchF;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: ModernAppBarWidget(title: 'Residents', icon: Icons.people_alt_rounded, color: const Color(0xFF059669), count: _residents.length),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF059669),
        icon: const Icon(Icons.person_add_rounded, color: Colors.white),
        label: const Text('Check-In', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () => _showDialog(),
      ),
      body: _loading && _residents.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              SearchBarWidget(hint: 'Search residents...', color: const Color(0xFF059669), onChanged: (v) => setState(() => _searchQuery = v)),
              FilterChipsWidget(
                options: const ['ALL', 'ACTIVE', 'CHECKED_OUT', 'INACTIVE'],
                selected: _filterStatus,
                color: const Color(0xFF059669),
                onSelected: (v) => setState(() => _filterStatus = v),
              ),
              Expanded(
                child: RefreshIndicator(onRefresh: _load, child: filtered.isEmpty
                    ? const EmptyStateWidget(label: 'No residents found', icon: Icons.people_outline_rounded)
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                        itemCount: filtered.length,
                        itemBuilder: (ctx, i) {
                          final r = filtered[i];
                          final name = r['name'] ?? r['fullName'] ?? 'Resident';
                          final status = (r['status'] ?? 'ACTIVE').toString().toUpperCase();
                          final initial = name.isNotEmpty ? name[0].toUpperCase() : 'R';
                          final colors = [const Color(0xFF4F46E5), const Color(0xFF059669), const Color(0xFF0891B2), const Color(0xFFD97706), const Color(0xFF7C3AED)];
                          final avatarColor = colors[i % colors.length];
                          return AnimatedCardWidget(
                            index: i,
                            child: GestureDetector(
                              onTap: () => _showDialog(e: Map<String, dynamic>.from(r)),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white, borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                  boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
                                ),
                                child: Row(children: [
                                  CircleAvatar(
                                    radius: 24, backgroundColor: avatarColor.withValues(alpha: 0.15),
                                    child: Text(initial, style: TextStyle(color: avatarColor, fontWeight: FontWeight.bold, fontSize: 18)),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                                    const SizedBox(height: 3),
                                    Row(children: [
                                      if (r['email'] != null) ...[
                                        const Icon(Icons.email_outlined, size: 12, color: Color(0xFF94A3B8)),
                                        const SizedBox(width: 3),
                                        Expanded(child: Text(r['email'], maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12))),
                                      ],
                                    ]),
                                    const SizedBox(height: 4),
                                    Row(children: [
                                      if (r['phone'] != null || r['mobileNumber'] != null) InfoPillWidget(icon: Icons.phone_rounded, label: r['phone'] ?? r['mobileNumber'], color: const Color(0xFF0891B2)),
                                      const SizedBox(width: 6),
                                      if (r['monthlyRent'] != null) InfoPillWidget(icon: Icons.currency_rupee_rounded, label: '${r['monthlyRent']}/mo', color: const Color(0xFF059669)),
                                    ]),
                                  ])),
                                  StatusBadgeWidget(
                                    label: status.replaceAll('_', ' '),
                                    color: status == 'ACTIVE' ? const Color(0xFF059669) : status == 'CHECKED_OUT' ? const Color(0xFF64748B) : const Color(0xFFDC2626),
                                  ),
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

// ── Invoices ─────────────────────────────────────────────────────────────────
class InvoicesTab extends StatefulWidget {
  final UserSession session;
  const InvoicesTab({super.key, required this.session});
  @override
  State<InvoicesTab> createState() => _InvoicesTabState();
}

class _InvoicesTabState extends State<InvoicesTab> {
  List<dynamic> _invoices = [];
  bool _loading = true;
  String _searchQuery = '';
  String _filterStatus = 'ALL';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final d = await ApiService.getInvoices(widget.session.token);
      if (d.isNotEmpty && mounted) setState(() { _invoices = d; _loading = false; });
    } catch (_) {}
    try {
      final d = await ApiService.getInvoices(widget.session.token, forceRefresh: true);
      if (mounted) setState(() { _invoices = d; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _showDialog() async {
    final tenantCtrl = TextEditingController();
    final amtCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    await showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (ctx) => ModalSheetWidget(
        title: 'Create Invoice', icon: Icons.receipt_long_rounded, color: const Color(0xFFD97706),
        fields: [
          ModalSheetField(ctrl: tenantCtrl, label: 'Tenant Name / ID', hint: 'Alex Morgan'),
          ModalSheetField(ctrl: amtCtrl, label: 'Amount (₹)', hint: '8000', isNumber: true),
          ModalSheetField(ctrl: descCtrl, label: 'Description', hint: 'Monthly rent - August 2026'),
        ],
        onSave: () async {
          await ApiService.createInvoice(widget.session.token, {
            'tenantName': tenantCtrl.text.trim(),
            'amount': double.tryParse(amtCtrl.text) ?? 0,
            'description': descCtrl.text.trim(),
            'issueDate': DateTime.now().toIso8601String().split('T')[0],
            'dueDate': DateTime.now().add(const Duration(days: 30)).toIso8601String().split('T')[0],
            'status': 'UNPAID',
          });
          _load();
        },
      ),
    );
  }

  double get _paidTotal => _invoices.where((i) => (i['status']?.toString().toUpperCase() ?? '') == 'PAID').fold(0.0, (s, i) => s + (i['amount'] ?? i['totalAmount'] ?? 0).toDouble());
  double get _unpaidTotal => _invoices.where((i) => (i['status']?.toString().toUpperCase() ?? '') == 'UNPAID').fold(0.0, (s, i) => s + (i['amount'] ?? i['totalAmount'] ?? 0).toDouble());

  @override
  Widget build(BuildContext context) {
    final filtered = _invoices.where((inv) {
      final name = (inv['tenantName'] ?? '').toString().toLowerCase();
      final status = (inv['status'] ?? '').toString().toUpperCase();
      return name.contains(_searchQuery.toLowerCase()) && (_filterStatus == 'ALL' || status == _filterStatus);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: ModernAppBarWidget(title: 'Invoices', icon: Icons.receipt_long_rounded, color: const Color(0xFFD97706), count: _invoices.length),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFD97706),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('New Invoice', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: _showDialog,
      ),
      body: _loading && _invoices.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(children: [
                  Expanded(child: MiniStatCardWidget(label: 'Collected', value: '₹${_paidTotal.toStringAsFixed(0)}', color: const Color(0xFF059669), icon: Icons.check_circle_rounded)),
                  const SizedBox(width: 10),
                  Expanded(child: MiniStatCardWidget(label: 'Pending Dues', value: '₹${_unpaidTotal.toStringAsFixed(0)}', color: const Color(0xFFDC2626), icon: Icons.pending_rounded)),
                ]),
              ),
              SearchBarWidget(hint: 'Search invoices...', color: const Color(0xFFD97706), onChanged: (v) => setState(() => _searchQuery = v)),
              FilterChipsWidget(options: const ['ALL', 'PAID', 'UNPAID', 'OVERDUE'], selected: _filterStatus, color: const Color(0xFFD97706), onSelected: (v) => setState(() => _filterStatus = v)),
              Expanded(
                child: RefreshIndicator(onRefresh: _load, child: filtered.isEmpty
                    ? const EmptyStateWidget(label: 'No invoices found', icon: Icons.receipt_outlined)
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                        itemCount: filtered.length,
                        itemBuilder: (ctx, i) {
                          final inv = filtered[i];
                          final status = (inv['status'] ?? 'UNPAID').toString().toUpperCase();
                          final isPaid = status == 'PAID';
                          final amount = inv['amount'] ?? inv['totalAmount'] ?? 0;
                          return AnimatedCardWidget(
                            index: i,
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white, borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: isPaid ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0)),
                                boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
                              ),
                              child: Row(children: [
                                Container(width: 46, height: 46,
                                  decoration: BoxDecoration(
                                    color: isPaid ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(isPaid ? Icons.check_circle_rounded : Icons.receipt_long_rounded,
                                      color: isPaid ? const Color(0xFF059669) : const Color(0xFFD97706), size: 22),
                                ),
                                const SizedBox(width: 12),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(inv['tenantName'] ?? 'Tenant', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                                  if (inv['description'] != null)
                                    Text(inv['description'], maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                                  const SizedBox(height: 4),
                                  Row(children: [
                                    if (inv['dueDate'] != null) InfoPillWidget(icon: Icons.calendar_today_rounded, label: inv['dueDate'], color: const Color(0xFF64748B)),
                                  ]),
                                ])),
                                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                  Text('₹$amount', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: Color(0xFF0F172A))),
                                  const SizedBox(height: 4),
                                  StatusBadgeWidget(
                                    label: status,
                                    color: isPaid ? const Color(0xFF059669) : status == 'OVERDUE' ? const Color(0xFFDC2626) : const Color(0xFFD97706),
                                  ),
                                ]),
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

// ── Security / Helpdesk ───────────────────────────────────────────────────────
class SecurityTab extends StatefulWidget {
  final UserSession session;
  const SecurityTab({super.key, required this.session});
  @override
  State<SecurityTab> createState() => _SecurityTabState();
}

class _SecurityTabState extends State<SecurityTab> {
  List<dynamic> _complaints = [];
  bool _loading = true;
  String _searchQuery = '';
  String _filterStatus = 'ALL';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final d = await ApiService.getComplaints(widget.session.token);
      if (d.isNotEmpty && mounted) setState(() { _complaints = d; _loading = false; });
    } catch (_) {}
    try {
      final d = await ApiService.getComplaints(widget.session.token, forceRefresh: true);
      if (mounted) setState(() { _complaints = d; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _showDialog() async {
    final tenantNameCtrl = TextEditingController();
    final roomCtrl = TextEditingController();
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    List<dynamic> tenants = [];
    try {
      tenants = await ApiService.getTenants(widget.session.token);
    } catch (_) {}

    if (!mounted) return;

    await showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx2, setS) => ModalSheetWidget(
          title: 'New Complaint / Ticket', icon: Icons.report_problem_rounded, color: const Color(0xFFDC2626),
          fields: [
            ModalSheetField(ctrl: tenantNameCtrl, label: 'Resident / Tenant Name', hint: 'Alex Morgan'),
            ModalSheetField(ctrl: roomCtrl, label: 'Room Number', hint: '101'),
            ModalSheetField(ctrl: titleCtrl, label: 'Subject / Issue', hint: 'Water leakage in room 101'),
            ModalSheetField(ctrl: descCtrl, label: 'Description', hint: 'Detailed description of the issue...'),
          ],
          extraWidgets: [
            if (tenants.isNotEmpty) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                dropdownColor: Colors.white,
                style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13),
                decoration: const InputDecoration(
                  labelText: 'Select Active Registered Tenant',
                  hintText: 'Search tenant by Name, Phone (+91), Room #, or Email...',
                  prefixIcon: Icon(Icons.person_search_rounded, color: Color(0xFFDC2626), size: 20),
                ),
                items: tenants.where((t) {
                  final s = (t['status'] ?? 'ACTIVE').toString().toUpperCase();
                  return s == 'ACTIVE' || s == 'CHECKED_IN' || s == 'OCCUPIED';
                }).map((t) {
                  final name = t['name'] ?? t['fullName'] ?? 'Resident';
                  final phone = (t['phone'] ?? t['mobileNumber'] ?? '').toString();
                  final rawRoom = (t['roomNumber'] ?? t['room'] ?? '').toString();
                  final roomStr = rawRoom.replaceAll(RegExp(r'^(room\s*)+', caseSensitive: false), '').trim();
                  final email = (t['email'] ?? '').toString();
                  final display = '$name ${phone.isNotEmpty ? "($phone)" : ""}${roomStr.isNotEmpty ? " — Room $roomStr" : ""}${email.isNotEmpty ? " <$email>" : ""}';
                  return DropdownMenuItem<String>(
                    value: t['id']?.toString() ?? name.toString(),
                    child: Text(display, maxLines: 1, overflow: TextOverflow.ellipsis),
                  );
                }).toList(),
                onChanged: (val) {
                  final selected = tenants.firstWhere((t) => (t['id']?.toString() ?? (t['name'] ?? t['fullName'])) == val, orElse: () => null);
                  if (selected != null) {
                    setS(() {
                      tenantNameCtrl.text = selected['name'] ?? selected['fullName'] ?? '';
                      roomCtrl.text = (selected['roomNumber'] ?? selected['room'] ?? '').toString();
                    });
                  }
                },
              ),
            ],
          ],
          onSave: () async {
            await ApiService.createComplaint(widget.session.token, {
              'tenantName': tenantNameCtrl.text.trim(),
              'roomNumber': roomCtrl.text.trim(),
              'title': titleCtrl.text.trim(),
              'description': descCtrl.text.trim(),
              'status': 'OPEN',
            });
            _load();
          },
        ),
      ),
    );
  }

  IconData _catIcon(String cat) {
    final c = cat.toUpperCase();
    if (c.contains('WATER') || c.contains('PLUMB')) return Icons.water_drop_rounded;
    if (c.contains('ELECT')) return Icons.electrical_services_rounded;
    if (c.contains('SECU')) return Icons.shield_rounded;
    if (c.contains('CLEAN')) return Icons.cleaning_services_rounded;
    return Icons.report_problem_rounded;
  }

  void _showDetails(dynamic c) {
    final status = (c['status'] ?? 'OPEN').toString().toUpperCase();
    final category = (c['category'] ?? c['type'] ?? 'GENERAL').toString();
    final title = (c['title'] ?? c['subject'] ?? 'Complaint').toString();
    final desc = (c['description'] ?? 'No description provided.').toString();
    final tenant = (c['tenantName'] ?? c['tenant'] ?? 'Resident').toString();
    final room = (c['roomNumber'] ?? c['room'] ?? '').toString();
    final staff = (c['assignedTo'] ?? c['assignedStaff'] ?? 'Unassigned').toString();
    final date = (c['createdAt'] ?? '').toString().split('T')[0];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Row(children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(14)),
                child: Icon(_catIcon(category), color: const Color(0xFFDC2626), size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                Text('$category Issue ${date.isNotEmpty ? "• $date" : ""}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              ])),
              StatusBadgeWidget(
                label: status.replaceAll('_', ' '),
                color: status == 'RESOLVED' ? const Color(0xFF059669) : status == 'IN_PROGRESS' ? const Color(0xFF4F46E5) : const Color(0xFFDC2626),
              ),
            ]),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Column(children: [
                Row(children: [
                  const Icon(Icons.person_rounded, size: 16, color: Color(0xFF64748B)),
                  const SizedBox(width: 6),
                  const Text('Tenant:', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  const SizedBox(width: 6),
                  Text(tenant, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                  if (room.isNotEmpty) ...[
                    const Spacer(),
                    const Icon(Icons.meeting_room_rounded, size: 16, color: Color(0xFF64748B)),
                    const SizedBox(width: 4),
                    Text('Room $room', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFDC2626))),
                  ],
                ]),
                const Divider(height: 16),
                Row(children: [
                  const Icon(Icons.assignment_ind_rounded, size: 16, color: Color(0xFF64748B)),
                  const SizedBox(width: 6),
                  const Text('Assigned Staff:', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  const SizedBox(width: 6),
                  Text(staff, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                ]),
              ]),
            ),
            const SizedBox(height: 16),
            const Text('Description', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(14)),
              child: Text(desc, style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.5)),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F172A),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Close', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final open = _complaints.where((c) => (c['status'] ?? '').toString().toUpperCase() == 'OPEN').length;
    final resolved = _complaints.where((c) => (c['status'] ?? '').toString().toUpperCase() == 'RESOLVED').length;

    final filtered = _complaints.where((c) {
      final title = (c['title'] ?? c['subject'] ?? '').toString().toLowerCase();
      final status = (c['status'] ?? '').toString().toUpperCase();
      return title.contains(_searchQuery.toLowerCase()) && (_filterStatus == 'ALL' || status == _filterStatus);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: ModernAppBarWidget(title: 'Helpdesk', icon: Icons.shield_rounded, color: const Color(0xFFDC2626), count: _complaints.length),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFDC2626),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Raise Ticket', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: _showDialog,
      ),
      body: _loading && _complaints.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(children: [
                  Expanded(child: MiniStatCardWidget(label: 'Open Tickets', value: open.toString(), color: const Color(0xFFDC2626), icon: Icons.warning_rounded)),
                  const SizedBox(width: 10),
                  Expanded(child: MiniStatCardWidget(label: 'Resolved', value: resolved.toString(), color: const Color(0xFF059669), icon: Icons.check_circle_rounded)),
                ]),
              ),
              SearchBarWidget(hint: 'Search complaints...', color: const Color(0xFFDC2626), onChanged: (v) => setState(() => _searchQuery = v)),
              FilterChipsWidget(options: const ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'], selected: _filterStatus, color: const Color(0xFFDC2626), onSelected: (v) => setState(() => _filterStatus = v)),
              Expanded(
                child: RefreshIndicator(onRefresh: _load, child: filtered.isEmpty
                    ? const EmptyStateWidget(label: 'No complaints found', icon: Icons.shield_outlined)
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                        itemCount: filtered.length,
                        itemBuilder: (ctx, i) {
                          final c = filtered[i];
                          final status = (c['status'] ?? 'OPEN').toString().toUpperCase();
                          final category = c['category'] ?? c['type'] ?? 'GENERAL';
                          Color sColor = status == 'RESOLVED' ? const Color(0xFF059669) : status == 'IN_PROGRESS' ? const Color(0xFF4F46E5) : const Color(0xFFDC2626);
                          Color sBg = status == 'RESOLVED' ? const Color(0xFFECFDF5) : status == 'IN_PROGRESS' ? const Color(0xFFEEF2FF) : const Color(0xFFFEF2F2);
                          return AnimatedCardWidget(
                            index: i,
                            child: InkWell(
                              onTap: () => _showDetails(c),
                              borderRadius: BorderRadius.circular(18),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white, borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: sBg),
                                  boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
                                ),
                                child: Row(children: [
                                  Container(width: 46, height: 46,
                                    decoration: BoxDecoration(color: sBg, borderRadius: BorderRadius.circular(12)),
                                    child: Icon(_catIcon(category), color: sColor, size: 22),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(c['title'] ?? c['subject'] ?? 'Complaint', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                                    if (c['description'] != null)
                                      Text(c['description'], maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12, height: 1.4)),
                                    const SizedBox(height: 6),
                                    Row(children: [
                                      StatusBadgeWidget(label: status.replaceAll('_', ' '), color: sColor),
                                      if (c['createdAt'] != null) ...[
                                        const SizedBox(width: 8),
                                        Text(c['createdAt'].toString().split('T')[0], style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                                      ],
                                    ]),
                                  ])),
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

// ── Users / Staff ─────────────────────────────────────────────────────────────
class UsersTab extends StatefulWidget {
  final UserSession session;
  const UsersTab({super.key, required this.session});
  @override
  State<UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends State<UsersTab> {
  List<dynamic> _users = [];
  bool _loading = true;
  String _searchQuery = '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final d = await ApiService.getUsers(widget.session.token);
      if (d.isNotEmpty && mounted) setState(() { _users = d; _loading = false; });
    } catch (_) {}
    try {
      final d = await ApiService.getUsers(widget.session.token, forceRefresh: true);
      if (mounted) setState(() { _users = d; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _showDialog() async {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    String selectedRole = 'PROPERTY_MANAGER';
    await showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(builder: (ctx2, setS) => ModalSheetWidget(
        title: 'Add Staff Member', icon: Icons.person_add_rounded, color: const Color(0xFF7C3AED),
        fields: [
          ModalSheetField(ctrl: nameCtrl, label: 'Full Name', hint: 'Priya Sharma'),
          ModalSheetField(ctrl: emailCtrl, label: 'Email Address', hint: 'priya@example.com'),
          ModalSheetField(ctrl: passCtrl, label: 'Password', hint: '••••••••', isPassword: true),
        ],
        extraWidgets: [
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: selectedRole,
            dropdownColor: Colors.white,
            decoration: const InputDecoration(labelText: 'Role'),
            style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
            items: const [
              DropdownMenuItem(value: 'SUPER_ADMIN', child: Text('Super Admin')),
              DropdownMenuItem(value: 'PROPERTY_OWNER', child: Text('Property Owner')),
              DropdownMenuItem(value: 'PROPERTY_MANAGER', child: Text('Property Manager')),
              DropdownMenuItem(value: 'SECURITY', child: Text('Security')),
            ],
            onChanged: (v) { if (v != null) setS(() => selectedRole = v); },
          ),
        ],
        onSave: () async {
          await ApiService.createUser(widget.session.token, {
            'name': nameCtrl.text.trim(),
            'email': emailCtrl.text.trim(),
            'password': passCtrl.text,
            'role': selectedRole,
          });
          _load();
        },
      )),
    );
  }

  Color _roleColor(String role) {
    final r = role.toUpperCase();
    if (r.contains('SUPER')) return const Color(0xFF7C3AED);
    if (r.contains('OWNER')) return const Color(0xFF2563EB);
    if (r.contains('MANAGER')) return const Color(0xFF059669);
    if (r.contains('SECURITY')) return const Color(0xFFDC2626);
    return const Color(0xFF64748B);
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _users.where((u) {
      final name = (u['name'] ?? u['username'] ?? '').toString().toLowerCase();
      final email = (u['email'] ?? '').toString().toLowerCase();
      final q = _searchQuery.toLowerCase();
      return name.contains(q) || email.contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: ModernAppBarWidget(title: 'Staff Users', icon: Icons.manage_accounts_rounded, color: const Color(0xFF7C3AED), count: _users.length),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF7C3AED),
        icon: const Icon(Icons.person_add_rounded, color: Colors.white),
        label: const Text('Add Staff', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: _showDialog,
      ),
      body: _loading && _users.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              SearchBarWidget(hint: 'Search staff...', color: const Color(0xFF7C3AED), onChanged: (v) => setState(() => _searchQuery = v)),
              Expanded(
                child: RefreshIndicator(onRefresh: _load, child: filtered.isEmpty
                    ? const EmptyStateWidget(label: 'No staff users found', icon: Icons.manage_accounts_outlined)
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                        itemCount: filtered.length,
                        itemBuilder: (ctx, i) {
                          final u = filtered[i];
                          final name = u['name'] ?? u['username'] ?? 'User';
                          final role = u['role'] ?? 'STAFF';
                          final initial = name.isNotEmpty ? name[0].toUpperCase() : 'U';
                          final rc = _roleColor(role);
                          return AnimatedCardWidget(
                            index: i,
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white, borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
                              ),
                              child: Row(children: [
                                Container(width: 46, height: 46,
                                  decoration: BoxDecoration(gradient: LinearGradient(colors: [rc, rc.withValues(alpha: 0.7)]), borderRadius: BorderRadius.circular(12)),
                                  child: Center(child: Text(initial, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20))),
                                ),
                                const SizedBox(width: 12),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                                  if (u['email'] != null) Text(u['email'], style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                                ])),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(color: rc.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8), border: Border.all(color: rc.withValues(alpha: 0.25))),
                                  child: Text(role.replaceAll('_', ' '), style: TextStyle(color: rc, fontSize: 11, fontWeight: FontWeight.bold)),
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

// ════════════════════════════════════════════════════════════════════════════
//  SHARED PUBLIC WIDGETS
// ════════════════════════════════════════════════════════════════════════════

// ── Modern AppBar ─────────────────────────────────────────────────────────────
class ModernAppBarWidget extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final IconData icon;
  final Color color;
  final int count;
  const ModernAppBarWidget({super.key, required this.title, required this.icon, required this.color, this.count = 0});

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      titleSpacing: 0,
      title: Row(children: [
        const SizedBox(width: 8),
        Container(width: 36, height: 36, decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: color, size: 20)),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF0F172A)),
          ),
        ),
        if (count > 0) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: Text('$count', style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12)),
          ),
          const SizedBox(width: 8),
        ],
      ]),
      bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: const Color(0xFFF1F5F9))),
    );
  }
}

// ── Search Bar ────────────────────────────────────────────────────────────────
class SearchBarWidget extends StatelessWidget {
  final String hint;
  final Color color;
  final ValueChanged<String> onChanged;
  const SearchBarWidget({super.key, required this.hint, required this.color, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      child: TextField(
        onChanged: onChanged,
        style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
          prefixIcon: Icon(Icons.search_rounded, color: color, size: 20),
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: color, width: 1.5)),
        ),
      ),
    );
  }
}

// ── Filter Chips ──────────────────────────────────────────────────────────────
class FilterChipsWidget extends StatelessWidget {
  final List<String> options;
  final String selected;
  final Color color;
  final ValueChanged<String> onSelected;
  const FilterChipsWidget({super.key, required this.options, required this.selected, required this.color, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    return SizedBox(height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (ctx, i) {
          final opt = options[i];
          final isSelected = selected == opt;
          return GestureDetector(
            onTap: () => onSelected(opt),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? color : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isSelected ? color : const Color(0xFFE2E8F0)),
                boxShadow: isSelected ? [BoxShadow(color: color.withValues(alpha: 0.25), blurRadius: 6, offset: const Offset(0, 2))] : [],
              ),
              child: Text(opt.replaceAll('_', ' '),
                  style: TextStyle(color: isSelected ? Colors.white : const Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          );
        },
      ),
    );
  }
}

// ── Status Badge ──────────────────────────────────────────────────────────────
class StatusBadgeWidget extends StatelessWidget {
  final String label;
  final Color color;
  const StatusBadgeWidget({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 120),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6), border: Border.all(color: color.withValues(alpha: 0.25))),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}

// ── Info Pill ─────────────────────────────────────────────────────────────────
class InfoPillWidget extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const InfoPillWidget({super.key, required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 160),
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: color, size: 11),
        const SizedBox(width: 3),
        Flexible(
          child: Text(
            label.toString(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
          ),
        ),
      ]),
    );
  }
}

// ── Mini Stat Card ────────────────────────────────────────────────────────────
class MiniStatCardWidget extends StatelessWidget {
  final String label, value;
  final Color color;
  final IconData icon;
  const MiniStatCardWidget({super.key, required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600),
            ),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value, style: TextStyle(color: color, fontSize: 17, fontWeight: FontWeight.w800)),
            ),
          ]),
        ),
      ]),
    );
  }
}


// ── Empty State ───────────────────────────────────────────────────────────────
class EmptyStateWidget extends StatelessWidget {
  final String label;
  final IconData icon;
  const EmptyStateWidget({super.key, required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(width: 72, height: 72, decoration: const BoxDecoration(color: Color(0xFFF1F5F9), shape: BoxShape.circle),
          child: Icon(icon, size: 36, color: const Color(0xFFCBD5E1))),
        const SizedBox(height: 14),
        Text(label, style: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600, fontSize: 15)),
        const SizedBox(height: 4),
        const Text('Pull down to refresh', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
      ]),
    );
  }
}

// ── Animated Card ─────────────────────────────────────────────────────────────
class AnimatedCardWidget extends StatelessWidget {
  final Widget child;
  final int index;
  const AnimatedCardWidget({super.key, required this.child, required this.index});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      duration: Duration(milliseconds: 300 + index * 50),
      tween: Tween(begin: 0.0, end: 1.0),
      builder: (ctx, val, child) => Opacity(
        opacity: val.clamp(0.0, 1.0),
        child: Transform.translate(offset: Offset(0, 20 * (1 - val)), child: child),
      ),
      child: Padding(padding: const EdgeInsets.only(bottom: 12), child: child),
    );
  }
}

// ── Modal Bottom Sheet ────────────────────────────────────────────────────────
class ModalSheetField {
  final TextEditingController ctrl;
  final String label, hint;
  final bool isNumber, isPassword;
  const ModalSheetField({required this.ctrl, required this.label, required this.hint, this.isNumber = false, this.isPassword = false});
}

class ModalSheetWidget extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final List<ModalSheetField> fields;
  final List<Widget> extraWidgets;
  final VoidCallback onSave;
  const ModalSheetWidget({super.key, required this.title, required this.icon, required this.color, required this.fields, this.extraWidgets = const [], required this.onSave});


  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: 16),
        Row(children: [
          Container(width: 40, height: 40, decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20)),
          const SizedBox(width: 12),
          Text(title, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 18)),
        ]),
        const SizedBox(height: 20),
        ...fields.map((f) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextField(
            controller: f.ctrl,
            obscureText: f.isPassword,
            keyboardType: f.isNumber ? TextInputType.number : TextInputType.text,
            style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
            decoration: InputDecoration(labelText: f.label, hintText: f.hint, hintStyle: const TextStyle(color: Color(0xFF94A3B8))),
          ),
        )),
        ...extraWidgets,
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, child: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: color, padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          onPressed: () async {
            final nav = Navigator.of(context);
            try { onSave(); } catch (_) {}
            nav.pop();
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved successfully!')));
            }
          },
          child: const Text('Save', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        )),
      ]),
    );
  }
}

