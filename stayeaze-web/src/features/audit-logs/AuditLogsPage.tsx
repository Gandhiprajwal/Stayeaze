import { ScrollText, Download, Filter, Terminal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api';
import type { AuditLog } from '@/lib/types';
import { formatDateTime, initials, exportToCSV } from '@/lib/format';
import { roleLabels } from '@/lib/role-utils';
import { useAuthStore } from '@/lib/stores/auth-store';

const ENDPOINT = '/audit-logs';
const modules = [
  { value: 'auth', label: 'Auth' }, { value: 'property', label: 'Property' }, { value: 'tenant', label: 'Tenant' },
  { value: 'booking', label: 'Booking' }, { value: 'billing', label: 'Billing' }, { value: 'payment', label: 'Payment' },
  { value: 'complaint', label: 'Complaint' }, { value: 'maintenance', label: 'Maintenance' },
  { value: 'user', label: 'User' }, { value: 'role', label: 'Role' },
];
const actions = [
  { value: 'LOGIN', label: 'Login' }, { value: 'CREATE', label: 'Create' }, { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' }, { value: 'EXPORT', label: 'Export' }, { value: 'STATUS_CHANGE', label: 'Status Change' },
];

export default function AuditLogsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data: logs } = useQuery({
    queryKey: ['audit-summary'],
    queryFn: () => api.get<{ data: AuditLog[] }>(ENDPOINT, { params: { pageSize: 100, sortBy: 'timestamp', sortOrder: 'desc' } }).then((r) => r.data.data),
  });

  const columns: Column<AuditLog>[] = [
    { key: 'timestamp', header: 'Timestamp', sortable: true, cell: (r) => <span className="text-sm">{formatDateTime(r.timestamp)}</span> },
    { key: 'user', header: 'User', sortable: true, cell: (r) => (
      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7"><AvatarFallback className="bg-muted text-[10px] font-semibold">{initials(r.user)}</AvatarFallback></Avatar>
        <div><p className="text-sm font-medium">{r.user}</p><p className="text-xs text-muted-foreground">{roleLabels[r.userRole]}</p></div>
      </div>
    )},
    { key: 'action', header: 'Action', sortable: true, cell: (r) => <StatusBadge status={r.action} tone={r.action === 'DELETE' ? 'destructive' : r.action === 'CREATE' ? 'success' : r.action === 'LOGIN' ? 'info' : 'neutral'} /> },
    { key: 'module', header: 'Module', sortable: true, cell: (r) => <span className="text-sm capitalize">{r.module}</span> },
    { key: 'entityId', header: 'Entity', cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.entityId}</span> },
    { key: 'details', header: 'Details', cell: (r) => <span className="line-clamp-1 max-w-[220px] text-sm text-muted-foreground">{r.details}</span> },
    { key: 'ipAddress', header: 'IP Address', cell: (r) => <span className="font-mono text-xs">{r.ipAddress}</span> },
  ];

  function exportLogs() {
    exportToCSV('audit-logs', logs ?? []);
  }

  return (
    <div className="space-y-6 pb-12 sm:pb-6">
      <PageHeader
        title="Audit Logs"
        description="Immutable record of all user actions across the console."
        icon={ScrollText}
        actions={
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            {isSuperAdmin && (
              <Button asChild variant="default" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9.5 text-xs font-bold shadow-xs flex-1 sm:flex-none">
                <Link to="/super-admin/system-logs">
                  <Terminal className="mr-1.5 h-3.5 w-3.5" /> Live Backend Server Logs
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={exportLogs} className="rounded-xl h-9.5 text-xs font-semibold shrink-0">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export Logs
            </Button>
          </div>
        }
      />

      <Card className="rounded-2xl border-dashed bg-muted/20 shadow-xs">
        <CardContent className="flex items-center gap-3 p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
            <Filter className="h-5 w-5" />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Audit logs are retained for compliance. Use the filters to narrow down by module, action, or date range.
          </p>
        </CardContent>
      </Card>

      <DataTable
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Search by user, action or entity..."
        exportFilename="audit-logs"
        initialSortBy="timestamp"
        filters={[
          { key: 'module', label: 'Module', options: modules },
          { key: 'action', label: 'Action', options: actions },
        ]}
      />
    </div>
  );
}
