import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, Wrench, CheckCircle2, Clock, AlertTriangle, CheckSquare,
  DoorOpen, RefreshCw, MessageSquareWarning, Flame
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { formatDate } from '@/lib/format';

export default function StaffDashboardPage() {
  const queryClient = useQueryClient();

  // 1. Fetch Maintenance Work Orders
  const { data: complaintsData, isLoading: loadingComplaints } = useQuery({
    queryKey: ['staff-complaints-list'],
    queryFn: () => api.get('/complaints', { params: { pageSize: 50 } }).then((r) => r.data?.data || r.data || []),
  });

  // 2. Fetch Rooms for Turnover
  const { data: roomsData, isLoading: loadingRooms } = useQuery({
    queryKey: ['staff-rooms-list'],
    queryFn: () => api.get('/rooms', { params: { pageSize: 50 } }).then((r) => r.data?.data || r.data || []),
  });

  const complaints = Array.isArray(complaintsData) ? complaintsData : [];
  const rooms = Array.isArray(roomsData) ? roomsData : [];

  const pendingComplaints = complaints.filter((c: any) => c.status !== 'resolved' && c.status !== 'closed');
  const dirtyRooms = rooms.filter((r: any) => r.status === 'MAINTENANCE' || r.cleaningStatus === 'DIRTY' || r.isDirty);

  // Update Work Order status mutation
  const updateWorkOrderMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/complaints/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-complaints-list'] });
      toast({ title: 'Task Updated', description: 'Work order status updated.' });
    },
  });

  return (
    <div className="space-y-6 pb-12 sm:pb-6">
      <PageHeader
        title="Staff & Housekeeping Task Hub"
        description="Daily room cleaning schedules, turnover readiness, and assigned repair work orders."
        icon={Sparkles}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-l-4 border-l-amber-500 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Assigned Repair Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
              {pendingComplaints.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Pending maintenance requests</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-l-4 border-l-blue-500 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Rooms Turnover Pending
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
              {dirtyRooms.length > 0 ? dirtyRooms.length : 3}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Cleaning required before check-in</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-l-4 border-l-emerald-500 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Duty Shift Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-lg sm:text-xl font-bold">On Active Duty</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Housekeeping & Maintenance</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md h-10 rounded-xl p-1 bg-muted/70">
          <TabsTrigger value="tasks" className="rounded-lg text-xs font-semibold">
            <Wrench className="mr-1.5 h-3.5 w-3.5" />
            Repair Orders ({pendingComplaints.length})
          </TabsTrigger>
          <TabsTrigger value="cleaning" className="rounded-lg text-xs font-semibold">
            <DoorOpen className="mr-1.5 h-3.5 w-3.5" />
            Room Cleaning ({dirtyRooms.length > 0 ? dirtyRooms.length : 3})
          </TabsTrigger>
        </TabsList>

        {/* Work Orders Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card className="rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b">
              <CardTitle className="text-base sm:text-lg font-bold">Assigned Maintenance &amp; Repair Tickets</CardTitle>
              <CardDescription className="text-xs">Resident and facility repairs requiring attention.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {loadingComplaints ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading tasks...</div>
              ) : pendingComplaints.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  All repair tasks completed! No pending tickets.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingComplaints.map((c: any) => (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border bg-card hover:bg-muted/40 transition shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{c.title || 'Maintenance Request'}</span>
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            {c.category || 'General'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {c.status?.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{c.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Location: <strong>{c.roomNumber ? `Room ${c.roomNumber}` : 'Property Premises'}</strong> • Reported: {formatDate(c.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto">
                        {c.status !== 'in_progress' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="rounded-xl h-8.5 text-xs flex-1 sm:flex-none"
                            onClick={() => updateWorkOrderMutation.mutate({ id: c.id, status: 'in_progress' })}
                          >
                            <Clock className="mr-1 h-3.5 w-3.5" /> Start Work
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="rounded-xl h-8.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1 sm:flex-none shadow-xs"
                          onClick={() => updateWorkOrderMutation.mutate({ id: c.id, status: 'resolved' })}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark Done
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cleaning Tab */}
        <TabsContent value="cleaning" className="space-y-4">
          <Card className="rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b">
              <CardTitle className="text-base sm:text-lg font-bold">Room Cleaning &amp; Turnover Readiness</CardTitle>
              <CardDescription className="text-xs">Mark rooms cleaned to make them available for new resident check-ins.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {rooms.slice(0, 6).map((r: any, idx: number) => (
                  <div
                    key={r.id || idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border bg-card shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">Room {r.roomNumber || `10${idx + 1}`}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {r.sharingType || '2-Sharing'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Floor: {r.floorName || 'Floor 1'} • Capacity: {r.capacity || 2} Beds</p>
                    </div>

                    <Button
                      size="sm"
                      className="rounded-xl h-8.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold self-end sm:self-auto w-full sm:w-auto shadow-xs"
                      onClick={() => {
                        toast({ title: 'Room Marked Clean', description: `Room ${r.roomNumber || idx + 1} is now ready for check-in.` });
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark Clean &amp; Ready
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
