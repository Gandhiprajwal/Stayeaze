 import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Layers, Bed, DoorOpen, IndianRupee, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface BatchSpaceGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  buildingId: string;
  buildingName?: string;
  onSuccess?: () => void;
}

const sharingOptions = [
  { value: 'SINGLE', label: 'Single Occupancy (1 Bed)', beds: 1 },
  { value: 'DOUBLE', label: 'Double Sharing (2 Beds)', beds: 2 },
  { value: 'TRIPLE', label: 'Triple Sharing (3 Beds)', beds: 3 },
  { value: 'FOUR_SHARING', label: 'Four Sharing (4 Beds)', beds: 4 },
];

export function BatchSpaceGeneratorDialog({
  open,
  onOpenChange,
  propertyId,
  buildingId,
  buildingName = 'Selected Tower',
  onSuccess,
}: BatchSpaceGeneratorDialogProps) {
  const queryClient = useQueryClient();
  const [startFloor, setStartFloor] = useState(1);
  const [endFloor, setEndFloor] = useState(3);
  const [roomsPerFloor, setRoomsPerFloor] = useState(4);
  const [sharingType, setSharingType] = useState('DOUBLE');
  const [bedsPerRoom, setBedsPerRoom] = useState(2);
  const [baseRent, setBaseRent] = useState(8500);

  const numFloors = Math.max(0, endFloor - startFloor + 1);
  const totalRooms = numFloors * roomsPerFloor;
  const totalBeds = totalRooms * bedsPerRoom;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(
        `/properties/${propertyId}/buildings/${buildingId}/batch-generate-spaces`,
        {
          startFloor,
          endFloor,
          roomsPerFloor,
          sharingType,
          bedsPerRoom,
          baseRent,
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || `Successfully generated spaces in ${buildingName}!`);
      queryClient.invalidateQueries({ queryKey: ['/properties', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['/floors'] });
      queryClient.invalidateQueries({ queryKey: ['/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/beds'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to batch generate spaces.';
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
            <DialogTitle className="text-lg font-bold">Fast Space Generator</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Instantly provision floors, rooms, and numbered beds in <span className="font-semibold text-foreground">{buildingName}</span> in 1 click.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Floor Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" /> Start Floor
              </Label>
              <Input
                type="number"
                min={0}
                max={50}
                value={startFloor}
                onChange={(e) => setStartFloor(Number(e.target.value))}
                className="h-9 text-sm font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" /> End Floor
              </Label>
              <Input
                type="number"
                min={startFloor}
                max={50}
                value={endFloor}
                onChange={(e) => setEndFloor(Number(e.target.value))}
                className="h-9 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Rooms and Beds configuration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" /> Rooms per Floor
              </Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={roomsPerFloor}
                onChange={(e) => setRoomsPerFloor(Number(e.target.value))}
                className="h-9 text-sm font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" /> Base Rent / Bed
              </Label>
              <Input
                type="number"
                min={0}
                step={500}
                value={baseRent}
                onChange={(e) => setBaseRent(Number(e.target.value))}
                className="h-9 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Sharing Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Bed className="h-3.5 w-3.5 text-muted-foreground" /> Sharing Type & Bed Capacity
            </Label>
            <Select
              value={sharingType}
              onValueChange={(val) => {
                setSharingType(val);
                const opt = sharingOptions.find((o) => o.value === val);
                if (opt) setBedsPerRoom(opt.beds);
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sharingOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Live Calculated Metric Summary Card */}
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-300">
              <span>Estimated Provisioning Plan:</span>
              <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] font-mono">
                {numFloors} Floors
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-indigo-100/80 dark:border-indigo-900/30">
              <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Floors</p>
                <p className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">{numFloors}</p>
              </div>
              <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Rooms</p>
                <p className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">{totalRooms}</p>
              </div>
              <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Beds</p>
                <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{totalBeds}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || numFloors <= 0 || totalRooms <= 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Provisioning...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate {totalBeds} Beds
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
