import 'package:flutter/material.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import 'home_tab.dart';
import 'main_screens.dart';
import 'bookings_tab.dart';
import 'payments_tab.dart';
import 'maintenance_tab.dart';
import 'visitors_tab.dart';
import 'reports_tab.dart';
import 'audit_logs_tab.dart';
import 'system_admin_tab.dart';
import 'login_screen.dart';

// Helper to normalize role strings (removes "ROLE_" prefix if present)
String normalizeRole(String rawRole) {
  String r = rawRole.trim().toUpperCase();
  if (r.startsWith('ROLE_')) {
    r = r.substring(5);
  }
  return r;
}

// ─── Nav Item ─────────────────────────────────────────────────────────────────
class _NavItem {
  final String label;
  final String section;
  final IconData icon;
  final IconData activeIcon;
  final Color color;
  final List<String> roles;

  const _NavItem({
    required this.label,
    required this.section,
    required this.icon,
    required this.activeIcon,
    required this.color,
    required this.roles,
  });
}

const _kAllRoles = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_OWNER', 'OWNER', 'PROPERTY_MANAGER', 'MANAGER', 'TENANT', 'STAFF', 'RECEPTIONIST', 'ACCOUNTANT', 'SECURITY_GUARD'];
const _kManagementRoles = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_OWNER', 'OWNER', 'PROPERTY_MANAGER', 'MANAGER'];
const _kOwnerAndSuperAdmin = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_OWNER', 'OWNER'];
const _kSuperAdminOnly = ['SUPER_ADMIN'];

const _kNavDefs = <_NavItem>[
  // Overview
  _NavItem(
    label: 'Overview',
    section: 'Overview',
    icon: Icons.dashboard_outlined,
    activeIcon: Icons.dashboard_rounded,
    color: Color(0xFF4F46E5),
    roles: _kAllRoles,
  ),

  // Operations
  _NavItem(
    label: 'Properties',
    section: 'Operations',
    icon: Icons.domain_outlined,
    activeIcon: Icons.domain_rounded,
    color: Color(0xFF4F46E5),
    roles: _kSuperAdminOnly,
  ),
  _NavItem(
    label: 'Residents',
    section: 'Operations',
    icon: Icons.people_outline_rounded,
    activeIcon: Icons.people_alt_rounded,
    color: Color(0xFF059669),
    roles: _kManagementRoles,
  ),
  _NavItem(
    label: 'Bookings',
    section: 'Operations',
    icon: Icons.calendar_today_outlined,
    activeIcon: Icons.calendar_today_rounded,
    color: Color(0xFF0891B2),
    roles: _kManagementRoles,
  ),

  // Finance
  _NavItem(
    label: 'Invoices',
    section: 'Finance',
    icon: Icons.receipt_long_outlined,
    activeIcon: Icons.receipt_long_rounded,
    color: Color(0xFFD97706),
    roles: _kAllRoles,
  ),
  _NavItem(
    label: 'Payments',
    section: 'Finance',
    icon: Icons.payments_outlined,
    activeIcon: Icons.payments_rounded,
    color: Color(0xFF059669),
    roles: _kManagementRoles,
  ),

  // Facilities
  _NavItem(
    label: 'Helpdesk',
    section: 'Facilities',
    icon: Icons.shield_outlined,
    activeIcon: Icons.shield_rounded,
    color: Color(0xFFDC2626),
    roles: _kAllRoles,
  ),
  _NavItem(
    label: 'Maintenance',
    section: 'Facilities',
    icon: Icons.build_outlined,
    activeIcon: Icons.build_rounded,
    color: Color(0xFFD97706),
    roles: _kAllRoles,
  ),
  _NavItem(
    label: 'Visitors',
    section: 'Facilities',
    icon: Icons.person_pin_outlined,
    activeIcon: Icons.person_pin_rounded,
    color: Color(0xFF0891B2),
    roles: _kAllRoles,
  ),

  // Insights
  _NavItem(
    label: 'Reports',
    section: 'Insights',
    icon: Icons.analytics_outlined,
    activeIcon: Icons.analytics_rounded,
    color: Color(0xFF4F46E5),
    roles: _kManagementRoles,
  ),

  // Administration
  _NavItem(
    label: 'Staff Users',
    section: 'Administration',
    icon: Icons.manage_accounts_outlined,
    activeIcon: Icons.manage_accounts_rounded,
    color: Color(0xFF7C3AED),
    roles: _kOwnerAndSuperAdmin,
  ),
  _NavItem(
    label: 'Audit Logs',
    section: 'Administration',
    icon: Icons.history_outlined,
    activeIcon: Icons.history_rounded,
    color: Color(0xFF64748B),
    roles: _kOwnerAndSuperAdmin,
  ),
  _NavItem(
    label: 'Cloud Infra',
    section: 'Administration',
    icon: Icons.admin_panel_settings_outlined,
    activeIcon: Icons.admin_panel_settings_rounded,
    color: Color(0xFF4F46E5),
    roles: _kSuperAdminOnly,
  ),
];

// ─── DashboardScreen ──────────────────────────────────────────────────────────
class DashboardScreen extends StatefulWidget {
  final UserSession session;
  const DashboardScreen({super.key, required this.session});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  int _selectedIndex = 0;
  bool _expanded = false;

  static const double _kCollapsed = 68.0;
  static const double _kExpanded  = 230.0;

  late List<_NavItem> _items;
  late AnimationController _animCtrl;
  late Animation<double> _widthAnim;

  @override
  void initState() {
    super.initState();
    _items = _filteredItems();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 220));
    _widthAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() { _animCtrl.dispose(); super.dispose(); }

  List<_NavItem> _filteredItems() {
    final role = normalizeRole(widget.session.role);
    final filtered = _kNavDefs.where((item) {
      if (role == 'SUPER_ADMIN') return true; // Super Admin gets full access to all items
      if (item.roles.contains(role)) return true;
      if ((role == 'ADMIN' || role == 'PROPERTY_OWNER' || role == 'OWNER') &&
          (item.roles.contains('ADMIN') || item.roles.contains('PROPERTY_OWNER') || item.roles.contains('OWNER'))) {
        return true;
      }
      if ((role == 'PROPERTY_MANAGER' || role == 'MANAGER') &&
          (item.roles.contains('PROPERTY_MANAGER') || item.roles.contains('MANAGER'))) {
        return true;
      }
      return false;
    }).toList();

    // Fallback: If no match found for unknown role, show all nav items rather than a blank screen
    if (filtered.isEmpty) {
      return _kNavDefs;
    }
    return filtered;
  }

  void _toggle() {
    setState(() => _expanded = !_expanded);
    _expanded ? _animCtrl.forward() : _animCtrl.reverse();
  }

  void _select(int idx) {
    setState(() => _selectedIndex = idx);
    if (_expanded) _toggle();
  }

  Widget _screenFor(int idx) {
    if (idx >= _items.length) return const SizedBox();
    final label = _items[idx].label;
    final s = widget.session;
    switch (label) {
      case 'Overview':    return HomeTab(session: s);
      case 'Properties':  return PropertiesTab(session: s);
      case 'Residents':   return ResidentsTab(session: s);
      case 'Bookings':    return BookingsTab(session: s);
      case 'Payments':    return PaymentsTab(session: s);
      case 'Invoices':    return InvoicesTab(session: s);
      case 'Maintenance': return MaintenanceTab(session: s);
      case 'Helpdesk':    return SecurityTab(session: s);
      case 'Visitors':    return VisitorsTab(session: s);
      case 'Reports':     return ReportsTab(session: s);
      case 'Staff Users': return UsersTab(session: s);
      case 'Audit Logs':  return AuditLogsTab(session: s);
      case 'Cloud Infra': return SystemAdminTab(session: s);
      default:            return HomeTab(session: s);
    }
  }

  LinearGradient get _roleGrad {
    final r = normalizeRole(widget.session.role);
    if (r == 'SUPER_ADMIN')                                      return const LinearGradient(colors: [Color(0xFF6D28D9), Color(0xFF4F46E5)]);
    if (r == 'PROPERTY_OWNER' || r == 'OWNER' || r == 'ADMIN')   return const LinearGradient(colors: [Color(0xFF1D4ED8), Color(0xFF2563EB)]);
    if (r == 'PROPERTY_MANAGER' || r == 'MANAGER')               return const LinearGradient(colors: [Color(0xFF047857), Color(0xFF059669)]);
    return const LinearGradient(colors: [Color(0xFF0E7490), Color(0xFF0891B2)]);
  }

  String get _roleLabel {
    final r = normalizeRole(widget.session.role);
    if (r == 'SUPER_ADMIN') return 'Super Admin';
    if (r == 'PROPERTY_OWNER' || r == 'OWNER' || r == 'ADMIN') return 'Property Owner';
    if (r == 'PROPERTY_MANAGER' || r == 'MANAGER') return 'Manager';
    if (r == 'TENANT') return 'Tenant';
    return r.replaceAll('_', ' ');
  }

  @override
  Widget build(BuildContext context) {
    if (_selectedIndex >= _items.length) _selectedIndex = 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: SafeArea(
        child: Row(
          children: [
            // ── Sidebar ───────────────────────────────────
            AnimatedBuilder(
              animation: _widthAnim,
              builder: (_, __) {
                final w = _kCollapsed + (_kExpanded - _kCollapsed) * _widthAnim.value;
                return _buildSidebar(w);
              },
            ),

            // ── Content ───────────────────────────────────
            Expanded(
              child: Stack(
                children: [
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 250),
                    switchInCurve: Curves.easeOut,
                    child: KeyedSubtree(
                      key: ValueKey(_selectedIndex),
                      child: _screenFor(_selectedIndex),
                    ),
                  ),
                  // Dim overlay when sidebar is expanded
                  if (_expanded)
                    GestureDetector(
                      onTap: _toggle,
                      child: Container(color: Colors.black26),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSidebar(double w) {
    final isExpanded = w > _kCollapsed + 20;

    return Container(
      width: w,
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Color(0x12000000), blurRadius: 16, offset: Offset(3, 0))],
      ),
      child: Column(children: [
        // ── Header ────────────────────────────────────────
        GestureDetector(
          onTap: _toggle,
          child: Container(
            height: 72,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(gradient: _roleGrad),
            child: Row(children: [
              // Avatar
              Container(
                width: 40, height: 40,
                decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
                child: Center(
                  child: Text(
                    widget.session.username.isNotEmpty ? widget.session.username[0].toUpperCase() : 'S',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                  ),
                ),
              ),
              if (isExpanded) ...[
                const SizedBox(width: 10),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(widget.session.username,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(4)),
                      child: Text(
                        _roleLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                )),
                const Icon(Icons.chevron_left_rounded, color: Colors.white70, size: 18),
              ] else ...[
                const Spacer(),
                const Icon(Icons.chevron_right_rounded, color: Colors.white70, size: 18),
              ],
            ]),
          ),
        ),

        // ── Nav Items ─────────────────────────────────────
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(vertical: 6),
            children: [
              ..._buildSections(isExpanded),
              const Divider(color: Color(0xFFF1F5F9), height: 16, indent: 10, endIndent: 10),
              _buildSignOut(isExpanded),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ]),
    );
  }

  List<Widget> _buildSections(bool showLabels) {
    final sections = _items.map((e) => e.section).toSet().toList();
    final widgets = <Widget>[];

    for (final section in sections) {
      if (showLabels) {
        widgets.add(Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 3),
          child: Text(section.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1.1)),
        ));
      } else {
        widgets.add(const SizedBox(height: 8));
      }

      for (int i = 0; i < _items.length; i++) {
        final item = _items[i];
        if (item.section != section) continue;
        final isActive = _selectedIndex == i;
        widgets.add(_NavTile(
          item: item,
          isActive: isActive,
          showLabel: showLabels,
          onTap: () => _select(i),
        ));
      }
    }
    return widgets;
  }

  Widget _buildSignOut(bool showLabel) {
    return GestureDetector(
      onTap: () async {
        final nav = Navigator.of(context);
        await ApiService.clearSession();
        nav.pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(9)),
            child: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 18),
          ),
          if (showLabel) ...[
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Sign Out',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}

// ─── Nav Tile ─────────────────────────────────────────────────────────────────
class _NavTile extends StatefulWidget {
  final _NavItem item;
  final bool isActive;
  final bool showLabel;
  final VoidCallback onTap;

  const _NavTile({required this.item, required this.isActive, required this.showLabel, required this.onTap});

  @override
  State<_NavTile> createState() => _NavTileState();
}

class _NavTileState extends State<_NavTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final color = widget.item.color;
    final active = widget.isActive;

    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: active
              ? color.withValues(alpha: 0.11)
              : _pressed
                  ? const Color(0xFFF8FAFC)
                  : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: active
              ? Border.all(color: color.withValues(alpha: 0.22))
              : null,
        ),
        child: Row(children: [
          // Icon box
          AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: active ? color.withValues(alpha: 0.14) : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(
              active ? widget.item.activeIcon : widget.item.icon,
              color: active ? color : const Color(0xFF64748B),
              size: 18,
            ),
          ),
          if (widget.showLabel) ...[
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                widget.item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: active ? color : const Color(0xFF334155),
                  fontWeight: active ? FontWeight.bold : FontWeight.w500,
                  fontSize: 13,
                ),
              ),
            ),
            if (active)
              Container(
                width: 6, height: 6,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
          ],
        ]),
      ),
    );
  }
}
