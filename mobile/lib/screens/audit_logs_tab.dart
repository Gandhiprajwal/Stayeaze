import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import 'main_screens.dart';

class AuditLogsTab extends StatefulWidget {
  final UserSession session;
  const AuditLogsTab({super.key, required this.session});

  @override
  State<AuditLogsTab> createState() => _AuditLogsTabState();
}

class _AuditLogsTabState extends State<AuditLogsTab> {
  List<dynamic> _logs = [];
  bool _loading = true;
  String _searchQuery = '';

  Future<void> _loadLogs() async {
    try {
      final cached = await ApiService.getAuditLogs(widget.session.token);
      if (cached.isNotEmpty && mounted) {
        setState(() { _logs = cached; _loading = false; });
      }
    } catch (_) {}
    try {
      final fresh = await ApiService.getAuditLogs(widget.session.token, forceRefresh: true);
      if (mounted) setState(() { _logs = fresh; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  void initState() {
    super.initState();
    _loadLogs();
  }

  IconData _actionIcon(String action) {
    final a = action.toUpperCase();
    if (a.contains('CREATE') || a.contains('POST')) return Icons.add_circle_outline_rounded;
    if (a.contains('UPDATE') || a.contains('PUT')) return Icons.edit_rounded;
    if (a.contains('DELETE')) return Icons.delete_outline_rounded;
    if (a.contains('LOGIN')) return Icons.login_rounded;
    if (a.contains('LOGOUT')) return Icons.logout_rounded;
    return Icons.history_rounded;
  }

  Color _actionColor(String action) {
    final a = action.toUpperCase();
    if (a.contains('CREATE') || a.contains('POST') || a.contains('LOGIN')) return const Color(0xFF059669);
    if (a.contains('DELETE') || a.contains('LOGOUT')) return const Color(0xFFDC2626);
    if (a.contains('UPDATE') || a.contains('PUT')) return const Color(0xFFD97706);
    return const Color(0xFF4F46E5);
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _logs.where((log) {
      final action = log['action']?.toString().toLowerCase() ?? '';
      final user = log['performedBy']?.toString().toLowerCase() ?? log['username']?.toString().toLowerCase() ?? '';
      final q = _searchQuery.toLowerCase();
      return action.contains(q) || user.contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: ModernAppBarWidget(
        title: 'Audit Logs',
        icon: Icons.history_rounded,
        color: const Color(0xFF64748B),
        count: _logs.length,
      ),
      body: _loading && _logs.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              SearchBarWidget(
                hint: 'Search by action or user...',
                color: const Color(0xFF64748B),
                onChanged: (v) => setState(() => _searchQuery = v),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _loadLogs,
                  child: filtered.isEmpty
                      ? const EmptyStateWidget(label: 'No audit logs available.', icon: Icons.history_outlined)
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                          itemCount: filtered.length,
                          itemBuilder: (ctx, i) {
                            final log = filtered[i];
                            final action = log['action']?.toString() ?? 'System Event';
                            final user = log['performedBy']?.toString() ?? log['username']?.toString() ?? 'System';
                            final timestamp = log['timestamp']?.toString() ?? log['createdAt']?.toString() ?? '';
                            final entity = log['entityType']?.toString() ?? log['resource']?.toString() ?? '';
                            final aColor = _actionColor(action);

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
                                    decoration: BoxDecoration(color: aColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                                    child: Icon(_actionIcon(action), color: aColor, size: 22),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          action.replaceAll('_', ' '),
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A)),
                                        ),
                                        const SizedBox(height: 4),
                                        Row(children: [
                                          InfoPillWidget(icon: Icons.person_outline_rounded, label: user, color: const Color(0xFF4F46E5)),
                                          if (entity.isNotEmpty) ...[
                                            const SizedBox(width: 6),
                                            InfoPillWidget(icon: Icons.folder_outlined, label: entity, color: const Color(0xFF64748B)),
                                          ],
                                        ]),
                                        if (timestamp.isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          Text(timestamp.length > 19 ? timestamp.substring(0, 19) : timestamp, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                                        ],
                                      ],
                                    ),
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
