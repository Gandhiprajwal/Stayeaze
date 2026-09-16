import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DoorOpen, ArrowRightLeft, ArrowRight, Building2, BedDouble,
  Wallet, ShieldCheck, AlertCircle, CheckCircle2, Receipt,
  Sparkles, FileText, ChevronRight, HelpCircle
} from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/format';
import type { Tenant } from '@/lib/types';
import api from '@/lib/api';

interface RoomTransferWizardModalProps {
  open: boolean;
  onClose: () => void;
  tenant: Tenant;
}

export default function RoomTransferWizardModal({
  open,
  onClose,
  tenant,
}: RoomTransferWizardModalProps) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [targetPropertyId, setTargetPropertyId] = useState<string>(tenant.propertyId || '');
  const [targetRoomNumber, setTargetRoomNumber] = useState<string>('');
  const [targetBedNumber, setTargetBedNumber] = useState<string>('');
  const [targetRent, setTargetRent] = useState<number>(Number(tenant.rent || 0));
  const [targetDeposit, setTargetDeposit] = useState<number>(Number(tenant.deposit || 0));

  // Reset states when tenant changes
  useEffect(() => {
    if (open) {
      setStep(1);
      setTargetPropertyId(tenant.propertyId || '');
      setTargetRoomNumber('');
      setTargetBedNumber('');
      setTargetRent(Number(tenant.rent || 0));
      setTargetDeposit(Number(tenant.deposit || 0));
    }
  }, [open, tenant]);

  // Properties list
  const { data: properties } = useQuery({
    queryKey: ['transfer-properties'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });

  // Rooms for selected property
  const { data: rooms } = useQuery({
    queryKey: ['transfer-rooms', targetPropertyId],
    queryFn: () => api.get<any[]>('/rooms/minimal', { params: { propertyId: targetPropertyId } }).then((r) => {
      const payload = r.data as any;
      if (Array.isArray(payload)) return payload;
      return payload?.data || [];
    }),
    enabled: !!targetPropertyId,
  });

  // Beds for selected room
  const selectedRoomObj = (rooms ?? []).find((r: any) => r.roomNumber === targetRoomNumber || r.id === targetRoomNumber);

  const { data: beds } = useQuery({
    queryKey: ['transfer-beds', selectedRoomObj?.id],
    queryFn: () => api.get<any[]>('/beds/minimal', { params: { roomId: selectedRoomObj?.id } }).then((r) => {
      const payload = r.data as any;
      if (Array.isArray(payload)) return payload;
      return payload?.data || [];
    }),
    enabled: !!selectedRoomObj?.id,
  });

  // Filter available beds (not occupied by someone else)
  const availableBeds = (beds ?? []).filter((b: any) => {
    const status = String(b.status || '').toUpperCase();
    return status === 'AVAILABLE' || status === 'VACANT' || !status;
  });

  // Preview mutation (dry run calculation)
  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/tenants/${tenant.id}/preview-room-transfer`, {
        newPropertyId: targetPropertyId,
        newRoomNumber: selectedRoomObj?.roomNumber || targetRoomNumber,
        newBedNumber: targetBedNumber,
        newRent: targetRent,
        newDeposit: targetDeposit,
      });
      return res.data;
    },
    onSuccess: () => {
      setStep(2);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to calculate transfer reconciliation');
    },
  });

  // Execute transfer mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/tenants/${tenant.id}/transfer-room`, {
        newPropertyId: targetPropertyId,
        newRoomNumber: selectedRoomObj?.roomNumber || targetRoomNumber,
        newBedNumber: targetBedNumber,
        newRent: targetRent,
        newDeposit: targetDeposit,
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || `Successfully transferred ${tenant.name} to Room ${targetRoomNumber}!`);
      queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-invoices', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to complete room transfer');
    },
  });

  const preview = previewMutation.data;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <ArrowRightLeft className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold">Room Transfer Reconciliation Wizard</DialogTitle>
              <DialogDescription className="text-xs">
                {step === 1 ? 'Step 1 of 2: Select new accommodation and rate' : 'Step 2 of 2: Review mid-cycle financial adjustments'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Current Assignment Overview */}
          <div className="rounded-xl bg-muted/40 p-3.5 border flex items-center justify-between text-xs sm:text-sm">
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[11px] uppercase font-bold tracking-wider">Current Room</span>
              <p className="font-bold flex items-center gap-1.5">
                <DoorOpen className="h-3.5 w-3.5 text-primary" />
                Room {tenant.roomNumber || '—'} · Bed {tenant.bedNumber || '—'}
              </p>
            </div>
            <div className="space-y-0.5 text-right">
              <span className="text-muted-foreground text-[11px] uppercase font-bold tracking-wider">Current Rent</span>
              <p className="font-bold text-emerald-600">{formatCurrency(Number(tenant.rent || 0))}/mo</p>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target Property</Label>
                  <Select
                    value={targetPropertyId}
                    onValueChange={(val) => {
                      setTargetPropertyId(val);
                      setTargetRoomNumber('');
                      setTargetBedNumber('');
                    }}
                  >
                    <SelectTrigger className="rounded-xl text-xs">
                      <SelectValue placeholder="Select Property" />
                    </SelectTrigger>
                    <SelectContent>
                      {(properties ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target Room <span className="text-destructive">*</span></Label>
                  <Select
                    value={targetRoomNumber}
                    onValueChange={(val) => {
                      setTargetRoomNumber(val);
                      setTargetBedNumber('');
                      const r = (rooms ?? []).find((rm: any) => rm.roomNumber === val || rm.id === val);
                      if (r && r.rent) setTargetRent(Number(r.rent));
                      if (r && r.deposit) setTargetDeposit(Number(r.deposit));
                    }}
                    disabled={!targetPropertyId}
                  >
                    <SelectTrigger className="rounded-xl text-xs">
                      <SelectValue placeholder="Select Room" />
                    </SelectTrigger>
                    <SelectContent>
                      {(rooms ?? []).map((r: any) => (
                        <SelectItem key={r.id} value={r.roomNumber || r.id}>
                          Room {r.roomNumber} ({r.type || 'Standard'}) — {formatCurrency(Number(r.rent || 0))}/mo
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target Bed <span className="text-destructive">*</span></Label>
                  <Select
                    value={targetBedNumber}
                    onValueChange={setTargetBedNumber}
                    disabled={!targetRoomNumber}
                  >
                    <SelectTrigger className="rounded-xl text-xs">
                      <SelectValue placeholder={availableBeds.length > 0 ? 'Select Bed' : 'No vacant beds'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBeds.map((b: any) => (
                        <SelectItem key={b.id} value={b.bedNumber}>
                          Bed {b.bedNumber} (Vacant)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">New Monthly Rent (₹)</Label>
                  <Input
                    type="number"
                    value={targetRent}
                    onChange={(e) => setTargetRent(Number(e.target.value))}
                    className="rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">New Security Deposit (₹)</Label>
                  <Input
                    type="number"
                    value={targetDeposit}
                    onChange={(e) => setTargetDeposit(Number(e.target.value))}
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && preview && (
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5 text-primary">
                    <Sparkles className="h-4 w-4" /> Reconciliation Plan
                  </span>
                  <Badge
                    variant={preview.isUpgrade ? 'destructive' : preview.isDowngrade ? 'secondary' : 'outline'}
                    className={preview.isDowngrade ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}
                  >
                    {preview.isUpgrade ? 'Room Upgrade' : preview.isDowngrade ? 'Room Downgrade' : 'Lateral Transfer'}
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{preview.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Pro-Rata Days</span>
                  <p className="font-bold text-foreground">
                    {preview.remainingDays} days remaining / {preview.daysInMonth} in cycle
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Pro-Rata Rent Delta</span>
                  <p className="font-bold text-foreground">
                    {preview.isUpgrade ? `+${formatCurrency(preview.proRataDifference)}` : preview.isDowngrade ? `-${formatCurrency(preview.proRataDifference)}` : '₹0'}
                  </p>
                </div>
              </div>

              {preview.depositTopUp > 0 && (
                <div className="flex justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 text-xs">
                  <span>Security Deposit Top-Up:</span>
                  <span className="font-bold">+{formatCurrency(preview.depositTopUp)}</span>
                </div>
              )}

              {preview.actionType === 'UPGRADE_INVOICE' && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 text-xs flex justify-between items-center font-bold">
                  <span>New Delta Invoice to Generate:</span>
                  <span className="text-sm">{formatCurrency(preview.netInvoiceDue)}</span>
                </div>
              )}

              {preview.actionType === 'ADVANCE_CREDIT' && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-blue-900 dark:text-blue-300 text-xs flex justify-between items-center font-bold">
                  <span>Surplus Credited to Resident Wallet:</span>
                  <span className="text-sm">+{formatCurrency(preview.surplusCredit)}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>A legal Room Transfer & Rent Revision Addendum will be auto-generated and signed.</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/20 border-t flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs">
            Cancel
          </Button>

          {step === 1 ? (
            <Button
              size="sm"
              disabled={!targetRoomNumber || !targetBedNumber || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
              className="rounded-xl text-xs font-semibold gap-1.5"
            >
              {previewMutation.isPending ? 'Calculating...' : 'Preview Reconciliation'}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)} className="rounded-xl text-xs">
                Back
              </Button>
              <Button
                size="sm"
                disabled={transferMutation.isPending}
                onClick={() => transferMutation.mutate()}
                className="rounded-xl text-xs font-bold gap-1.5 bg-primary"
              >
                {transferMutation.isPending ? 'Executing Transfer...' : 'Confirm Transfer & Apply'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
