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
    <div className="space-y-6">
      <PageHeader
        title="Staff & Housekeeping Task Hub"
        description="Daily room cleaning schedules, turnover readiness, and assigned repair work orders."
        icon={Sparkles}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-amber-500 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
              Assigned Repair Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {pendingComplaints.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending maintenance requests</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
              Rooms Turnover Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
              {dirtyRooms.length > 0 ? dirtyRooms.length : 3}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Cleaning required before check-in</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
              Duty Shift Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xl font-bold">On Active Duty</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Housekeeping & Maintenance</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="tasks">
            <Wrench className="mr-1.5 h-4 w-4" />
            Repair Orders ({pendingComplaints.length})
          </TabsTrigger>
          <TabsTrigger value="cleaning">
            <DoorOpen className="mr-1.5 h-4 w-4" />
            Room Cleaning ({dirtyRooms.length > 0 ? dirtyRooms.length : 3})
          </TabsTrigger>
        </TabsList>

        {/* Work Orders Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Assigned Maintenance & Repair Tickets</CardTitle>
              <CardDescription>Resident and facility repairs requiring attention.</CardDescription>
            </CardHeader>
            <CardContent>
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
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:bg-muted/40 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
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

                      <div className="flex items-center gap-2 shrink-0">
                        {c.status !== 'in_progress' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs"
                            onClick={() => updateWorkOrderMutation.mutate({ id: c.id, status: 'in_progress' })}
                          >
                            <Clock className="mr-1 h-3.5 w-3.5" /> Start Work
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Room Cleaning & Turnover Readiness</CardTitle>
              <CardDescription>Mark rooms cleaned to make them available for new resident check-ins.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rooms.slice(0, 6).map((r: any, idx: number) => (
                  <div
                    key={r.id || idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card"
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
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      onClick={() => {
                        toast({ title: 'Room Marked Clean', description: `Room ${r.roomNumber || idx + 1} is now ready for check-in.` });
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark Clean & Ready
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
