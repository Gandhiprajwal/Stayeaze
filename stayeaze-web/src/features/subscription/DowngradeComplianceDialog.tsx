import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Building2, Bed, ArrowDownRight, AlertTriangle, ShieldCheck, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface PropertyItem {
  id: string;
  name: string;
  totalBeds: number;
  status: string;
}

interface DowngradeComplianceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlanName: string;
  targetMaxProperties: number;
  targetMaxBeds: number;
  properties: PropertyItem[];
  onComplianceAchieved: () => void;
}

export const DowngradeComplianceDialog: React.FC<DowngradeComplianceDialogProps> = ({
  open,
  onOpenChange,
  targetPlanName,
  targetMaxProperties,
  targetMaxBeds,
  properties: initialProperties,
  onComplianceAchieved,
}) => {
  const [properties, setProperties] = useState<PropertyItem[]>(initialProperties);
  const [selectedToDeactivate, setSelectedToDeactivate] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync when initialProperties changes
  React.useEffect(() => {
    setProperties(initialProperties);
    setSelectedToDeactivate([]);
  }, [initialProperties]);

  const activeProperties = properties.filter((p) => (p.status || 'ACTIVE').toUpperCase() !== 'INACTIVE');
  const simulatedActiveCount = activeProperties.filter((p) => !selectedToDeactivate.includes(p.id)).length;
  const simulatedActiveBeds = activeProperties
    .filter((p) => !selectedToDeactivate.includes(p.id))
    .reduce((acc, p) => acc + (p.totalBeds || 0), 0);

  const isCompliant = simulatedActiveCount <= targetMaxProperties && simulatedActiveBeds <= targetMaxBeds;

  const toggleSelect = (id: string) => {
    setSelectedToDeactivate((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeactivate = async () => {
    if (selectedToDeactivate.length === 0) {
      toast.error('Please select at least one property to deactivate.');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await api.post('/subscription/deactivate-properties', {
        propertyIds: selectedToDeactivate,
      });
      toast.success(res.data.message || 'Properties deactivated successfully.');
      onOpenChange(false);
      onComplianceAchieved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate selected properties.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Downgrade Quota Compliance Required</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Switching to <span className="font-semibold text-primary">{targetPlanName}</span> requires reducing your active resource count.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Plan Limits Comparison Card */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-muted/40 border border-border/60">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Plan Limits</p>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" />
              <span>Max Properties: <strong>{targetMaxProperties}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bed className="h-4 w-4 text-primary" />
              <span>Max Beds: <strong>{targetMaxBeds}</strong></span>
            </div>
          </div>

          <div className="space-y-1.5 border-l border-border/60 pl-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Active (Simulated)</p>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>
                Properties: <strong className={simulatedActiveCount <= targetMaxProperties ? 'text-emerald-500' : 'text-rose-500'}>{simulatedActiveCount}</strong> / {targetMaxProperties}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bed className="h-4 w-4 text-muted-foreground" />
              <span>
                Beds: <strong className={simulatedActiveBeds <= targetMaxBeds ? 'text-emerald-500' : 'text-rose-500'}>{simulatedActiveBeds}</strong> / {targetMaxBeds}
              </span>
            </div>
          </div>
        </div>

        {/* Explanation Alert */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs flex gap-2.5 items-start">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Deactivating a property retains all historical invoices, payments, and tenant history safely in your records, but locks space generation and new tenant check-ins on that property.
          </p>
        </div>

        {/* Property Selector List */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Select properties to mark INACTIVE:</p>
          <div className="divide-y divide-border/40 border border-border/60 rounded-xl overflow-hidden bg-background">
            {activeProperties.map((p) => {
              const isSelected = selectedToDeactivate.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-amber-500/10 border-l-4 border-l-amber-500' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-input text-amber-600 focus:ring-amber-500 h-4 w-4 pointer-events-none"
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {p.name}
                        {isSelected && (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                            Will Deactivate
                          </Badge>
                        )}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <Bed className="h-3 w-3" /> {p.totalBeds} total beds
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {p.status || 'ACTIVE'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs">
            {isCompliant ? (
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Ready for Downgrade
              </span>
            ) : (
              <span className="text-rose-500 font-semibold flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> Deactivate {Math.max(0, simulatedActiveCount - targetMaxProperties)} more property(s)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              onClick={handleDeactivate}
              disabled={!isCompliant || isProcessing || selectedToDeactivate.length === 0}
            >
              <ShieldCheck className="h-4 w-4" />
              {isProcessing ? 'Deactivating...' : `Deactivate (${selectedToDeactivate.length}) & Proceed`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
