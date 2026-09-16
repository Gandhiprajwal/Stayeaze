import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ScrollText, CheckCircle2, Clock, Eye, Printer, Settings2,
  Check, RefreshCw, Shield, AlertCircle
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { RowActions } from '@/components/common/RowActions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import DigitalAgreementModal from '@/features/tenants/DigitalAgreementModal';
import {
  getMasterAgreementTemplate,
  setMasterAgreementTemplate,
  DEFAULT_MASTER_AGREEMENT_TEMPLATE,
} from '@/lib/agreement-policy';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import api from '@/lib/api';

import { usePropertyStore } from '@/lib/stores/property-store';

export default function AgreementsPage() {
  const queryClient = useQueryClient();
  const { selectedPropertyId } = usePropertyStore();
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [viewAgreementTenant, setViewAgreementTenant] = useState<any | null>(null);

  // Global Master Template State
  const [globalTemplateText, setGlobalTemplateText] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  useEffect(() => {
    setGlobalTemplateText(getMasterAgreementTemplate());
  }, []);

  // Fetch summary stats scoped to active property
  const { data: rawTenants = [] } = useQuery<any[]>({
    queryKey: ['tenants-agreements-stats', selectedPropertyId],
    queryFn: () => {
      const params: any = { pageSize: 500 };
      if (selectedPropertyId && selectedPropertyId !== 'ALL') {
        params.propertyId = selectedPropertyId;
      }
      return api.get('/tenants/minimal', { params }).then((r) => {
        const payload = r.data as any;
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload.data)) return payload.data;
        return [];
      });
    },
  });

  const scopedTenants = (rawTenants || []).filter((t) => {
    if (!selectedPropertyId || selectedPropertyId === 'ALL') return true;
    return String(t.propertyId) === String(selectedPropertyId);
  });

  const totalTenants = scopedTenants.length;
  const signedCount = scopedTenants.filter((t) => t.isAgreementAccepted).length;
  const pendingCount = totalTenants - signedCount;

  const handleSaveGlobalTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalTemplateText.trim()) {
      toast.error('Global agreement template cannot be empty.');
      return;
    }
    setIsSavingTemplate(true);
    setMasterAgreementTemplate(globalTemplateText);
    setTimeout(() => {
      setIsSavingTemplate(false);
      setPolicyDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tenants-agreements-stats'] });
      toast.success(
        'Global Master Agreement Policy saved! All newly onboarded tenants will automatically use this updated agreement.'
      );
    }, 300);
  };

  const handleResetToDefaultTemplate = () => {
    setGlobalTemplateText(DEFAULT_MASTER_AGREEMENT_TEMPLATE);
    setMasterAgreementTemplate(DEFAULT_MASTER_AGREEMENT_TEMPLATE);
    toast.success('Reset to standard recommended PG agreement template.');
  };

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Resident',
      sortable: true,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.name || r.firstName}</div>
          <div className="text-xs text-muted-foreground font-mono">{r.phone || r.mobile || '—'}</div>
        </div>
      ),
    },
    {
      key: 'roomNumber',
      header: 'Allotment',
      sortable: true,
      cell: (r) => (
        <span className="text-sm">
          Room {r.roomNumber || '—'} <span className="text-muted-foreground">· Bed {r.bedNumber || '—'}</span>
        </span>
      ),
    },
    {
      key: 'rent',
      header: 'Monthly Rent',
      sortable: true,
      cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.rent || 0)}</span>,
    },
    {
      key: 'deposit',
      header: 'Deposit',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {formatCurrency(r.deposit || r.securityDeposit || 0)}
        </span>
      ),
    },
    {
      key: 'isAgreementAccepted',
      header: 'Agreement Status',
      sortable: true,
      cell: (r) =>
        r.isAgreementAccepted ? (
          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold gap-1">
            <CheckCircle2 className="h-3 w-3" /> Signed &amp; Active
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50/50 text-xs font-semibold gap-1">
            <Clock className="h-3 w-3" /> Pending Signature
          </Badge>
        ),
    },
    {
      key: 'agreementAcceptedAt',
      header: 'Signed Date',
      sortable: true,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.agreementAcceptedAt ? formatDate(r.agreementAcceptedAt) : '—'}
        </span>
      ),
    },
  ];

  const placeholderTags = [
    { tag: '{{resident_name}}', desc: 'Resident full name' },
    { tag: '{{room_number}}', desc: 'Allocated room number' },
    { tag: '{{bed_number}}', desc: 'Allocated bed identifier' },
    { tag: '{{property_name}}', desc: 'Property title / name' },
    { tag: '{{building_name}}', desc: 'Building wing or block' },
    { tag: '{{monthly_rent}}', desc: 'Agreed monthly rent amount' },
    { tag: '{{security_deposit}}', desc: 'Refundable deposit amount' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Lease & Tenancy Agreements"
        description="Monitor digital lease signatures and configure global tenancy agreement policy."
        icon={ScrollText}
        actions={
          <Button
            onClick={() => setPolicyDialogOpen(true)}
            className="gap-1.5"
          >
            <Settings2 className="h-4 w-4" /> Global Policy Template
          </Button>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Residents"
          value={totalTenants}
          icon={ScrollText}
          hint="Active and upcoming tenancies"
          accent="primary"
        />
        <StatCard
          label="Digitally Signed Agreements"
          value={signedCount}
          icon={CheckCircle2}
          hint="Legally verified e-signatures"
          accent="success"
        />
        <StatCard
          label="Pending Signature / Drafts"
          value={pendingCount}
          icon={Clock}
          hint="Awaiting resident confirmation"
          accent="warning"
        />
      </div>

      {/* Standard DataTable View */}
      <DataTable
        endpoint="/tenants"
        columns={columns}
        searchPlaceholder="Search residents by name, room, phone..."
        exportFilename="tenancy-agreements"
        initialSortBy="name"
        emptyDescription="No resident records found."
        rowActions={(row) => (
          <RowActions
            items={[
              {
                label: 'View & Print Agreement',
                icon: Eye,
                onSelect: () => setViewAgreementTenant(row),
              },
            ]}
          />
        )}
      />

      {/* Global Master Policy Configuration Dialog */}
      <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="border-b pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold">
                    Global Master Lease Agreement &amp; House Rules
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    This master policy automatically applies to all new onboarding residents upon signing.
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 text-xs">
            {/* Informational Policy Banner */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 flex items-start gap-3 text-xs">
              <Shield className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-indigo-900 dark:text-indigo-200 block">
                  Automatic Forward Application with Legal Immutability
                </span>
                <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-0.5 leading-relaxed">
                  When you save updates here, all <strong>newly onboarded residents</strong> will receive the updated clauses. Previously signed resident agreements remain <strong>legally frozen and unaltered</strong> as of their signing timestamp.
                </p>
              </div>
            </div>

            {/* Dynamic Placeholders Tag Box */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Available Dynamic Placeholders (Auto-Replaced during Onboarding)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {placeholderTags.map((p) => (
                  <div
                    key={p.tag}
                    className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px]"
                  >
                    <code className="text-indigo-600 dark:text-indigo-400 font-bold block font-mono">
                      {p.tag}
                    </code>
                    <span className="text-[9px] text-slate-500 block truncate">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Textarea Template Editor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Master Agreement Clauses &amp; Terms *
              </Label>
              <Textarea
                value={globalTemplateText}
                onChange={(e) => setGlobalTemplateText(e.target.value)}
                className="min-h-[280px] font-mono text-[11px] leading-relaxed resize-y rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-inner"
                placeholder="Enter organization master agreement clauses..."
                required
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-2 pt-3 border-t shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefaultTemplate}
              className="rounded-xl h-9 text-xs font-semibold text-slate-600 gap-1 w-full sm:w-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reset Default
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPolicyDialogOpen(false)}
                className="rounded-xl h-9 text-xs font-semibold flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSavingTemplate || !globalTemplateText.trim()}
                onClick={handleSaveGlobalTemplate}
                className="rounded-xl h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs flex-1 sm:flex-none"
              >
                <Check className="h-3.5 w-3.5" />
                {isSavingTemplate ? 'Saving...' : 'Save & Publish Global Policy'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Agreement Modal (using our clean DigitalAgreementModal with isolated print) */}
      {viewAgreementTenant && (
        <DigitalAgreementModal
          open={!!viewAgreementTenant}
          onOpenChange={(o) => !o && setViewAgreementTenant(null)}
          tenant={viewAgreementTenant}
          isOwnerOrManager={true}
        />
      )}
    </div>
  );
}
