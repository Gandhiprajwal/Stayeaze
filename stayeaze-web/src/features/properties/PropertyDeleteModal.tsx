import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle, Archive, Trash2, Download, Building2, DoorClosed,
  BedDouble, Users, ShieldAlert, CreditCard, CheckCircle2, RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';
import type { Property } from '@/lib/types';
import { toast } from 'sonner';

interface PropertyDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  fallbackActiveTenants?: number;
  fallbackBuildings?: number;
  fallbackRooms?: number;
  fallbackBeds?: number;
  onSuccess: () => void;
}

export function PropertyDeleteModal({
  open,
  onOpenChange,
  property,
  fallbackActiveTenants = 0,
  fallbackBuildings = 0,
  fallbackRooms = 0,
  fallbackBeds = 0,
  onSuccess,
}: PropertyDeleteModalProps) {
  const [selectedTab, setSelectedTab] = useState<'archive' | 'purge'>('archive');
  const [autoArchiveTenants, setAutoArchiveTenants] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch real-time pre-delete summary
  const { data: summary, isLoading: summaryLoading, refetch } = useQuery({
    queryKey: ['property-pre-delete-summary', property.id],
    queryFn: () => api.get<any>(`/properties/${property.id}/pre-delete-summary`).then((r) => r.data),
    enabled: open && !!property.id,
  });

  useEffect(() => {
    if (open) {
      setConfirmName('');
      setAutoArchiveTenants(false);
      setSelectedTab('archive');
      refetch();
    }
  }, [open, refetch]);

  const activeTenantsCount = (summary?.activeTenantsCount !== undefined && summary?.activeTenantsCount > 0)
    ? summary.activeTenantsCount
    : (fallbackActiveTenants > 0 ? fallbackActiveTenants : (property?.occupiedBeds ?? 0));

  const totalBuildingsCount = (summary?.totalBuildings !== undefined && summary?.totalBuildings > 0)
    ? summary.totalBuildings
    : (fallbackBuildings > 0 ? fallbackBuildings : (property?.totalBuildings ?? 0));

  const totalRoomsCount = (summary?.totalRooms !== undefined && summary?.totalRooms > 0)
    ? summary.totalRooms
    : (fallbackRooms > 0 ? fallbackRooms : (property?.totalRooms ?? 0));

  const totalBedsCount = (summary?.totalBeds !== undefined && summary?.totalBeds > 0)
    ? summary.totalBeds
    : (fallbackBeds > 0 ? fallbackBeds : (property?.totalBeds ?? 0));

  const isNameMatched = confirmName.trim().toLowerCase() === property.name.trim().toLowerCase();
  const canPurge = isNameMatched && (activeTenantsCount === 0 || autoArchiveTenants);

  // Download snapshot JSON
  async function handleDownloadSnapshot() {
    try {
      setDownloading(true);
      const res = await api.get(`/properties/${property.id}/export-snapshot`);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `property_${property.name.replace(/\s+/g, '_')}_backup.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Property data snapshot downloaded successfully!');
    } catch (err: any) {
      toast.error('Failed to export snapshot: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  }

  // Handle Cascade Archive
  async function handleArchive() {
    try {
      setLoading(true);
      await api.put(`/properties/${property.id}/archive`);
      toast.success(`Property "${property.name}" and its spaces have been archived.`);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to archive property');
    } finally {
      setLoading(false);
    }
  }

  // Handle Permanent Purge
  async function handlePurge() {
    if (!canPurge) return;
    try {
      setLoading(true);
      await api.delete(`/properties/${property.id}/permanent`, {
        params: { autoArchiveTenants },
      });
      toast.success(`Property "${property.name}" and all associated assets have been permanently purged.`);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to permanently purge property');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Manage Property Deletion & Archival</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Choose between safe deactivation (soft-archive) or permanent data purge for <strong>{property.name}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Pre-flight Stats Overview */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Property Impact Summary</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSnapshot}
              disabled={downloading}
              className="h-7 text-xs gap-1.5 font-medium border-primary/30 text-primary hover:bg-primary/5"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? 'Exporting...' : 'Download Backup (JSON)'}
            </Button>
          </div>

          {summaryLoading ? (
            <div className="grid grid-cols-4 gap-2">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col">
                <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Residents</span>
                <span className="text-base font-bold mt-1">{activeTenantsCount} Active</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col">
                <span className="text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Buildings</span>
                <span className="text-base font-bold mt-1">{summary?.totalBuildings ?? 0}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col">
                <span className="text-muted-foreground flex items-center gap-1.5"><DoorClosed className="h-3.5 w-3.5" /> Rooms</span>
                <span className="text-base font-bold mt-1">{summary?.totalRooms ?? 0}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col">
                <span className="text-muted-foreground flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5" /> Total Beds</span>
                <span className="text-base font-bold mt-1">{totalBedsCount}</span>
              </div>
            </div>
          )}

          {summary?.totalPropertiesInOrg === 1 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> This is currently your organization's only property. Deleting or archiving it will leave your property dashboard empty until you create a new one.
              </div>
            </div>
          )}

          {summary?.hasCustomRazorpay && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span>Dedicated Razorpay payment gateway credentials linked with this property will be deleted.</span>
            </div>
          )}
        </div>

        {/* Action Choice Tabs */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setSelectedTab('archive')}
            className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
              selectedTab === 'archive'
                ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Archive className="h-4 w-4 text-primary" />
              <span>Archive Property</span>
            </div>
            <span className="text-xs text-muted-foreground mt-1">
              Safely deactivates buildings & rooms while preserving all financial & tenant history for tax audits. Restore anytime.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTab('purge')}
            className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
              selectedTab === 'purge'
                ? 'border-destructive ring-2 ring-destructive/20 bg-destructive/5'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold text-sm text-destructive">
              <Trash2 className="h-4 w-4" />
              <span>Permanent Purge</span>
            </div>
            <span className="text-xs text-muted-foreground mt-1">
              Permanently purges the property, buildings, rooms, beds, bookings, and logs from PostgreSQL forever.
            </span>
          </button>
        </div>

        {/* Content based on Tab */}
        {selectedTab === 'archive' ? (
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-2.5 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              What happens during Cascade Archival:
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Property status changes to <strong>ARCHIVED</strong>.</li>
              <li>All child Buildings, Floors, Rooms, and Beds are deactivated.</li>
              <li>Staff & Property Managers are unassigned from this property ID.</li>
              <li>Financial records, invoices, payment history, and tenant ledgers are 100% preserved.</li>
              <li>Can be <strong>reactivated/restored</strong> back to Active with 1 click.</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-3.5 border-t pt-3">
            {/* Active Tenants Guardrail */}
            {activeTenantsCount > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-2">
                <div className="flex items-start gap-2 font-bold">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    Safety Guard: Property has {activeTenantsCount} active resident(s)!
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-destructive/90">
                  You must check out or reassign active residents before permanent purge, OR check the box below to automatically check them out and clear bed assignments now.
                </p>
                <div className="flex items-center space-x-2 pt-1 border-t border-destructive/20">
                  <Checkbox
                    id="autoArchive"
                    checked={autoArchiveTenants}
                    onCheckedChange={(c) => setAutoArchiveTenants(!!c)}
                  />
                  <Label htmlFor="autoArchive" className="text-xs font-semibold cursor-pointer">
                    Auto-archive and checkout active residents before permanent purge
                  </Label>
                </div>
              </div>
            )}

            {/* Type to Confirm Safeguard */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                To confirm permanent purge, type <span className="font-bold text-destructive font-mono select-all">"{property.name}"</span> below:
              </Label>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={property.name}
                className="h-10 text-xs font-medium"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t mt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-9 px-4 text-xs font-medium"
          >
            Cancel
          </Button>

          {selectedTab === 'archive' ? (
            <Button
              type="button"
              onClick={handleArchive}
              disabled={loading}
              className="h-9 px-4 text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Archive className="h-4 w-4" />
              {loading ? 'Archiving...' : 'Archive Property'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={handlePurge}
              disabled={loading || !canPurge}
              className="h-9 px-4 text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'Purging Everything...' : 'Permanently Purge Property & All Data'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
