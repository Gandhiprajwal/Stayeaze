import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldAlert, RefreshCw, Search, KeyRound, LogOut, AlertTriangle, CheckCircle2, Mail, Clock } from 'lucide-react';

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
    <div className="space-y-6 pb-12 sm:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Security & Active Session Manager"
          description="Monitor active user refresh tokens and execute emergency session revocation / organization lockouts."
        />
        <Button
          variant="destructive"
          onClick={() => setEmergencyModalOpen(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl h-10 text-xs sm:text-sm self-start sm:self-auto shrink-0 shadow-xs"
        >
          <AlertTriangle className="mr-2 h-4 w-4" /> Emergency Org Lockout
        </Button>
      </div>

      <Card className="rounded-2xl border shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <div className="flex items-center justify-between gap-2.5">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search active sessions by user email, name, organization..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl h-10 w-full text-xs sm:text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl h-10 w-10 shrink-0"
              onClick={() => refetch()}
              title="Refresh Sessions"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading active user sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No active user sessions found matching search criteria.
            </div>
          ) : (
            <>
              {/* Mobile View: High-Density Breakdown Cards */}
              <div className="block md:hidden space-y-3.5">
                {sessions.map((session) => (
                  <div key={session.id} className="p-4 rounded-2xl border bg-card shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">{session.userName}</h4>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{session.userEmail}</span>
                        </div>
                      </div>
                      <div>
                        {session.isExpired ? (
                          <Badge variant="secondary" className="text-[10px] font-bold">EXPIRED</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> ACTIVE
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/40 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-semibold uppercase">Organization</span>
                        <span className="font-bold text-foreground truncate max-w-[180px]">{session.orgName || 'Platform / Global'}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-[11px] text-muted-foreground font-semibold uppercase">Token Ref</span>
                        <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
                          <KeyRound className="h-3 w-3 text-amber-500 shrink-0" />
                          {session.token}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                        <span className="font-semibold uppercase">Expires</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          {new Date(session.expiryDate).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-border/60">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeMutation.mutate(session.id)}
                        disabled={revokeMutation.isPending}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl h-8.5 text-xs font-bold w-full sm:w-auto"
                      >
                        <LogOut className="mr-1.5 h-3.5 w-3.5" /> Revoke Session
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Full 6-Column Tabular View */}
              <div className="hidden md:block rounded-xl border overflow-x-auto">
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Emergency Lockout Modal */}
      <Dialog open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] p-0 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl bg-rose-500/10 text-rose-600 shrink-0">
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-rose-600">
                  Emergency Organization Session Lockout
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Select an organization to immediately invalidate and revoke all active refresh tokens for all its users.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)] flex-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Organization</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger className="rounded-xl h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Choose Target Organization" />
                </SelectTrigger>
                <SelectContent>
                  {subscribersList.map((sub: any) => (
                    <SelectItem key={sub.id} value={sub.id} className="text-xs">
                      {sub.name} ({sub.subdomain}.stayeaze.com)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl border p-3.5 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-xs leading-relaxed">
              <strong>Warning:</strong> This will instantly kick out all logged-in staff, managers, and owners under this organization.
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-2 shrink-0">
            <Button variant="ghost" onClick={() => setEmergencyModalOpen(false)} className="rounded-xl h-9.5 text-xs font-semibold">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeOrgMutation.mutate(selectedOrgId)}
              disabled={!selectedOrgId || revokeOrgMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl h-9.5 text-xs sm:text-sm shadow-xs"
            >
              {revokeOrgMutation.isPending ? 'Terminating Sessions...' : 'Revoke All Sessions Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
