import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import 'main_screens.dart';

class MaintenanceTab extends StatefulWidget {
  final UserSession session;
  const MaintenanceTab({super.key, required this.session});

  @override
  State<MaintenanceTab> createState() => _MaintenanceTabState();
}

class _MaintenanceTabState extends State<MaintenanceTab> {
  List<dynamic> _requests = [];
  bool _loading = true;
  String _searchQuery = '';
  String _filterCategory = 'ALL';

  final List<String> _categories = ['ALL', 'PLUMBING', 'ELECTRICAL', 'CARPENTRY', 'CLEANING', 'PEST_CONTROL', 'OTHER'];

  Future<void> _loadRequests() async {
    try {
      final cached = await ApiService.getMaintenanceRequests(widget.session.token);
      if (cached.isNotEmpty && mounted) {
        setState(() { _requests = cached; _loading = false; });
      }
    } catch (_) {}
    try {
      final fresh = await ApiService.getMaintenanceRequests(widget.session.token, forceRefresh: true);
      if (mounted) setState(() { _requests = fresh; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Color _priorityColor(String priority) {
    switch (priority.toUpperCase()) {
      case 'HIGH': return const Color(0xFFDC2626);
      case 'MEDIUM': return const Color(0xFFD97706);
      default: return const Color(0xFF059669);
    }
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'RESOLVED': return const Color(0xFF059669);
      case 'IN_PROGRESS': return const Color(0xFF4F46E5);
      case 'OPEN': return const Color(0xFFD97706);
      default: return const Color(0xFF64748B);
    }
  }

  IconData _categoryIcon(String category) {
    switch (category.toUpperCase()) {
      case 'PLUMBING': return Icons.water_drop_rounded;
      case 'ELECTRICAL': return Icons.electrical_services_rounded;
      case 'CARPENTRY': return Icons.handyman_rounded;
      case 'CLEANING': return Icons.cleaning_services_rounded;
      case 'PEST_CONTROL': return Icons.bug_report_rounded;
      default: return Icons.build_rounded;
    }
  }

  Future<void> _showRequestDialog({Map<String, dynamic>? existing}) async {
    final titleCtrl = TextEditingController(text: existing?['title'] ?? '');
    final descCtrl = TextEditingController(text: existing?['description'] ?? '');
    String selectedCategory = existing?['category'] ?? 'PLUMBING';
    String selectedPriority = existing?['priority'] ?? 'MEDIUM';
    String selectedStatus = existing?['status'] ?? 'OPEN';

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx2, setS) => ModalSheetWidget(
          title: existing != null ? 'Update Request' : 'New Request',
          icon: Icons.add_task_rounded,
          color: const Color(0xFFD97706),
          fields: [
            ModalSheetField(ctrl: titleCtrl, label: 'Title / Issue', hint: 'e.g. Leaking pipe in Room 101'),
            ModalSheetField(ctrl: descCtrl, label: 'Description', hint: 'Detailed description of the issue...'),
          ],
          extraWidgets: [
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: selectedCategory,
              dropdownColor: Colors.white,
              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
              decoration: const InputDecoration(labelText: 'Category'),
              items: const [
                DropdownMenuItem(value: 'PLUMBING', child: Text('Plumbing')),
                DropdownMenuItem(value: 'ELECTRICAL', child: Text('Electrical')),
                DropdownMenuItem(value: 'CARPENTRY', child: Text('Carpentry')),
                DropdownMenuItem(value: 'CLEANING', child: Text('Cleaning')),
                DropdownMenuItem(value: 'PEST_CONTROL', child: Text('Pest Control')),
                DropdownMenuItem(value: 'OTHER', child: Text('Other')),
              ],
              onChanged: (v) { if (v != null) setS(() => selectedCategory = v); },
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: selectedPriority,
              dropdownColor: Colors.white,
              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
              decoration: const InputDecoration(labelText: 'Priority'),
              items: const [
                DropdownMenuItem(value: 'HIGH', child: Text('High')),
                DropdownMenuItem(value: 'MEDIUM', child: Text('Medium')),
                DropdownMenuItem(value: 'LOW', child: Text('Low')),
              ],
              onChanged: (v) { if (v != null) setS(() => selectedPriority = v); },
            ),
            if (existing != null) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: selectedStatus,
                dropdownColor: Colors.white,
                style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
                decoration: const InputDecoration(labelText: 'Status'),
                items: const [
                  DropdownMenuItem(value: 'OPEN', child: Text('Open')),
                  DropdownMenuItem(value: 'IN_PROGRESS', child: Text('In Progress')),
                  DropdownMenuItem(value: 'RESOLVED', child: Text('Resolved')),
                ],
                onChanged: (v) { if (v != null) setS(() => selectedStatus = v); },
              ),
            ],
          ],
          onSave: () async {
            final body = {
              'title': titleCtrl.text.trim(),
              'description': descCtrl.text.trim(),
              'category': selectedCategory,
              'priority': selectedPriority,
              'status': selectedStatus,
            };
            if (existing != null) {
              await ApiService.updateMaintenanceRequest(widget.session.token, existing['id'].toString(), body);
            } else {
              await ApiService.createMaintenanceRequest(widget.session.token, body);
            }
            _loadRequests();
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _requests.where((r) {
      final title = r['title']?.toString().toLowerCase() ?? '';
      final category = r['category']?.toString().toUpperCase() ?? '';
      final q = _searchQuery.toLowerCase();
      final matchesSearch = title.contains(q);
      final matchesCategory = _filterCategory == 'ALL' || category == _filterCategory;
      return matchesSearch && matchesCategory;
    }).toList();

    final openCount = _requests.where((r) => r['status']?.toString().toUpperCase() == 'OPEN').length;
    final resolvedCount = _requests.where((r) => r['status']?.toString().toUpperCase() == 'RESOLVED').length;

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: ModernAppBarWidget(
        title: 'Maintenance',
        icon: Icons.build_rounded,
        color: const Color(0xFFD97706),
        count: _requests.length,
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFD97706),
        icon: const Icon(Icons.add_task_rounded, color: Colors.white),
        label: const Text('New Request', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () => _showRequestDialog(),
      ),
      body: _loading && _requests.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(children: [
                  Expanded(child: MiniStatCardWidget(label: 'Open', value: openCount.toString(), color: const Color(0xFFD97706), icon: Icons.pending_actions_rounded)),
                  const SizedBox(width: 10),
                  Expanded(child: MiniStatCardWidget(label: 'Resolved', value: resolvedCount.toString(), color: const Color(0xFF059669), icon: Icons.check_circle_rounded)),
                ]),
              ),
              SearchBarWidget(
                hint: 'Search maintenance requests...',
                color: const Color(0xFFD97706),
                onChanged: (v) => setState(() => _searchQuery = v),
              ),
              FilterChipsWidget(
                options: _categories,
                selected: _filterCategory,
                color: const Color(0xFFD97706),
                onSelected: (v) => setState(() => _filterCategory = v),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _loadRequests,
                  child: filtered.isEmpty
                      ? const EmptyStateWidget(label: 'No maintenance requests found.', icon: Icons.build_outlined)
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                          itemCount: filtered.length,
                          itemBuilder: (ctx, i) {
                            final r = filtered[i];
                            final priority = r['priority']?.toString() ?? 'MEDIUM';
                            final status = r['status']?.toString() ?? 'OPEN';
                            final category = r['category']?.toString() ?? 'OTHER';
                            final pColor = _priorityColor(priority);
                            final sColor = _statusColor(status);

                            return AnimatedCardWidget(
                              index: i,
                              child: GestureDetector(
                                onTap: () => _showRequestDialog(existing: Map<String, dynamic>.from(r)),
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(18),
                                    border: Border.all(color: priority.toUpperCase() == 'HIGH' ? const Color(0xFFFECACA) : const Color(0xFFE2E8F0)),
                                    boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
                                  ),
                                  child: Row(children: [
                                    Container(
                                      width: 46, height: 46,
                                      decoration: BoxDecoration(color: pColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                                      child: Icon(_categoryIcon(category), color: pColor, size: 22),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(r['title'] ?? 'Maintenance Request', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                                          if (r['description'] != null) ...[
                                            const SizedBox(height: 2),
                                            Text(r['description'], maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                                          ],
                                          const SizedBox(height: 6),
                                          Row(children: [
                                            StatusBadgeWidget(label: priority.toUpperCase(), color: pColor),
                                            const SizedBox(width: 6),
                                            StatusBadgeWidget(label: status.replaceAll('_', ' '), color: sColor),
                                          ]),
                                        ],
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
