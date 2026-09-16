import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, AlertTriangle, MessageSquareWarning, CalendarCheck,
  Server, UserPlus, Package, Users, Wrench, CheckCircle2,
  DollarSign, ShieldAlert, CheckCheck, Clock, LifeBuoy, Sparkles
} from 'lucide-react';

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { Invoice, Complaint, Booking } from '@/lib/types';
import { formatCurrency, formatDate, timeAgo } from '@/lib/format';

interface AlertItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  time: string;
  tone: 'destructive' | 'warning' | 'info' | 'success';
  link: string;
}

const READ_NOTIFS_STORAGE_KEY = 'stayeaze_read_notifs';

export function NotificationBell() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const role = (user?.role || 'TENANT').toUpperCase();
  const lastTicketTimestampsRef = useRef<Record<string, string>>({});
  const isInitialMountRef = useRef<boolean>(true);

  // Persisted Read State
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(READ_NOTIFS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const markAllAsRead = () => {
    const allIds = alerts.map((a) => a.id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updated);
    try {
      localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(updated));
    } catch (ignored) {}
  };

  const handleAlertClick = (alert: AlertItem) => {
    if (!readIds.includes(alert.id)) {
      const updated = [...readIds, alert.id];
      setReadIds(updated);
      try {
        localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(updated));
      } catch (ignored) {}
    }
    if (alert.id.startsWith('my-support-')) {
      window.dispatchEvent(new CustomEvent('open-support-modal'));
    } else if (alert.link) {
      navigate(alert.link);
    }
  };

  // 1. Role-specific query conditions (prevents unauthorized 403 network calls)
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isSupport = role === 'SUPPORT';
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isPropertyManager = role === 'PROPERTY_MANAGER';
  const isAccountant = role === 'ACCOUNTANT';
  const isReceptionist = role === 'RECEPTIONIST';
  const isSecurity = role === 'SECURITY_GUARD';
  const isStaff = role === 'STAFF';
  const isTenant = role === 'TENANT';

  // --- QUERIES ---

  // Admin / Manager / Accountant Invoices
  const { data: invoices } = useQuery({
    queryKey: ['notif', 'invoices'],
    queryFn: () => api.get<{ data: Invoice[] }>('/invoices', { params: { pageSize: 50 } }).then((r) => r.data?.data || []),
    enabled: isOwnerOrAdmin || isPropertyManager || isAccountant,
  });

  // Admin / PM Complaints (Tenant property maintenance)
  const { data: complaints } = useQuery({
    queryKey: ['notif', 'complaints'],
    queryFn: () => api.get<{ data: Complaint[] }>('/complaints', { params: { pageSize: 30 } }).then((r) => r.data?.data || []),
    enabled: isOwnerOrAdmin || isPropertyManager,
  });

  // Universal Support Tickets for Support Staff, Owners, Admins, Tenants, and Staff
  const { data: supportTickets } = useQuery({
    queryKey: ['notif', 'support-tickets', role],
    queryFn: () =>
      api
        .get<any>('/support/tickets', {
          params: {
            pageSize: 20,
            mineOnly: !isSupport && !isSuperAdmin,
            status: isSuperAdmin ? 'ESCALATED' : undefined,
          },
        })
        .then((r) => (Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []))
        .catch(() => []),
    enabled: !!user && !!(useAuthStore.getState().token || localStorage.getItem('stayeaze_token') || localStorage.getItem('token')),
    refetchInterval: 60000, // Relaxed 60-second passive fallback (instant updates handled via WebSocket events)
  });

  // Live Toast Notification Listener for Incoming Ticket Updates & Messages
  // Only fires when the OTHER SIDE sends a message:
  //   - Support staff → notified when lastMessageSenderRole === 'CUSTOMER'
  //   - Customer → notified when lastMessageSenderRole === 'SUPPORT'
  useEffect(() => {
    if (!Array.isArray(supportTickets) || supportTickets.length === 0) return;

    if (isInitialMountRef.current) {
      // Seed initial timestamps so existing tickets don't fire toasts on first page load
      const initialMap: Record<string, string> = {};
      supportTickets.forEach((t: any) => {
        initialMap[t.id] = t.updatedAt || t.createdAt;
      });
      lastTicketTimestampsRef.current = initialMap;
      isInitialMountRef.current = false;
      return;
    }

    supportTickets.forEach((t: any) => {
      const currentTs = t.updatedAt || t.createdAt;
      const prevTs = lastTicketTimestampsRef.current[t.id];

      // Only proceed if the ticket was actually updated
      if (!prevTs || (prevTs && prevTs !== currentTs)) {
        lastTicketTimestampsRef.current[t.id] = currentTs;

        const lastSenderRole = t.lastMessageSenderRole; // 'SUPPORT' or 'CUSTOMER'
        const isPlatform = isSupport;

        // Smart notification: only show toast if the OTHER side sent the last message
        // Support staff: notify only when a CUSTOMER sent a message
        // Customer: notify only when SUPPORT replied
        const shouldNotify = isPlatform
          ? lastSenderRole === 'CUSTOMER'
          : lastSenderRole === 'SUPPORT';

        if (shouldNotify) {
          toast.info(isPlatform ? `💬 New Message on #${t.ticketNumber}` : `🛡️ Support Reply on #${t.ticketNumber}`, {
            description: isPlatform
              ? `${t.contactEmail || t.createdBy?.email || 'Customer'}: ${t.title}`
              : (t.status === 'RESOLVED' ? `Resolved: ${t.resolutionNotes || t.title}` : `Platform Support updated: ${t.title}`),
            action: {
              label: 'View',
              onClick: () => {
                if (isPlatform) {
                  navigate('/support/tickets');
                } else {
                  window.dispatchEvent(new CustomEvent('open-support-modal'));
                }
              }
            },
            duration: 6000,
          });
        }
      }
    });
  }, [supportTickets, isSupport, navigate]);

  // Admin / PM Bookings
  const { data: bookings } = useQuery({
    queryKey: ['notif', 'bookings'],
    queryFn: () => api.get<{ data: Booking[] }>('/bookings', { params: { pageSize: 20 } }).then((r) => r.data?.data || []),
    enabled: isOwnerOrAdmin || isPropertyManager,
  });

  // SuperAdmin & Support System Metrics
  const { data: sysMetrics } = useQuery({
    queryKey: ['notif', 'sysMetrics'],
    queryFn: () => api.get<any>('/system/metrics').then((r) => r.data),
    enabled: isSuperAdmin || isSupport,
  });

  // SuperAdmin Subscribers
  const { data: subscribers } = useQuery({
    queryKey: ['notif', 'subscribers'],
    queryFn: () => api.get<any>('/super-admin/subscribers').then((r) => Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []),
    enabled: isSuperAdmin,
  });

  // Support / Admin Leads
  const { data: leads } = useQuery({
    queryKey: ['notif', 'leads'],
    queryFn: () => api.get<any>('/super-admin/leads').then((r) => Array.isArray(r.data) ? r.data : []),
    enabled: isSupport || isSuperAdmin,
  });

  // Staff Maintenance Tasks
  const { data: maintenanceTasks } = useQuery({
    queryKey: ['notif', 'maintenance'],
    queryFn: () => api.get<any>('/maintenance').then((r) => Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []),
    enabled: isStaff,
  });

  // Receptionist / Security Visitors
  const { data: visitors } = useQuery({
    queryKey: ['notif', 'visitors'],
    queryFn: () => api.get<any>('/visitors').then((r) => Array.isArray(r.data) ? r.data : []),
    enabled: isReceptionist || isSecurity,
  });

  // Parcels for Staff / Reception / Owner / Tenant
  const { data: parcels } = useQuery({
    queryKey: ['notif', 'parcels'],
    queryFn: () => api.get<any>('/parcels').then((r) => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: isReceptionist || isOwnerOrAdmin || isPropertyManager || isSecurity || isTenant,
  });

  // Announcements & Notification Broadcasts
  const { data: announcementLogs } = useQuery({
    queryKey: ['notif', 'announcements'],
    queryFn: () => api.get<any[]>('/notification-logs').then((r) => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: !!user,
    refetchInterval: 45000,
  });

  // Tenant Invoices & Complaints
  const { data: tenantInvoices } = useQuery({
    queryKey: ['notif', 'tenant-invoices'],
    queryFn: () => api.get<any[]>('/tenant-portal/invoices').then((r) => Array.isArray(r.data) ? r.data : []),
    enabled: isTenant,
  });

  const { data: tenantComplaints } = useQuery({
    queryKey: ['notif', 'tenant-complaints'],
    queryFn: () => api.get<any[]>('/tenant-portal/complaints').then((r) => Array.isArray(r.data) ? r.data : []),
    enabled: isTenant,
  });

  // Tenant Pending Visitor Approvals
  const { data: pendingVisitorApprovals } = useQuery({
    queryKey: ['notif', 'tenant-pending-visitors'],
    queryFn: () => api.get<any[]>('/visitors/pending-tenant-approvals').then((r) => Array.isArray(r.data) ? r.data : []),
    enabled: isTenant,
    staleTime: 60000,
  });

  // --- ASSEMBLE ROLE-TAILORED ALERTS ---
  const alerts: AlertItem[] = useMemo(() => {
    const list: AlertItem[] = [];

    // 0. BROADCAST ANNOUNCEMENTS & SYSTEM NOTICES
    if (Array.isArray(announcementLogs) && announcementLogs.length > 0) {
      announcementLogs.slice(0, 3).forEach((log: any) => {
        const isUrgent = (log.messageContent || '').includes('URGENT') || (log.messageContent || '').includes('CRITICAL');
        const isHigh = (log.messageContent || '').includes('HIGH') || (log.messageContent || '').includes('IMPORTANT');
        list.push({
          id: `announcement-${log.id}`,
          icon: Sparkles,
          title: log.recipient === 'ALL_USERS' ? '📢 Platform Notice' : `🔔 Alert (${log.type || 'Notice'})`,
          description: log.messageContent || 'System broadcast notification received.',
          time: log.sentAt || log.createdAt ? timeAgo(log.sentAt || log.createdAt) : 'Recently',
          tone: isUrgent ? 'destructive' : isHigh ? 'warning' : 'info',
          link: isTenant ? '/tenant/dashboard' : '/notification-logs',
        });
      });
    }

    // 1. SUPER_ADMIN ALERTS
    if (isSuperAdmin) {
      if (sysMetrics?.services) {
        const s = sysMetrics.services;
        const downServices = Object.entries(s)
          .filter(([_, v]: any) => v?.status && v.status.toLowerCase() !== 'connected' && v.status.toLowerCase() !== 'up')
          .map(([k]) => k.toUpperCase());

        if (downServices.length > 0) {
          list.push({
            id: `sys-down-${downServices.join('-')}`,
            icon: Server,
            title: `Service Notice: ${downServices.join(', ')}`,
            description: 'Microservice relay connection offline or disabled.',
            time: 'Live Monitoring',
            tone: 'destructive',
            link: '/dashboard',
          });
        }
      }

      if (Array.isArray(subscribers) && subscribers.length > 0) {
        const recentSub = subscribers[0];
        list.push({
          id: `sub-${recentSub.id || recentSub.organizationId || 1}`,
          icon: UserPlus,
          title: `Workspace: ${recentSub.orgName || recentSub.organizationName || 'Active Organization'}`,
          description: `Plan: ${recentSub.planName || 'Professional'} (${recentSub.status || 'Active'})`,
          time: formatDate(recentSub.startDate || recentSub.createdAt || new Date()),
          tone: 'info',
          link: '/super-admin/subscribers',
        });
      }

      // Escalated support cases for Super Admin attention
      const escalatedTickets = (supportTickets || []).filter((t: any) => t.status === 'ESCALATED' || t.isEscalated).slice(0, 5);
      escalatedTickets.forEach((t: any) => {
        list.push({
          id: `escalation-${t.id}-${t.updatedAt || t.createdAt}`,
          icon: AlertTriangle,
          title: `⚠️ Escalation #${t.ticketNumber}`,
          description: `${t.organization?.name || t.contactEmail || 'Customer'}: ${t.title}`,
          time: timeAgo(t.updatedAt || t.createdAt),
          tone: 'destructive',
          link: '/super-admin/escalations',
        });
      });
    }

    // 2. SUPPORT ROLE TICKET & LEAD ALERTS (Dedicated Support Helpdesk)
    if (isSupport) {
      const newLeads = (leads || []).filter((l: any) => l.status === 'NEW' || l.status === 'PENDING').slice(0, 3);
      newLeads.forEach((lead: any) => {
        list.push({
          id: `lead-${lead.id}-${lead.updatedAt || lead.createdAt}`,
          icon: UserPlus,
          title: `Demo Request: ${lead.orgName || lead.contactPerson}`,
          description: `${lead.phone || lead.email} — ${lead.city || 'Inquiry'}`,
          time: timeAgo(lead.createdAt),
          tone: 'warning',
          link: '/support/dashboard',
        });
      });

      const openTickets = (supportTickets || []).filter((t: any) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').slice(0, 5);
      openTickets.forEach((t: any) => {
        list.push({
          id: `ticket-${t.id}-${t.updatedAt || t.createdAt}`,
          icon: LifeBuoy,
          title: `Support Ticket #${t.ticketNumber}`,
          description: `${t.contactEmail || t.createdBy?.email || 'Customer'}: ${t.title}`,
          time: timeAgo(t.updatedAt || t.createdAt),
          tone: t.priority === 'URGENT' || t.priority === 'HIGH' ? 'destructive' : 'warning',
          link: '/support/tickets',
        });
      });
    }

    // 2.5 CUSTOMER / TENANT / OWNER / STAFF SUPPORT ALERTS (When not platform staff)
    if (!isSupport && !isSuperAdmin) {
      const activeTickets = (supportTickets || []).slice(0, 4);
      activeTickets.forEach((t: any) => {
        list.push({
          id: `my-support-${t.id}-${t.updatedAt || t.createdAt}`,
          icon: LifeBuoy,
          title: `Platform Support #${t.ticketNumber}`,
          description: t.status === 'RESOLVED'
            ? `Resolved: ${t.resolutionNotes || t.title}`
            : t.status === 'IN_PROGRESS'
            ? `Support Agent Active: ${t.title}`
            : `Ticket Submitted: ${t.title}`,
          time: timeAgo(t.updatedAt || t.createdAt),
          tone: t.status === 'RESOLVED' ? 'success' : 'info',
          link: '/settings',
        });
      });
    }

    // 3. OWNER / ADMIN / PROPERTY_MANAGER ALERTS
    if (isOwnerOrAdmin || isPropertyManager) {
      const overdueInvoices = (invoices || []).filter((i) => i.status === 'overdue').slice(0, 3);
      overdueInvoices.forEach((inv) => {
        list.push({
          id: `inv-${inv.id}`,
          icon: AlertTriangle,
          title: `Overdue Rent: ${inv.invoiceNumber}`,
          description: `${inv.tenantName} — ${formatCurrency(inv.amount - inv.paidAmount)} outstanding`,
          time: formatDate(inv.dueDate),
          tone: 'destructive',
          link: '/billing',
        });
      });

      const openComplaints = (complaints || []).filter((c) => c.status === 'open' || c.status === 'in_progress').slice(0, 3);
      openComplaints.forEach((c) => {
        list.push({
          id: `comp-${c.id}`,
          icon: MessageSquareWarning,
          title: `Complaint #${c.ticketNumber}`,
          description: c.description,
          time: timeAgo(c.createdAt),
          tone: 'warning',
          link: '/complaints',
        });
      });

      const pendingBookings = (bookings || []).filter((b) => b.status === 'pending').slice(0, 2);
      pendingBookings.forEach((b) => {
        list.push({
          id: `bk-${b.id}`,
          icon: CalendarCheck,
          title: `New Booking: ${b.bookingCode}`,
          description: `${b.tenantName} — Move-in: ${formatDate(b.checkInDate)}`,
          time: timeAgo(b.createdAt),
          tone: 'info',
          link: '/bookings',
        });
      });
    }

    // 4. ACCOUNTANT ALERTS
    if (isAccountant) {
      const overdueInvoices = (invoices || []).filter((i) => i.status === 'overdue').slice(0, 4);
      overdueInvoices.forEach((inv) => {
        list.push({
          id: `acc-inv-${inv.id}`,
          icon: DollarSign,
          title: `Overdue Invoice: ${inv.invoiceNumber}`,
          description: `${inv.tenantName} — ${formatCurrency(inv.amount - inv.paidAmount)} due`,
          time: formatDate(inv.dueDate),
          tone: 'destructive',
          link: '/accountant/dashboard',
        });
      });
    }

    // 5. RECEPTIONIST ALERTS
    if (isReceptionist) {
      const pendingParcels = (parcels || []).filter((p: any) => p.status === 'RECEIVED' || p.status === 'ARRIVED' || p.status === 'UNCLAIMED').slice(0, 4);
      pendingParcels.forEach((p: any) => {
        const resName = `${p.tenant?.firstName || ''} ${p.tenant?.lastName || ''}`.trim() || p.tenant?.name || 'Resident';
        list.push({
          id: `pcl-${p.id}`,
          icon: Package,
          title: `Parcel Awaiting Pickup: ${p.courierCompany || 'Delivery'}`,
          description: `${resName} (Room ${p.tenant?.roomNumber || '—'}) • ${p.lockerLocation || 'Desk'}`,
          time: timeAgo(p.receivedDate || p.createdAt || new Date()),
          tone: 'warning',
          link: '/parcels',
        });
      });

      const activeVisitors = (visitors || []).filter((v: any) => v.status === 'CHECKED_IN' || v.status === 'EXPECTED').slice(0, 2);
      activeVisitors.forEach((v: any) => {
        list.push({
          id: `vis-${v.id}`,
          icon: Users,
          title: `Visitor: ${v.visitorName}`,
          description: `Visiting: ${v.tenantName || 'Resident'} (${v.purpose || 'Personal'})`,
          time: timeAgo(v.checkInTime || v.createdAt || new Date()),
          tone: 'info',
          link: '/receptionist/dashboard',
        });
      });
    }

    // 6. SECURITY GUARD ALERTS
    if (isSecurity) {
      const pendingParcels = (parcels || []).filter((p: any) => p.status === 'RECEIVED').slice(0, 3);
      pendingParcels.forEach((p: any) => {
        list.push({
          id: `sec-pcl-${p.id}`,
          icon: Package,
          title: `Gate Parcel Logged: ${p.courierCompany}`,
          description: `Room ${p.tenant?.roomNumber || '—'} • ${p.lockerLocation || 'Security Shelf'}`,
          time: timeAgo(p.receivedDate || new Date()),
          tone: 'info',
          link: '/parcels',
        });
      });

      const activePasses = (visitors || []).filter((v: any) => v.status === 'CHECKED_IN').slice(0, 4);
      activePasses.forEach((v: any) => {
        list.push({
          id: `sec-vis-${v.id}`,
          icon: ShieldAlert,
          title: `Gate Pass: ${v.visitorName}`,
          description: `Host: ${v.tenantName || 'Room'} • Gate Pass Active`,
          time: timeAgo(v.checkInTime || new Date()),
          tone: 'warning',
          link: '/security/dashboard',
        });
      });
    }

    // 7. STAFF ALERTS
    if (isStaff) {
      const pendingWork = (maintenanceTasks || []).filter((t: any) => t.status === 'in_progress' || t.status === 'open').slice(0, 4);
      pendingWork.forEach((t: any) => {
        list.push({
          id: `stf-task-${t.id}`,
          icon: Wrench,
          title: `Work Order: ${t.title || t.category || 'Repair'}`,
          description: `${t.location || 'Facility'} — ${t.priority || 'Normal'} priority`,
          time: timeAgo(t.createdAt || new Date()),
          tone: 'info',
          link: '/staff/dashboard',
        });
      });
    }

    // 8. TENANT ALERTS
    if (isTenant) {
      // Unclaimed Parcel Alert for Resident
      const residentParcels = (parcels || []).filter((p: any) => p.status === 'RECEIVED').slice(0, 3);
      residentParcels.forEach((p: any) => {
        list.push({
          id: `tnt-parcel-${p.id}`,
          icon: Package,
          title: `📦 Package Arrived: ${p.courierCompany}`,
          description: `Ready for collection at ${p.lockerLocation || 'Reception Desk'}${p.trackingNumber ? ` (Tracking: ${p.trackingNumber})` : ''}`,
          time: timeAgo(p.receivedDate || new Date()),
          tone: 'warning',
          link: '/tenant/dashboard',
        });
      });

      (pendingVisitorApprovals || []).forEach((v: any) => {
        list.push({
          id: `tnt-vis-appr-${v.id}`,
          icon: ShieldAlert,
          title: `Gate Visitor: ${v.visitorName}`,
          description: `Visitor at gate requesting entry (${v.purpose || 'Visit'}). Tap to Approve/Deny.`,
          time: timeAgo(v.checkInTime || new Date()),
          tone: 'warning',
          link: '/visitors',
        });
      });

      const unpaid = (tenantInvoices || []).filter((i: any) => i.status === 'UNPAID' || i.status === 'OVERDUE').slice(0, 2);
      unpaid.forEach((inv: any) => {
        list.push({
          id: `tnt-inv-${inv.id}`,
          icon: DollarSign,
          title: `Monthly Rent Invoice: ${inv.invoiceNumber || 'Rent Due'}`,
          description: `${formatCurrency(inv.amountDue)} due by ${formatDate(inv.dueDate)}`,
          time: formatDate(inv.dueDate),
          tone: 'destructive',
          link: '/tenant/billing',
        });
      });

      const openTickets = (tenantComplaints || []).filter((c: any) => c.status === 'OPEN' || c.status === 'IN_PROGRESS').slice(0, 2);
      openTickets.forEach((c: any) => {
        list.push({
          id: `tnt-comp-${c.id}`,
          icon: Clock,
          title: `Maintenance Ticket: ${c.category || 'Request'}`,
          description: `Status: ${c.status} • Our team is looking into it`,
          time: timeAgo(c.createdAt || new Date()),
          tone: 'info',
          link: '/tenant/maintenance',
        });
      });
    }

    return list;
  }, [
    isSuperAdmin, isSupport, isOwnerOrAdmin, isPropertyManager, isAccountant,
    isReceptionist, isSecurity, isStaff, isTenant,
    sysMetrics, subscribers, leads, complaints, invoices, bookings,
    supportTickets, maintenanceTasks, visitors, parcels, tenantInvoices, tenantComplaints
  ]);

  const unreadAlerts = alerts.filter((a) => !readIds.includes(a.id));
  const alertCount = unreadAlerts.length;

  const toneColor = {
    destructive: 'text-destructive bg-destructive/10',
    warning: 'text-amber-500 bg-amber-500/10',
    info: 'text-primary bg-primary/10',
    success: 'text-emerald-500 bg-emerald-500/10',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full" title="Notifications">
          <Bell className="h-5 w-5" />
          {alertCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground animate-in zoom-in">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[calc(100vw-2rem)] max-w-sm sm:w-96 p-0 shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
        <DropdownMenuLabel className="flex items-center justify-between px-3.5 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {alertCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                {alertCount} new
              </Badge>
            )}
          </div>
          {unreadAlerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[400px] overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin' }}>
          {unreadAlerts.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2.5 h-8 w-8 text-emerald-500/50" />
              <p className="font-medium text-foreground">You're all caught up!</p>
              <p className="text-xs text-muted-foreground mt-0.5">No active alerts for your role.</p>
            </div>
          ) : (
            unreadAlerts.map((alert) => (
              <DropdownMenuItem
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className="flex items-start gap-3 px-3.5 py-3 cursor-pointer border-b border-border/40 last:border-0 transition-colors bg-primary/5 hover:bg-primary/10"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneColor[alert.tone]}`}>
                  <alert.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold leading-tight text-foreground">
                      {alert.title}
                    </p>
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {alert.description}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-muted-foreground/80">
                    {alert.time}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
