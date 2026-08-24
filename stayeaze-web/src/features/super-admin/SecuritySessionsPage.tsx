import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ShieldAlert, RefreshCw, Search, KeyRound, LogOut, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ActiveSession {
  id: string;
  token: string;
  userId: string;
  userEmail: string;
  userName: string;
  orgName: string;
  orgId: string | null;
  expiryDate: string;
  isExpired: boolean;
}

export default function SecuritySessionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');

  const { data: subscribersData } = useQuery({
    queryKey: ['super-admin-subscribers-sessions-list'],
    queryFn: () => api.get('/super-admin/subscribers?pageSize=100').then((r) => r.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  const subscribersList = Array.isArray(subscribersData)
    ? subscribersData
    : Array.isArray(subscribersData?.content)
    ? subscribersData.content
    : Array.isArray(subscribersData?.data)
    ? subscribersData.data
    : [];

  const { data: sessionsData, isLoading, refetch } = useQuery({
    queryKey: ['super-admin-active-sessions', search],
    queryFn: () => api.get('/super-admin/sessions', { params: { search } }).then((r) => r.data || []),
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => api.post(`/super-admin/sessions/${tokenId}/revoke`),
    onSuccess: () => {
      toast.success('User session revoked. Refresh token invalidated.');
      queryClient.invalidateQueries({ queryKey: ['super-admin-active-sessions'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to revoke session');
    },
  });

  const revokeOrgMutation = useMutation({
    mutationFn: (orgId: string) => api.post(`/super-admin/sessions/revoke-org/${orgId}`),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Emergency org lockout complete. All sessions terminated.');
      setEmergencyModalOpen(false);
      setSelectedOrgId('');
      queryClient.invalidateQueries({ queryKey: ['super-admin-active-sessions'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to execute emergency lockout');
    },
  });

  const sessions: ActiveSession[] = Array.isArray(sessionsData)
    ? sessionsData
    : Array.isArray(sessionsData?.data)
    ? sessionsData.data
    : Array.isArray(sessionsData?.content)
    ? sessionsData.content
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-rose-600" /> Security & Active Session Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor active user refresh tokens and execute emergency session revocation / organization lockouts.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setEmergencyModalOpen(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
        >
          <AlertTriangle className="mr-2 h-4 w-4" /> Emergency Org Lockout
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search active sessions by user email, name, organization..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading active user sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No active user sessions found matching search criteria.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Account</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Refresh Token</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="font-semibold">{session.userName}</div>
                        <div className="text-xs text-muted-foreground">{session.userEmail}</div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {session.orgName}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <KeyRound className="h-3 w-3 text-amber-500" />
                          {session.token}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(session.expiryDate).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {session.isExpired ? (
                          <Badge variant="secondary" className="text-xs">EXPIRED</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30 text-xs">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> ACTIVE
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeMutation.mutate(session.id)}
                          disabled={revokeMutation.isPending}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Revoke Session
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Lockout Modal */}
      <Dialog open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Emergency Organization Session Lockout
            </DialogTitle>
            <DialogDescription>
              Select an organization to immediately invalidate and revoke all active refresh tokens for all its users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Target Organization" />
                </SelectTrigger>
                <SelectContent>
                  {subscribersList.map((sub: any) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name} ({sub.subdomain}.stayeaze.com)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 text-xs">
              <strong>Warning:</strong> This will instantly kick out all logged-in staff, managers, and owners under this organization.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmergencyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeOrgMutation.mutate(selectedOrgId)}
              disabled={!selectedOrgId || revokeOrgMutation.isPending}
            >
              {revokeOrgMutation.isPending ? 'Terminating Sessions...' : 'Revoke All Sessions Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
