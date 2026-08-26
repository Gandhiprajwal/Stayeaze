import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  User, Phone, Mail, IndianRupee, Bed, Building, ShieldCheck,
  CreditCard, Send, ExternalLink, Copy, Check, AlertCircle, FileText
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';

interface Tenant360DrawerProps {
  tenantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Tenant360Drawer({ tenantId, open, onOpenChange }: Tenant360DrawerProps) {
  const navigate = useNavigate();
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['/tenants', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const res = await api.get(`/tenants/${tenantId}`);
      return res.data;
    },
    enabled: Boolean(tenantId) && open,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['/invoices', 'tenant', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const res = await api.get('/invoices', { params: { tenantId } });
      return res.data?.data || (Array.isArray(res.data) ? res.data : []);
    },
    enabled: Boolean(tenantId) && open,
  });

  const pendingInvoices = invoices.filter(
    (inv: any) => inv.status === 'UNPAID' || inv.status === 'OVERDUE' || inv.status === 'PARTIALLY_PAID'
  );

  const totalPendingAmount = pendingInvoices.reduce(
    (sum: number, inv: any) => sum + (Number(inv.amountDue) - Number(inv.amountPaid || 0)),
    0
  );

  function sendWhatsAppReminder() {
    if (!tenant?.mobile) {
      toast.error('No mobile number registered for this tenant.');
      return;
    }
    const cleanPhone = tenant.mobile.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `Hello ${tenant.firstName},\n\nThis is a friendly rent reminder from StayEaze. Your outstanding balance for Room ${tenant.roomNumber || 'N/A'} (Bed ${tenant.bedNumber || 'N/A'}) is ${formatCurrency(totalPendingAmount)}.\n\nPlease clear your pending dues at your earliest convenience.\n\nThank you!`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${msg}`, '_blank');
  }

  function copyPaymentLink() {
    const link = `${window.location.origin}/tenant-portal/billing`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success('Tenant billing link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 bg-background">
        <div className="overflow-y-auto p-6 space-y-6">
          <SheetHeader className="text-left pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {tenant?.firstName?.[0] || 'T'}{tenant?.lastName?.[0] || ''}
                </div>
                <div>
                  <SheetTitle className="text-lg font-bold">
                    {tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Tenant Details'}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{tenant?.mobile || '—'}</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {tenant?.status || 'ACTIVE'}
                    </Badge>
                  </SheetDescription>
                </div>
              </div>
            </div>
          </SheetHeader>

          {isLoading ? (
            <div className="space-y-4 py-8 text-center text-sm text-muted-foreground">
              Loading resident 360 overview...
            </div>
          ) : (
            <div className="space-y-5">
              {/* Space Allocation Card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-primary" /> Space Allocation
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Room:</span>
                    <p className="font-bold text-foreground">{tenant?.roomNumber || 'Unassigned'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bed:</span>
                    <p className="font-bold text-foreground">Bed {tenant?.bedNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monthly Rent:</span>
                    <p className="font-bold text-foreground font-mono">{formatCurrency(tenant?.rent ?? 0)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Advance Balance:</span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(tenant?.advanceBalance ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Financial Outstanding Card */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <IndianRupee className="h-4 w-4 text-amber-600" /> Outstanding Due
                  </span>
                  <span className="text-lg font-extrabold font-mono text-amber-700 dark:text-amber-400">
                    {formatCurrency(totalPendingAmount)}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={sendWhatsAppReminder}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 h-8"
                  >
                    <Send className="h-3.5 w-3.5" /> WhatsApp Reminder
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyPaymentLink}
                    className="text-xs gap-1.5 h-8 border-amber-300 dark:border-amber-800"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy Link
                  </Button>
                </div>
              </div>

              {/* Recent Pending Invoices List */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Pending Invoices ({pendingInvoices.length})
                </p>
                {pendingInvoices.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">No pending unpaid invoices for this resident.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingInvoices.map((inv: any) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-card text-xs"
                      >
                        <div>
                          <p className="font-semibold text-foreground">{inv.invoiceNumber}</p>
                          <p className="text-[10px] text-muted-foreground">Due: {inv.dueDate || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-foreground">{formatCurrency(inv.amountDue)}</p>
                          <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                            {inv.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Emergency Contact</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Name: <span className="font-medium text-foreground">{tenant?.emergencyContactName || '—'}</span></p>
                  <p>Mobile: <span className="font-medium text-foreground">{tenant?.emergencyContactMobile || '—'}</span></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions with 1-Tap Mobile Call & WhatsApp */}
        <div className="p-4 border-t border-border/60 flex items-center justify-between gap-2 bg-muted/20">
          <div className="flex items-center gap-2">
            {tenant?.mobile && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-xl h-9 text-xs font-semibold gap-1.5 border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  <a href={`tel:${tenant.mobile}`}>
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sendWhatsAppReminder}
                  className="rounded-xl h-9 text-xs font-semibold gap-1.5 border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Send className="h-3.5 w-3.5" /> WhatsApp
                </Button>
              </>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => {
              onOpenChange(false);
              navigate(`/tenants/${tenantId}`);
            }}
            className="rounded-xl h-9 text-xs font-bold gap-1.5 shadow-xs"
          >
            Full Profile <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
