import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Building2, Wallet, Calendar, ShieldCheck, Sparkles, 
  Search, Download, RefreshCw, LogIn, Clock, ArrowUpRight, CheckCircle2, AlertTriangle, XCircle,
  ChevronLeft, ChevronRight, Palette, Check, Sparkle, ExternalLink, Eye, DoorOpen, BedDouble,
  ShieldAlert, Settings, FileJson, Activity, MapPin, Phone, Mail, UserCheck, LayoutGrid, List,
  Filter, ArrowUpDown, Copy, Layers, CheckCircle, HelpCircle, Shield, X, CheckSquare,
  Receipt, CreditCard, RotateCcw, Send, AlertCircle, ArrowRight, Zap
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from '@/lib/hooks/use-debounce';
import api from '@/lib/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, exportToCSV, initials } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';

export interface Subscriber {
  id: string;
  name: string;
  subdomain: string;
  ownerName: string;
  ownerEmail: string;
  ownerMobile: string;
  propertyCount: number;
  totalBeds: number;
  occupiedBeds: number;
  planName: string;
  planPrice: number;
  billingCycle: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'PAYMENT_LOCKED' | 'SUSPENDED' | 'PENDING_APPROVAL' | 'REJECTED';
  paymentId?: string;
  isEnterprise?: boolean;
}

const colorPresets = [
  { name: 'Indigo Enterprise', hex: '#4f46e5' },
  { name: 'Emerald Living', hex: '#059669' },
  { name: 'Royal Purple', hex: '#7c3aed' },
  { name: 'Crimson Executive', hex: '#dc2626' },
  { name: 'Amber Gold', hex: '#d97706' },
  { name: 'Ocean Cyan', hex: '#0284c7' },
  { name: 'Midnight Slate', hex: '#1e293b' },
];

export default function SubscribersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<string>('name');
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [mainTab, setMainTab] = useState<'subscribers' | 'approvals' | 'refunds'>(
    searchParams.get('tab') === 'refunds' ? 'refunds' : searchParams.get('tab') === 'approvals' ? 'approvals' : 'subscribers'
  );
  const [refundsSubTab, setRefundsSubTab] = useState<'refunds' | 'dropped_checkouts'>('refunds');
  const [refundSearch, setRefundSearch] = useState('');
  const [refundStatusFilter, setRefundStatusFilter] = useState('ALL');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [rejectingReq, setRejectingReq] = useState<any | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<string>('');

  const [extendTarget, setExtendTarget] = useState<Subscriber | null>(null);
  const [extendDays, setExtendDays] = useState<number>(30);
  const [currentPage, setCurrentPage] = useState<number>(parseInt(searchParams.get('page') || '1', 10) || 1);
  const [pageSize, setPageSize] = useState<number>(parseInt(searchParams.get('pageSize') || '10', 10) || 10);

  // Sync state to URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
    if (currentPage > 1) params.page = String(currentPage);
    if (pageSize !== 10) params.pageSize = String(pageSize);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, statusFilter, currentPage, pageSize, setSearchParams]);

  // Reset page when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // Detail Portfolio Modal
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState<string>('');

  // Status & Plan override forms
  const [statusForm, setStatusForm] = useState({ status: 'ACTIVE' });
  const [planForm, setPlanForm] = useState({
    planName: 'Starter PG Plan',
    planPrice: 1499,
    billingCycle: 'MONTHLY',
  });

  const { data: pageResponse, isLoading } = useQuery<any>({
    queryKey: ['super-admin-subscribers', debouncedSearch, statusFilter, currentPage, pageSize],
    queryFn: () => api.get('/super-admin/subscribers', {
      params: {
        search: debouncedSearch,
        status: statusFilter === 'ALL' ? '' : statusFilter,
        page: currentPage,
        pageSize,
      }
    }).then((r) => r.data),
    staleTime: 30_000,
  });

  // Overview query for selected organization
  const { data: orgOverview, isLoading: loadingOverview, refetch: refetchOverview } = useQuery<any>({
    queryKey: ['super-admin-org-overview', selectedOrgId],
    queryFn: () => api.get(`/super-admin/subscribers/${selectedOrgId}/overview`).then((r) => r.data),
    enabled: Boolean(selectedOrgId && selectedOrgId !== 'null'),
  });

  const safeRefetchOverview = () => {
    if (selectedOrgId && selectedOrgId !== 'null') {
      refetchOverview();
    }
  };

  // Sync overview details to form
  useEffect(() => {
    if (orgOverview?.billingProfile) {
      const bp = orgOverview.billingProfile;
      const curStatus = (bp.subscriptionStatus || 'ACTIVE').toUpperCase();
      setStatusForm({ status: curStatus });

      let pName = bp.subscriptionPlanName || 'Starter PG Plan';
      if (pName.toLowerCase().includes('enterprise')) pName = 'Enterprise Co-Living';
      else if (pName.toLowerCase().includes('professional')) pName = 'Professional Growth';
      else pName = 'Starter PG Plan';

      setPlanForm({
        planName: pName,
        planPrice: bp.subscriptionPlanPrice ? Number(bp.subscriptionPlanPrice) : 1499,
        billingCycle: bp.subscriptionBillingCycle || 'MONTHLY',
      });
    }
  }, [orgOverview]);

  const rawSubscribers: Subscriber[] = Array.isArray(pageResponse?.data)
    ? pageResponse.data
    : (Array.isArray(pageResponse)
        ? pageResponse
        : (pageResponse?.content && Array.isArray(pageResponse.content)
            ? pageResponse.content
            : []));

  // Multi-field instant client search & filtering logic
  const filteredSubscribers = useMemo(() => {
    let list = [...rawSubscribers];

    // Sorter
    list.sort((a, b) => {
      if (sortBy === 'properties') return (b.propertyCount || 0) - (a.propertyCount || 0);
      if (sortBy === 'beds') return (b.totalBeds || 0) - (a.totalBeds || 0);
      if (sortBy === 'mrr') return (b.planPrice || 0) - (a.planPrice || 0);
      if (sortBy === 'expiry') return new Date(a.endDate || 0).getTime() - new Date(b.endDate || 0).getTime();
      return (a.name || '').localeCompare(b.name || '');
    });

    return list;
  }, [rawSubscribers, sortBy]);

  // Global Database Aggregates via Dedicated Server Stats Endpoint
  const { data: subscriberStats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ['super-admin-subscribers-stats'],
    queryFn: () => api.get('/super-admin/subscribers/stats').then((r) => r.data),
    staleTime: 30000,
  });

  // All counts come exclusively from the server-side stats endpoint.
  // Never derive from the current page slice — that would show wrong numbers
  // on a paginated result (e.g. 3 active on this page vs 123 total in DB).
  const totalSubscribers: number | null = subscriberStats?.totalSubscribers ?? null;
  const totalPages = pageResponse?.totalPages ?? Math.max(1, Math.ceil((pageResponse?.total ?? (totalSubscribers ?? 0)) / pageSize));
  const paginatedSubscribers = filteredSubscribers;

  const activeSubscribers: number | null = subscriberStats?.activeSubscribers ?? null;
  const trialSubscribers: number | null = subscriberStats?.trialSubscribers ?? null;
  const enterpriseSubscribers: number | null = subscriberStats?.enterpriseSubscribers ?? null;
  const lockedSubscribers: number | null = subscriberStats?.lockedSubscribers ?? null;
  const pendingApprovals: number | null = subscriberStats?.pendingApprovals ?? null;
  const totalProperties: number | null = subscriberStats?.totalProperties ?? null;
  const totalBeds: number | null = subscriberStats?.totalBeds ?? null;
  const totalSaaSRev: number | null = subscriberStats?.monthlyMrr ?? null;

  // Pre-Approval Double Verification Modal State
  const [verifyingOrg, setVerifyingOrg] = useState<Subscriber | null>(null);
  const [verifyForm, setVerifyForm] = useState({
    validityDays: 30,
    planName: 'Starter PG Plan',
    welcomeNotes: '',
  });

  // Post-Approval Celebration / Credentials Readiness Modal State
  const [approvedOrgSuccess, setApprovedOrgSuccess] = useState<{
    org: Subscriber;
    message: string;
    subdomain: string;
    validityDays: number;
  } | null>(null);

  // Rejection & Refund Modal State
  const [rejectingOrg, setRejectingOrg] = useState<Subscriber | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Incomplete KYC or License Documentation');
  const [orgRejectionNotes, setOrgRejectionNotes] = useState('');
  const [autoRefund, setAutoRefund] = useState(true);

  // Bulk Selection State
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());

  // Enhanced Approve Subscriber Mutation (Supports Custom Validity & Plan)
  const approveSubscriberMut = useMutation({
    mutationFn: ({ orgId, payload }: { orgId: string; payload?: any }) =>
      api.post(`/super-admin/subscribers/${orgId}/approve`, payload).then((r) => r.data),
    onSuccess: (data, variables) => {
      const org = verifyingOrg || rawSubscribers.find((s) => s.id === variables.orgId);
      if (org) {
        setApprovedOrgSuccess({
          org,
          message: data.message || 'Subscriber workspace approved and activated successfully!',
          subdomain: data.subdomain || org.subdomain,
          validityDays: data.validityDays || 30,
        });
      }
      setVerifyingOrg(null);
      toast.success(data.message || 'Subscriber workspace approved and activated successfully!');
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve subscriber organization.');
    }
  });

  // Enhanced Reject Subscriber Mutation (Supports Automated Razorpay Refunds)
  const rejectSubscriberMut = useMutation({
    mutationFn: ({ orgId, payload }: { orgId: string; payload?: any }) =>
      api.post(`/super-admin/subscribers/${orgId}/reject`, payload).then((r) => r.data),
    onSuccess: (data) => {
      toast.warning(data.message || 'Subscriber registration rejected.');
      setRejectingOrg(null);
      setOrgRejectionNotes('');
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reject subscriber organization.');
    }
  });

  // Bulk Approve Mutation
  const bulkApproveMut = useMutation({
    mutationFn: (orgIds: string[]) =>
      api.post('/super-admin/subscribers/bulk-approve', { orgIds, validityDays: 30 }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.message || 'Selected organizations approved successfully!');
      setSelectedOrgIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to bulk approve organizations.');
    }
  });

  // Bulk Reject Mutation
  const bulkRejectMut = useMutation({
    mutationFn: ({ orgIds, reason, autoRefund }: { orgIds: string[]; reason: string; autoRefund: boolean }) =>
      api.post('/super-admin/subscribers/bulk-reject', { orgIds, reason, autoRefund }).then((r) => r.data),
    onSuccess: (data) => {
      toast.warning(data.message || 'Selected organizations rejected.');
      setSelectedOrgIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to bulk reject organizations.');
    }
  });

  // Extend Subscription Mutation
  const extendMut = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const res = await api.post(`/super-admin/subscribers/${id}/extend`, null, { params: { days } });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Subscription extended successfully!');
      setExtendTarget(null);
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-pending-extensions'] });
      safeRefetchOverview();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to extend subscription');
    },
  });

  // Pending Extension Requests Query for Counter & Alert Banner
  const { data: pendingRequestsData } = useQuery({
    queryKey: ['super-admin-pending-extensions'],
    queryFn: () =>
      api
        .get('/super-admin/subscribers/extension-requests', { params: { status: 'PENDING', pageSize: 20 } })
        .then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])),
  });
  const pendingRequests = Array.isArray(pendingRequestsData) ? pendingRequestsData : [];

  // All Extension Requests Query for Approvals Hub Tab
  const { data: allRequestsData, isLoading: loadingExtensionRequests } = useQuery({
    queryKey: ['super-admin-all-extension-requests', approvalStatusFilter],
    queryFn: () =>
      api
        .get('/super-admin/subscribers/extension-requests', {
          params: {
            status: approvalStatusFilter === 'ALL' ? '' : approvalStatusFilter,
            pageSize: 20,
          },
        })
        .then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])),
  });
  const allExtensionRequests = Array.isArray(allRequestsData) ? allRequestsData : [];

  // Approve Extension Mutation
  const approveExtensionMut = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await api.post(`/super-admin/subscribers/extension-requests/${id}/approve`, { notes });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Subscription extension approved successfully!');
      queryClient.invalidateQueries({ queryKey: ['super-admin-pending-extensions'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-all-extension-requests'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      safeRefetchOverview();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve extension');
    },
  });

  // Reject Extension Mutation
  const rejectExtensionMut = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await api.post(`/super-admin/subscribers/extension-requests/${id}/reject`, { notes });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Subscription extension rejected.');
      setRejectingReq(null);
      setRejectionNotes('');
      queryClient.invalidateQueries({ queryKey: ['super-admin-pending-extensions'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-all-extension-requests'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reject extension');
    },
  });

  // Update Status Mutation
  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.put(`/super-admin/subscribers/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Organization status updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      safeRefetchOverview();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update organization status');
    },
  });

  // Update Plan Override Mutation
  const updatePlanMut = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.put(`/super-admin/subscribers/${id}/plan`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Subscription plan overridden successfully!');
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      safeRefetchOverview();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to override plan');
    },
  });

  // Impersonate Mutation (Support Diagnostic Login)
  const impersonateMut = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await api.post<any>(`/super-admin/subscribers/${orgId}/impersonate`);
      return res.data;
    },
    onSuccess: (data) => {
      const token = data.accessToken || data.token;
      if (token) {
        const userObj: any = {
          id: data.user?.id || data.id,
          email: data.user?.email || data.email,
          name: data.user?.name || data.firstName || 'Owner',
          role: (data.user?.roles && data.user.roles[0]) || (Array.isArray(data.roles) && data.roles[0]) || 'OWNER',
          orgId: data.user?.orgId || data.orgId,
        };
        setAuth(userObj, token);
        toast.success(`Switched into diagnostic view for ${userObj.name || 'Subscriber'}`);
        navigate('/dashboard');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Support login failed');
    },
  });

  // Export JSON Archive
  const handleExportOrgJson = async (orgId: string, orgName: string) => {
    try {
      const res = await api.get(`/super-admin/subscribers/${orgId}/export`);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${orgName.toLowerCase().replace(/\s+/g, '_')}_archive.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Organization JSON archive exported successfully.');
    } catch {
      toast.error('Failed to export organization archive.');
    }
  };

  // Copy text helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Branding modal state
  const [brandingTarget, setBrandingTarget] = useState<Subscriber | null>(null);
  const [brandingForm, setBrandingForm] = useState({
    customBrandingEnabled: false,
    brandName: '',
    brandTagline: '',
    brandLogoUrl: '',
    brandFaviconUrl: '',
    brandPrimaryColor: '#4f46e5',
    brandAccentColor: '#06b6d4',
    customFooterText: '',
    hideStayEazeBranding: false,
  });

  const openBrandingModal = async (s: Subscriber) => {
    setBrandingTarget(s);
    try {
      const res = await api.get<any>(`/super-admin/subscribers/${s.id}/branding`);
      const d = res.data;
      setBrandingForm({
        customBrandingEnabled: Boolean(d.customBrandingEnabled),
        brandName: d.brandName || s.name || '',
        brandTagline: d.brandTagline || 'Smart PG & Co-Living Management',
        brandLogoUrl: d.brandLogoUrl || '',
        brandFaviconUrl: d.brandFaviconUrl || '',
        brandPrimaryColor: d.brandPrimaryColor || '#4f46e5',
        brandAccentColor: d.brandAccentColor || '#06b6d4',
        customFooterText: d.customFooterText || `© ${new Date().getFullYear()} ${d.brandName || s.name}. All rights reserved.`,
        hideStayEazeBranding: Boolean(d.hideStayEazeBranding),
      });
    } catch {
      setBrandingForm({
        customBrandingEnabled: Boolean(s.isEnterprise),
        brandName: s.name || '',
        brandTagline: 'Smart PG & Co-Living Management',
        brandLogoUrl: '',
        brandFaviconUrl: '',
        brandPrimaryColor: '#4f46e5',
        brandAccentColor: '#06b6d4',
        customFooterText: `© ${new Date().getFullYear()} ${s.name}. All rights reserved.`,
        hideStayEazeBranding: false,
      });
    }
  };

  const updateBrandingMut = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.put(`/super-admin/subscribers/${id}/branding`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Enterprise White-Label branding updated successfully!');
      setBrandingTarget(null);
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      safeRefetchOverview();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update branding settings');
    },
  });

  // --- SUBSCRIPTION REFUNDS & PAYMENT AUDIT QUERIES ---
  const { data: refundsStats, isLoading: loadingRefundStats, refetch: refetchRefundStats } = useQuery<any>({
    queryKey: ['super-admin-refunds-summary-stats'],
    queryFn: async () => {
      const res = await api.get('/super-admin/subscribers/refunds/summary-stats');
      return res.data;
    },
    enabled: isSuperAdmin && mainTab === 'refunds',
  });

  const { data: refundsData, isLoading: loadingRefunds, refetch: refetchRefunds } = useQuery<any>({
    queryKey: ['super-admin-refunds-audit', refundSearch, refundStatusFilter],
    queryFn: async () => {
      const res = await api.get('/super-admin/subscribers/refunds/audit', {
        params: {
          search: refundSearch,
          status: refundStatusFilter === 'ALL' ? '' : refundStatusFilter,
        },
      });
      return res.data;
    },
    enabled: isSuperAdmin && mainTab === 'refunds',
  });

  const { data: onboardingFailuresRaw, isLoading: loadingFailures, refetch: refetchFailures } = useQuery<any>({
    queryKey: ['super-admin-onboarding-failures'],
    queryFn: async () => {
      const res = await api.get('/super-admin/subscribers/refunds/onboarding-failures');
      return res.data;
    },
    enabled: isSuperAdmin && mainTab === 'refunds',
  });

  const onboardingFailures = useMemo<any[]>(() => {
    if (!onboardingFailuresRaw) return [];
    if (Array.isArray(onboardingFailuresRaw)) return onboardingFailuresRaw;
    if (Array.isArray(onboardingFailuresRaw?.data)) return onboardingFailuresRaw.data;
    if (Array.isArray(onboardingFailuresRaw?.content)) return onboardingFailuresRaw.content;
    return [];
  }, [onboardingFailuresRaw]);

  const refundRecords = useMemo<any[]>(() => {
    if (!refundsData) return [];
    if (Array.isArray(refundsData?.records)) return refundsData.records;
    if (Array.isArray(refundsData?.data)) return refundsData.data;
    if (Array.isArray(refundsData)) return refundsData;
    return [];
  }, [refundsData]);

  const syncLiveRefundMut = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await api.post(`/super-admin/subscribers/refunds/${orgId}/sync-live-status`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Live Razorpay refund status updated!');
      refetchRefunds();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to sync with Razorpay');
    },
  });

  const retryRefundMut = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await api.post(`/super-admin/subscribers/refunds/${orgId}/retry`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Refund re-triggered on Razorpay!');
      refetchRefunds();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to retry refund');
    },
  });

  const sendArnReceiptMut = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await api.post(`/super-admin/subscribers/refunds/${orgId}/send-arn-receipt`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Official Settlement & ARN Certificate emailed!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to dispatch email');
    },
  });

  const sendRecoveryLinkMut = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await api.post(`/super-admin/subscribers/refunds/send-recovery-link/${leadId}`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Payment recovery email dispatched!');
      refetchFailures();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to send recovery link');
    },
  });

  const openOverview = (s: Subscriber) => {
    setSelectedOrgId(s.id);
    setSelectedOrgName(s.name);
    const curStatus = (s.status || 'ACTIVE').toUpperCase();
    setStatusForm({ status: curStatus });

    let pName = s.planName || 'Starter PG Plan';
    if (pName.toLowerCase().includes('enterprise')) pName = 'Enterprise Co-Living';
    else if (pName.toLowerCase().includes('professional')) pName = 'Professional Growth';
    else pName = 'Starter PG Plan';

    setPlanForm({
      planName: pName,
      planPrice: s.planPrice || 1499,
      billingCycle: s.billingCycle || 'MONTHLY',
    });
  };

  const openVerificationModal = (s: Subscriber) => {
    setVerifyingOrg(s);
    setVerifyForm({
      validityDays: 30,
      planName: s.planName || 'Starter PG Plan',
      welcomeNotes: '',
    });
  };

  const openRejectionModal = (s: Subscriber) => {
    setRejectingOrg(s);
    setRejectionReason('Incomplete KYC or License Documentation');
    setOrgRejectionNotes('');
    setAutoRefund(true);
  };

  const toggleSelectOrg = (id: string) => {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrgIds.size === paginatedSubscribers.length && paginatedSubscribers.length > 0) {
      setSelectedOrgIds(new Set());
    } else {
      setSelectedOrgIds(new Set(paginatedSubscribers.map((s) => s.id)));
    }
  };

  const isPendingApproval = (status?: string) => {
    if (!status) return false;
    const s = status.toUpperCase().trim();
    return s === 'PENDING_APPROVAL' || s === 'PENDING' || s === 'PENDING_ONBOARDING' || s === 'WAITLIST';
  };

  const renderStatusPill = (status?: string) => {
    const s = (status || 'ACTIVE').toUpperCase().trim();
    if (s === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    }
    if (s === 'TRIAL' || s === 'TRIALING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Trial
        </span>
      );
    }
    if (isPendingApproval(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
          Pending Approval
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-850 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        {s}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12 sm:pb-6 max-w-[1600px] mx-auto px-1 sm:px-2">
      {/* Header with Export & Refresh */}
      <PageHeader
        title="SaaS Subscriber Organizations"
        description="Multi-tenant governance hub: inspect subscriber organizations, property portfolios, staff directories, bed capacity, and plan quotas."
        icon={Building2}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV('saas-organizations', rawSubscribers)}
              className="shadow-xs hover:bg-muted font-semibold text-xs h-9 px-3 rounded-xl"
            >
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] })}
              className="shadow-xs h-9 w-9 p-0 rounded-xl"
              title="Refresh Data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* KPI Cards with Clean Typography & Symmetrical Padding */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5">
        <div className="rounded-2xl p-4 sm:p-5 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Organizations</p>
            {statsLoading ? (
              <div className="h-7 w-16 rounded-md bg-muted animate-pulse mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{totalSubscribers ?? '—'}</p>
            )}
            <p className="text-[10px] sm:text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">Active workspaces</p>
          </div>
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shrink-0">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-5 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Clients</p>
            {statsLoading ? (
              <div className="h-7 w-12 rounded-md bg-muted animate-pulse mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{activeSubscribers ?? '—'}</p>
            )}
            <p className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Paying subscribers</p>
          </div>
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50 shrink-0">
            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-5 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider">14-Day Trials</p>
            {statsLoading ? (
              <div className="h-7 w-10 rounded-md bg-muted animate-pulse mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{trialSubscribers ?? '—'}</p>
            )}
            <p className="text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">Trial conversions</p>
          </div>
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/50 shrink-0">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-5 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Properties</p>
            {statsLoading ? (
              <div className="h-7 w-12 rounded-md bg-muted animate-pulse mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{totalProperties ?? '—'}</p>
            )}
            <p className="text-[10px] sm:text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
              {statsLoading ? '…' : `${totalBeds ?? '—'} beds`}
            </p>
          </div>
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/50 shrink-0">
            <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl p-4 sm:p-5 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Monthly MRR</p>
            {statsLoading ? (
              <div className="h-7 w-20 rounded-md bg-muted animate-pulse mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{totalSaaSRev != null ? formatCurrency(totalSaaSRev) : '—'}</p>
            )}
            <p className="text-[10px] sm:text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">Recurring revenue</p>
          </div>
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900/50 shrink-0">
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
      </div>

      {/* Top Tab Switcher: Subscribers Directory vs Validity Extension Approvals Hub vs Refunds & Diagnostics (Super Admin Only) */}
      {isSuperAdmin && (
        <div className="border-b pb-3 pt-1 w-full">
          <Tabs value={mainTab} onValueChange={(v: any) => setMainTab(v)} className="w-full">
            <div className="w-full overflow-x-auto pb-1 scrollbar-none">
              <TabsList className="flex items-center gap-1.5 w-max min-w-full sm:w-auto h-11 bg-muted/60 p-1 rounded-xl">
                <TabsTrigger value="subscribers" className="text-xs font-bold gap-2 px-3.5 py-1.5 rounded-lg shrink-0 whitespace-nowrap">
                  <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>Subscribers ({totalSubscribers})</span>
                </TabsTrigger>
                <TabsTrigger value="approvals" className="text-xs font-bold gap-2 px-3.5 py-1.5 rounded-lg shrink-0 whitespace-nowrap relative">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Approvals Hub</span>
                  {pendingRequests.length > 0 && (
                    <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0 h-4 rounded-full ml-1">
                      {pendingRequests.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="refunds" className="text-xs font-bold gap-2 px-3.5 py-1.5 rounded-lg shrink-0 whitespace-nowrap relative">
                  <Receipt className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Refunds &amp; Diagnostics</span>
                  {onboardingFailures.length > 0 && (
                    <Badge className="bg-rose-600 hover:bg-rose-600 text-white text-[10px] px-1.5 py-0 h-4 rounded-full ml-1">
                      {onboardingFailures.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      )}

      {(!isSuperAdmin || mainTab === 'subscribers') ? (
        <>
          {/* PENDING VALIDITY EXTENSION APPROVALS ALERT BANNER (Super Admin Only) */}
          {isSuperAdmin && pendingRequests.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-500 text-white shadow-xs">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      Pending Validity Extension Approvals
                      <Badge className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {pendingRequests.length} Escalated
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Support agents have requested validity extensions for the following subscriber organizations.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMainTab('approvals')}
                  className="text-xs font-semibold border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                >
                  View Approvals Hub <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                {pendingRequests.map((req: any) => (
                  <div key={req.id} className="p-3.5 rounded-lg border bg-card/90 backdrop-blur-xs space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs truncate">{req.organization?.name || 'Subscriber PG'}</span>
                      <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 font-bold">
                        +{req.additionalDays} Days
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground space-y-1">
                      <p>Requested by: <strong>{req.requestedBy?.email || 'Support Agent'}</strong></p>
                      {req.reason && <p className="italic text-slate-700 dark:text-slate-300">"{req.reason}"</p>}
                      <p className="text-[10px]">Submitted: {formatDate(req.createdAt)}</p>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-muted">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={approveExtensionMut.isPending}
                        onClick={() => approveExtensionMut.mutate({ id: req.id })}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1 border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        disabled={rejectExtensionMut.isPending}
                        onClick={() => {
                          setRejectingReq(req);
                          setRejectionNotes('');
                        }}
                      >
                        <XCircle className="mr-1 h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Toolbar: Perfectly Spaced Search Bar, Status Filter Pills, Sorter, View Switcher */}
          <div className="bg-card rounded-xl border p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Instant Multi-Field Search Bar with Clean Icon & Clear Button */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by organization, subdomain, owner email, mobile..."
              className="w-full pl-10 pr-9 h-10 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sorter & View Switcher */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline font-medium">Sort:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9 w-[150px] text-xs rounded-lg bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="properties">Most Properties</SelectItem>
                  <SelectItem value="beds">Most Beds</SelectItem>
                  <SelectItem value="mrr">Highest MRR</SelectItem>
                  <SelectItem value="expiry">Expiry Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-muted">
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                onClick={() => setViewMode('grid')}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md ${viewMode === 'grid' ? 'shadow-xs bg-indigo-600 text-white hover:bg-indigo-700' : 'text-muted-foreground'}`}
              >
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> Cards
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                onClick={() => setViewMode('table')}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md ${viewMode === 'table' ? 'shadow-xs bg-indigo-600 text-white hover:bg-indigo-700' : 'text-muted-foreground'}`}
              >
                <List className="mr-1.5 h-3.5 w-3.5" /> Table
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Pills with Generous Sizing, Optimal Padding & Modern Pill Badges */}
        <div className="flex items-center gap-2.5 overflow-x-auto pt-2 pb-1 scrollbar-none w-full">
          {[
            { id: 'ALL', label: 'All Organizations', count: totalSubscribers },
            { id: 'PENDING_APPROVAL', label: '⏳ Pending Approval', count: pendingApprovals },
            { id: 'ACTIVE', label: 'Active Paid', count: activeSubscribers },
            { id: 'TRIAL', label: 'In Trial', count: trialSubscribers },
            { id: 'ENTERPRISE', label: 'Enterprise & White-Label', count: enterpriseSubscribers },
            { id: 'PAYMENT_LOCKED', label: 'Locked / Overdue', count: lockedSubscribers },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => {
                setStatusFilter(pill.id);
                setCurrentPage(1);
              }}
              className={`h-9.5 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-xs shrink-0 ${
                statusFilter === pill.id
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-600/20 shadow-sm'
                  : 'bg-muted/60 hover:bg-muted text-slate-600 dark:text-slate-300 hover:text-foreground border border-border/40'
              }`}
            >
              {statusFilter === pill.id && isLoading ? (
                <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
              ) : null}
              {pill.label}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-black shrink-0 ${
                statusFilter === pill.id ? 'bg-white/20 text-white' : 'bg-background/80 text-muted-foreground border border-border/30'
              }`}>
                {statsLoading ? (
                  <span className="inline-block w-4 h-2 rounded bg-current opacity-30 animate-pulse" />
                ) : (statusFilter === pill.id && isLoading ? '…' : (pill.count ?? '—'))}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
          <p className="font-medium">Loading organization portfolios...</p>
        </div>
      ) : paginatedSubscribers.length === 0 ? (
        <div className="p-12 text-center border rounded-xl bg-card space-y-3">
          <Building2 className="h-10 w-10 mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No organizations found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {search ? `No results matching "${search}". Try clearing search keywords.` : 'Try selecting a different status filter.'}
          </p>
          {search && (
            <Button size="sm" variant="outline" onClick={() => setSearch('')} className="text-xs mt-2">
              Clear Search
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* 1. BALANCED GRID CARD VIEW */
        <div className="grid gap-5 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {paginatedSubscribers.map((s) => {
            const occupancyPct = s.totalBeds > 0 ? Math.round(((s.occupiedBeds || 0) / s.totalBeds) * 100) : 0;
            return (
              <div
                key={s.id}
                className="group rounded-2xl border bg-card p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Top Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-base flex items-center justify-center shadow-xs shrink-0">
                        {initials(s.name) || 'PG'}
                      </div>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <button
                          onClick={() => openOverview(s)}
                          className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-left transition truncate block w-full"
                          title={s.name}
                        >
                          {s.name}
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                          <span className="truncate max-w-[130px] sm:max-w-[170px]">{s.subdomain}.stayeaze.com</span>
                          <button
                            onClick={() => copyToClipboard(`${s.subdomain}.stayeaze.com`, 'Subdomain URL')}
                            className="hover:text-indigo-600 shrink-0"
                            title="Copy subdomain URL"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {renderStatusPill(s.status)}
                      {s.isEnterprise && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900">
                          <Palette className="h-3 w-3" /> White-Label
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Plan & MRR Pill */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border text-xs gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{s.planName || 'Starter PG Plan'}</span>
                    </span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                      {formatCurrency(s.planPrice || 0)} / {s.billingCycle || 'mo'}
                    </span>
                  </div>

                  {/* Capacity & Live Occupancy Gauge */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-medium text-muted-foreground">Capacity Occupancy</span>
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">
                        {s.occupiedBeds || 0} / {s.totalBeds || 0} Beds ({occupancyPct}%)
                      </span>
                    </div>
                    <Progress value={occupancyPct} className="h-2 rounded-full" />
                  </div>

                  {/* Properties & Owner Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border">
                      <Building2 className="h-4 w-4 text-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{s.propertyCount || 1} Property(s)</p>
                        <p className="text-[10px] text-muted-foreground">Branches</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border">
                      <Users className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{s.ownerName || 'Owner'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.ownerEmail}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons Footer with Optimal Sizing, Margin & Padding */}
                {isPendingApproval(s.status) ? (
                  <div className="pt-4 mt-4 border-t border-amber-500/20 flex flex-col gap-2">
                    {s.paymentId && (
                      <div className="flex items-center justify-between text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-300 p-2 rounded-lg font-mono">
                        <span>Razorpay Payment:</span>
                        <span className="font-bold truncate max-w-[150px]">{s.paymentId}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => openVerificationModal(s)}
                        disabled={approveSubscriberMut.isPending}
                        className="flex-1 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs h-9.5 px-3 rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all active:scale-[0.98]"
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve &amp; Activate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRejectionModal(s)}
                        disabled={rejectSubscriberMut.isPending}
                        className="h-9.5 px-3 text-xs font-bold rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all active:scale-[0.98]"
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openOverview(s)}
                        className="h-9.5 px-2.5 rounded-xl text-xs"
                        title="Review Application Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3.5 mt-4 border-t border-border/60 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      onClick={() => openOverview(s)}
                      className="flex-1 min-w-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-3 rounded-xl shadow-xs transition-all hover:shadow flex items-center justify-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">View Portfolio</span>
                    </Button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openBrandingModal(s)}
                        className="h-9 w-9 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/60 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center justify-center transition-all shadow-xs"
                        title="Enterprise White-Label Custom Branding"
                      >
                        <Palette className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtendTarget(s)}
                        className="h-9 w-9 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center justify-center transition-all shadow-xs"
                        title="Extend Subscription Validity"
                      >
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => impersonateMut.mutate(s.id)}
                        disabled={impersonateMut.isPending}
                        className="h-9 w-9 rounded-xl border border-border bg-muted/50 hover:bg-muted text-slate-600 dark:text-slate-300 hover:text-indigo-600 flex items-center justify-center transition-all shadow-xs disabled:opacity-50"
                        title="Support Diagnostic Login"
                      >
                        <LogIn className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* 2. COMPACT TABLE VIEW */
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Subscriber Organization</TableHead>
                <TableHead>Owner Contact</TableHead>
                <TableHead>Plan &amp; Limits</TableHead>
                <TableHead>Properties &amp; Beds</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSubscribers.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/40 transition">
                  <TableCell>
                    <div className="space-y-0.5">
                      <button
                        onClick={() => openOverview(s)}
                        className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 hover:text-indigo-600 text-left text-sm"
                      >
                        {s.name}
                        {s.isEnterprise && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                            <Palette className="h-3 w-3" /> White-Label
                          </span>
                        )}
                      </button>
                      <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400">{s.subdomain}.stayeaze.com</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-xs">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{s.ownerName}</div>
                      <div className="text-slate-500">{s.ownerEmail} • {s.ownerMobile}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">{s.planName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatCurrency(s.planPrice)} / {s.billingCycle}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-indigo-500" /> {s.propertyCount} Property(s)
                      </span>
                      <div className="text-slate-500">{s.occupiedBeds}/{s.totalBeds} beds occupied</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {formatDate(s.endDate)}
                  </TableCell>
                  <TableCell>
                    {renderStatusPill(s.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isPendingApproval(s.status) ? (
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => openVerificationModal(s)}
                          disabled={approveSubscriberMut.isPending}
                          className="text-xs h-8 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg shadow-sm hover:shadow transition-all"
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRejectionModal(s)}
                          disabled={rejectSubscriberMut.isPending}
                          className="text-xs h-8 px-2.5 font-bold rounded-lg border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openOverview(s)}
                          className="text-xs h-8 px-2 rounded-lg"
                          title="Review Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          onClick={() => openOverview(s)}
                          className="text-xs h-8.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs inline-flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <Eye className="h-3.5 w-3.5 shrink-0" /> View Portfolio
                        </Button>
                        <button
                          type="button"
                          onClick={() => openBrandingModal(s)}
                          className="h-8.5 w-8.5 rounded-xl border border-purple-200 dark:border-purple-900/60 text-purple-700 dark:text-purple-300 bg-purple-50/60 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center justify-center transition shadow-2xs shrink-0"
                          title="White-Label Branding"
                        >
                          <Palette className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExtendTarget(s)}
                          className="h-8.5 w-8.5 rounded-xl border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center justify-center transition shadow-2xs shrink-0"
                          title="Extend Validity"
                        >
                          <Clock className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                        </button>
                        <button
                          type="button"
                          onClick={() => impersonateMut.mutate(s.id)}
                          disabled={impersonateMut.isPending}
                          className="h-8.5 w-8.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-slate-600 dark:text-slate-300 hover:text-indigo-600 flex items-center justify-center transition disabled:opacity-50 shadow-2xs shrink-0"
                          title="Support Diagnostic Login"
                        >
                          <LogIn className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 px-1">
        <div>
          Showing {totalSubscribers === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalSubscribers || 0)} of {totalSubscribers || 0} organizations
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[72px] text-xs rounded-lg bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  ) : (
    /* VALIDITY EXTENSION APPROVALS HUB (Full Tab Interface) */
    <div className="space-y-4">
      <Card className="border-l-4 border-l-amber-500 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              SaaS Subscription Validity Extension Approvals
            </CardTitle>
            <CardDescription>
              Review, approve, or reject validity extension proposals submitted by Platform Support agents.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap overflow-x-auto w-full sm:w-auto scrollbar-none pb-1">
            <Button
              variant={approvalStatusFilter === 'PENDING' ? 'default' : 'outline'}
              className={approvalStatusFilter === 'PENDING' ? 'bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm h-9.5 rounded-xl font-bold px-3.5 shrink-0 shadow-xs' : 'text-xs sm:text-sm h-9.5 rounded-xl font-semibold px-3.5 shrink-0'}
              onClick={() => setApprovalStatusFilter('PENDING')}
            >
              Pending ({pendingRequests.length})
            </Button>
            <Button
              variant={approvalStatusFilter === 'APPROVED' ? 'default' : 'outline'}
              className={approvalStatusFilter === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm h-9.5 rounded-xl font-bold px-3.5 shrink-0 shadow-xs' : 'text-xs sm:text-sm h-9.5 rounded-xl font-semibold px-3.5 shrink-0'}
              onClick={() => setApprovalStatusFilter('APPROVED')}
            >
              Approved
            </Button>
            <Button
              variant={approvalStatusFilter === 'REJECTED' ? 'default' : 'outline'}
              className={approvalStatusFilter === 'REJECTED' ? 'bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm h-9.5 rounded-xl font-bold px-3.5 shrink-0 shadow-xs' : 'text-xs sm:text-sm h-9.5 rounded-xl font-semibold px-3.5 shrink-0'}
              onClick={() => setApprovalStatusFilter('REJECTED')}
            >
              Rejected
            </Button>
            <Button
              variant={approvalStatusFilter === 'ALL' ? 'default' : 'outline'}
              className="text-xs sm:text-sm h-9.5 rounded-xl font-semibold px-3.5 shrink-0"
              onClick={() => setApprovalStatusFilter('ALL')}
            >
              All Requests
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loadingExtensionRequests ? (
            <div className="py-16 text-center text-sm text-muted-foreground space-y-2">
              <RefreshCw className="h-7 w-7 animate-spin mx-auto text-amber-600" />
              <p>Loading extension requests...</p>
            </div>
          ) : allExtensionRequests.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-3">
              <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100 dark:border-amber-900">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {approvalStatusFilter === 'PENDING'
                    ? 'No Pending Approvals in Queue'
                    : `No ${approvalStatusFilter.toLowerCase()} extension requests found`}
                </h4>
                <p className="text-xs max-w-md mx-auto">
                  When platform support agents submit courtesy validity extensions for subscriber PG organizations, they will appear here with justification notes for Super Admin review.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allExtensionRequests.map((req: any) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border bg-card/90 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {req.organization?.name || 'Subscriber Organization'}
                        </h4>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {req.organization?.subdomain}.stayeaze.com
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          req.status === 'APPROVED'
                            ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-[10px] font-bold'
                            : req.status === 'REJECTED'
                            ? 'border-rose-500 text-rose-600 bg-rose-50/50 dark:bg-rose-950/30 text-[10px] font-bold'
                            : 'border-amber-500 text-amber-600 bg-amber-50/50 dark:bg-amber-950/30 text-[10px] font-bold'
                        }
                      >
                        +{req.additionalDays} Days • {req.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 pt-1">
                      <p>
                        Requested by: <strong className="text-slate-800 dark:text-slate-200">{req.requestedBy?.email || 'Support Agent'}</strong>
                      </p>
                      {req.reason && (
                        <div className="p-2 rounded bg-muted/50 text-[11px] text-slate-700 dark:text-slate-300 italic">
                          "{req.reason}"
                        </div>
                      )}
                      {req.reviewNotes && (
                        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                          Reviewer Remarks: <strong>{req.reviewNotes}</strong>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                      <span>Submitted: {formatDate(req.createdAt)}</span>
                      {req.reviewedAt && <span>Reviewed: {formatDate(req.reviewedAt)}</span>}
                    </div>
                  </div>

                  {req.status === 'PENDING' ? (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        className="h-8 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        disabled={approveExtensionMut.isPending}
                        onClick={() => approveExtensionMut.mutate({ id: req.id })}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve (+{req.additionalDays}d)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs flex-1 border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold"
                        disabled={rejectExtensionMut.isPending}
                        onClick={() => {
                          setRejectingReq(req);
                          setRejectionNotes('');
                        }}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="pt-2 text-center text-xs text-muted-foreground">
                      Reviewed by <strong>{req.reviewedBy?.email || 'Super Admin'}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )}

  {/* ======================================================== */}
  {/* 💳 REFUNDS & PAYMENT DIAGNOSTICS HUB (SUPER ADMIN ONLY) */}
  {/* ======================================================== */}
  {isSuperAdmin && mainTab === 'refunds' && (
    <div className="space-y-6">
      {/* Overview Statistics Banner */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl p-4 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Subscription Revenue</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {loadingRefundStats ? '…' : formatCurrency(refundsStats?.subscriptionRevenue || 0)}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Active Workspace Plans</p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50 shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl p-4 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Refunds on Rejection</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {loadingRefundStats ? '…' : formatCurrency(refundsStats?.refundsOnRejection || 0)}
            </p>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">Dispatched to source accounts</p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/50 shrink-0">
            <RotateCcw className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl p-4 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">In-Transit Settlements</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {loadingRefundStats ? '…' : (refundsStats?.inTransitSettlements ?? 0)}
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">5-7 Business Days at Bank</p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/50 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl p-4 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Dropped Checkouts</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {loadingRefundStats ? '…' : (refundsStats?.droppedCheckouts ?? onboardingFailures.length)}
            </p>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">1-Click Recoverable Leads</p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shrink-0">
            <Zap className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Subtab Toggle: Refunds Ledger vs Failed Checkouts Recovery */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl">
          <Button
            size="sm"
            variant={refundsSubTab === 'refunds' ? 'default' : 'ghost'}
            className="text-xs font-bold gap-2 h-8"
            onClick={() => setRefundsSubTab('refunds')}
          >
            <Receipt className="h-3.5 w-3.5" />
            Subscription Refunds Ledger ({refundRecords.length})
          </Button>
          <Button
            size="sm"
            variant={refundsSubTab === 'dropped_checkouts' ? 'default' : 'ghost'}
            className="text-xs font-bold gap-2 h-8 relative"
            onClick={() => setRefundsSubTab('dropped_checkouts')}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Dropped Checkout Recoveries ({onboardingFailures.length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchRefundStats();
              refetchRefunds();
              refetchFailures();
              toast.success('Refunds and diagnostics ledger refreshed!');
            }}
            className="text-xs h-8 gap-1.5 shadow-2xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Data
          </Button>
        </div>
      </div>

      {/* SUB-VIEW 1: REFUNDS & SETTLEMENTS LEDGER */}
      {refundsSubTab === 'refunds' && (
        <Card className="border shadow-xs">
          <CardHeader className="p-4 sm:p-5 border-b space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-emerald-600" />
                  Subscription Refunds & Settlement ARN Tracking
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Track full bank lifecycle for onboarding fees refunded upon workspace rejection with live Acquirer Reference Numbers (ARN / UTR).
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search org, email, refund ID, ARN..."
                    className="pl-8 text-xs h-8"
                    value={refundSearch}
                    onChange={(e) => setRefundSearch(e.target.value)}
                  />
                </div>

                <Select value={refundStatusFilter} onValueChange={setRefundStatusFilter}>
                  <SelectTrigger className="w-[180px] text-xs h-8">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                    <SelectItem value="SETTLED_TO_SOURCE" className="text-xs">Settled to Source Bank</SelectItem>
                    <SelectItem value="PROCESSING_BY_BANK" className="text-xs">In-Transit at Bank</SelectItem>
                    <SelectItem value="REFUND_FAILED" className="text-xs">Refund Failed</SelectItem>
                    <SelectItem value="MANUAL_REQUIRED" className="text-xs">Manual Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingRefunds ? (
              <div className="py-16 text-center text-sm text-muted-foreground space-y-2">
                <RefreshCw className="h-7 w-7 animate-spin mx-auto text-emerald-600" />
                <p>Loading refund lifecycle records...</p>
              </div>
            ) : refundRecords.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-3">
                <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">No Refund Transactions Found</h4>
                  <p className="text-xs max-w-md mx-auto">
                    When an onboarding applicant is rejected with an active Razorpay payment, automatic refund logs and bank settlement reference numbers will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-bold">Organization & Owner</TableHead>
                      <TableHead className="text-xs font-bold">Plan & Fee Paid</TableHead>
                      <TableHead className="text-xs font-bold">Gateway Identifiers</TableHead>
                      <TableHead className="text-xs font-bold">Refund Settlement Status & ARN</TableHead>
                      <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refundRecords
                      .filter((r: any) => {
                        const q = refundSearch.toLowerCase();
                        const matchQ = !q ||
                          r.organizationName?.toLowerCase().includes(q) ||
                          r.ownerEmail?.toLowerCase().includes(q) ||
                          r.ownerName?.toLowerCase().includes(q) ||
                          r.refundId?.toLowerCase().includes(q) ||
                          r.refundArn?.toLowerCase().includes(q) ||
                          r.paymentId?.toLowerCase().includes(q);

                        const matchStatus = refundStatusFilter === 'ALL' ||
                          (refundStatusFilter === 'SETTLED_TO_SOURCE' && (r.refundStatus === 'SETTLED_TO_SOURCE' || r.refundStatus === 'REFUNDED_VIA_RAZORPAY')) ||
                          (refundStatusFilter === 'PROCESSING_BY_BANK' && (r.refundStatus === 'PROCESSING_BY_BANK' || r.refundStatus === 'INITIATED')) ||
                          (refundStatusFilter === 'REFUND_FAILED' && r.refundStatus === 'REFUND_FAILED') ||
                          (refundStatusFilter === 'MANUAL_REQUIRED' && r.refundStatus === 'MANUAL_REQUIRED');

                        return matchQ && matchStatus;
                      })
                      .map((rec: any) => {
                        const isSettled = rec.refundStatus === 'SETTLED_TO_SOURCE' || rec.refundStatus === 'REFUNDED_VIA_RAZORPAY';
                        const isPending = rec.refundStatus === 'PROCESSING_BY_BANK' || rec.refundStatus === 'INITIATED';
                        const isFailed = rec.refundStatus === 'REFUND_FAILED';

                        return (
                          <TableRow key={rec.organizationId} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="py-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                                    {rec.organizationName}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={
                                      rec.orgStatus === 'REJECTED'
                                        ? 'border-rose-500 text-rose-600 bg-rose-50/50 text-[10px]'
                                        : 'border-emerald-500 text-emerald-600 bg-emerald-50/50 text-[10px]'
                                    }
                                  >
                                    {rec.orgStatus}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                                  <span>{rec.ownerName || 'Property Owner'}</span>
                                  <span>•</span>
                                  <span className="font-mono">{rec.ownerEmail}</span>
                                  {rec.ownerMobile && (
                                    <>
                                      <span>•</span>
                                      <span>{rec.ownerMobile}</span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell className="py-3">
                              <div className="space-y-0.5">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  {formatCurrency(rec.refundAmount || rec.planPrice || 1499)}
                                </span>
                                <p className="text-[11px] text-muted-foreground">{rec.planName || 'Starter PG Plan'}</p>
                              </div>
                            </TableCell>

                            <TableCell className="py-3">
                              <div className="space-y-1 font-mono text-[11px]">
                                {rec.paymentId && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Pay ID:</span>
                                    <span className="text-slate-800 dark:text-slate-200">{rec.paymentId}</span>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(rec.paymentId);
                                        toast.success('Payment ID copied!');
                                      }}
                                      className="hover:text-primary transition-colors"
                                      title="Copy Payment ID"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                                {rec.refundId && (
                                  <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                    <span className="text-[10px] uppercase font-bold text-indigo-400">Refund ID:</span>
                                    <span>{rec.refundId}</span>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(rec.refundId);
                                        toast.success('Refund ID copied!');
                                      }}
                                      className="hover:text-indigo-800 transition-colors"
                                      title="Copy Refund ID"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="py-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  {isSettled ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-[11px] font-bold gap-1 py-0.5">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Settled to Source Bank
                                    </Badge>
                                  ) : isPending ? (
                                    <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/30 text-[11px] font-bold gap-1 py-0.5">
                                      <Clock className="h-3 w-3 animate-spin" />
                                      In-Transit at Bank (5-7 Days)
                                    </Badge>
                                  ) : isFailed ? (
                                    <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/30 text-[11px] font-bold gap-1 py-0.5">
                                      <AlertTriangle className="h-3 w-3" />
                                      Refund Failed
                                    </Badge>
                                  ) : rec.refundStatus === 'NO_REFUND' ? (
                                    <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/30 text-[11px] font-bold gap-1 py-0.5">
                                      <Check className="h-3 w-3" />
                                      Active (No Refund)
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[11px]">
                                      {rec.refundStatus || 'Processing'}
                                    </Badge>
                                  )}
                                </div>

                                {rec.refundArn ? (
                                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    <span className="font-bold">Bank ARN:</span>
                                    <span>{rec.refundArn}</span>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(rec.refundArn);
                                        toast.success('Acquirer Reference Number (ARN) copied!');
                                      }}
                                      className="hover:text-emerald-900 transition-colors ml-1"
                                      title="Copy Bank ARN"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : isPending ? (
                                  <p className="text-[10px] text-amber-700 dark:text-amber-300">
                                    Acquirer bank reference will generate upon RTGS/NEFT settlement clearance.
                                  </p>
                                ) : isFailed ? (
                                  <p className="text-[10px] text-rose-600">
                                    {rec.refundErrorDescription || 'Bank transfer rejected by customer account.'}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell className="py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs gap-1 shadow-2xs"
                                  disabled={syncLiveRefundMut.isPending}
                                  onClick={() => syncLiveRefundMut.mutate(rec.organizationId)}
                                  title="Sync live status with Razorpay API"
                                >
                                  <RefreshCw className={`h-3.5 w-3.5 ${syncLiveRefundMut.isPending ? 'animate-spin' : ''}`} />
                                  Sync Live
                                </Button>

                                {isSettled && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1 border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shadow-2xs"
                                    disabled={sendArnReceiptMut.isPending}
                                    onClick={() => sendArnReceiptMut.mutate(rec.organizationId)}
                                    title="Email Official Bank Settlement Certificate with ARN"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                    Email ARN
                                  </Button>
                                )}

                                {(isFailed || rec.refundStatus === 'MANUAL_REQUIRED') && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 text-xs gap-1 shadow-2xs font-bold"
                                    disabled={retryRefundMut.isPending}
                                    onClick={() => retryRefundMut.mutate(rec.organizationId)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Retry Refund
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SUB-VIEW 2: DROPPED ONBOARDING CHECKOUT RECOVERY FUNNEL */}
      {refundsSubTab === 'dropped_checkouts' && (
        <Card className="border shadow-xs space-y-4">
          <CardHeader className="p-4 sm:p-5 border-b">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-indigo-600" />
                  Dropped Onboarding Checkout Recovery Funnel
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Applicants who initiated property workspace creation but encountered gateway drops, OTP timeouts, or declined cards. Dispatch 1-click active checkout recovery links.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingFailures ? (
              <div className="py-16 text-center text-sm text-muted-foreground space-y-2">
                <RefreshCw className="h-7 w-7 animate-spin mx-auto text-indigo-600" />
                <p>Loading dropped checkouts...</p>
              </div>
            ) : onboardingFailures.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-3">
                <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 dark:border-indigo-900">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">No Dropped Checkouts in Queue</h4>
                  <p className="text-xs max-w-md mx-auto">
                    All onboarding registrations have successfully converted or have no unresolved checkout dropouts.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-bold">Applicant Contact</TableHead>
                      <TableHead className="text-xs font-bold">Property & Plan</TableHead>
                      <TableHead className="text-xs font-bold">Failure Diagnostics</TableHead>
                      <TableHead className="text-xs font-bold">Attempt Timestamp</TableHead>
                      <TableHead className="text-xs font-bold text-right">Recovery Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {onboardingFailures.map((lead: any) => (
                      <TableRow key={lead.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="py-3">
                          <div className="space-y-0.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{lead.ownerName}</span>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <span className="font-mono">{lead.ownerEmail}</span>
                              {lead.ownerPhone && (
                                <>
                                  <span>•</span>
                                  <span>{lead.ownerPhone}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="space-y-0.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{lead.propertyName}</span>
                            <p className="text-[11px] font-mono text-muted-foreground">Code: {lead.propertyCode}</p>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="space-y-1">
                            <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/30 text-[10px] font-bold py-0.5">
                              {lead.failureCode || 'PAYMENT_INTERRUPTED'}
                            </Badge>
                            {lead.failureDescription && (
                              <p className="text-[11px] text-muted-foreground max-w-xs truncate" title={lead.failureDescription}>
                                {lead.failureDescription}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-3 text-xs text-muted-foreground">
                          <div>{lead.createdAt ? formatDate(lead.createdAt) : 'Recently'}</div>
                          {lead.lastContactedAt && (
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                              Link sent: {formatDate(lead.lastContactedAt)}
                            </p>
                          )}
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 shadow-2xs"
                              onClick={() => {
                                navigator.clipboard.writeText(lead.recoveryUrl || `https://stayeaze.com/signup?resume=${lead.id}`);
                                toast.success('24-Hour Recovery Link copied to clipboard!');
                              }}
                              title="Copy Recovery Link"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy Link
                            </Button>

                            <Button
                              size="sm"
                              className="h-8 text-xs gap-1.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs"
                              disabled={sendRecoveryLinkMut.isPending}
                              onClick={() => sendRecoveryLinkMut.mutate(lead.id)}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Send 1-Click Link
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )}

  {/* REJECTION REMARKS MODAL */}
  <Dialog open={!!rejectingReq} onOpenChange={(open) => !open && setRejectingReq(null)}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-rose-500/10 text-rose-600">
            <XCircle className="h-5 w-5" />
          </span>
          <div>
            <DialogTitle className="text-base font-bold">
              Reject Extension Request
            </DialogTitle>
            <DialogDescription className="text-xs">
              {rejectingReq?.organization?.name} (+{rejectingReq?.additionalDays} Days requested)
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-3 py-2">
        <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1">
          <p>Requested by: <strong>{rejectingReq?.requestedBy?.email}</strong></p>
          {rejectingReq?.reason && <p className="italic text-muted-foreground">"{rejectingReq.reason}"</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Rejection Remarks / Reason for Support</Label>
          <Textarea
            className="text-xs min-h-[90px]"
            placeholder="E.g., Subscriber has unpaid invoices; require clearing balance before granting grace period..."
            value={rejectionNotes}
            onChange={(e) => setRejectionNotes(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => setRejectingReq(null)} className="text-xs">
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="text-xs font-bold"
          disabled={rejectExtensionMut.isPending}
          onClick={() => {
            if (rejectingReq) {
              rejectExtensionMut.mutate({ id: rejectingReq.id, notes: rejectionNotes });
            }
          }}
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          {rejectExtensionMut.isPending ? 'Rejecting...' : 'Confirm Rejection'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

      {/* 1. FULL ORGANIZATION INTELLIGENCE DOSSIER (MODAL) */}
      <Dialog open={!!selectedOrgId} onOpenChange={(open) => !open && setSelectedOrgId(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[88vh] p-0 rounded-2xl overflow-hidden border bg-card gap-0 flex flex-col shadow-2xl" hideCloseButton>
          {/* Hero Header Ribbon */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-4 sm:p-6 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-white/10 backdrop-blur-md text-white font-black text-xl sm:text-2xl flex items-center justify-center border border-white/20 shadow-lg shrink-0">
                  {initials(selectedOrgName) || 'PG'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-white truncate max-w-[220px] sm:max-w-md">{selectedOrgName || 'Organization Portfolio'}</h2>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] font-bold">
                      {orgOverview?.billingProfile?.subscriptionStatus || 'ACTIVE'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-xs text-indigo-200 mt-1 font-mono flex-wrap">
                    <span className="truncate max-w-[140px] sm:max-w-none">{orgOverview?.organization?.subdomain}.stayeaze.com</span>
                    <span>•</span>
                    <span>Created: {formatDate(orgOverview?.organization?.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedOrgId && handleExportOrgJson(selectedOrgId, selectedOrgName)}
                  className="text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold rounded-xl h-9"
                >
                  <FileJson className="mr-1.5 h-3.5 w-3.5 text-emerald-400" /> Export JSON
                </Button>
                <Button
                  size="sm"
                  onClick={() => selectedOrgId && impersonateMut.mutate(selectedOrgId)}
                  disabled={impersonateMut.isPending}
                  className="bg-white text-indigo-950 hover:bg-white/90 font-bold text-xs shadow-md rounded-xl h-9"
                >
                  <LogIn className="mr-1.5 h-3.5 w-3.5 text-indigo-600" /> Support Login
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(88vh-140px)] flex-1">
            {loadingOverview ? (
              <div className="py-16 text-center text-sm text-muted-foreground space-y-2">
                <RefreshCw className="h-7 w-7 animate-spin mx-auto text-indigo-600" />
                <p>Loading multi-tenant portfolio details...</p>
              </div>
            ) : !orgOverview ? (
              <div className="py-12 text-center text-sm text-destructive">
                Failed to load organization overview details.
              </div>
            ) : (
              <>
                {/* 5-Column Stat Card Metrics */}
                <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  <div className="p-3 rounded-xl border bg-indigo-50/50 dark:bg-indigo-950/20 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Properties</p>
                    <p className="text-xl sm:text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {orgOverview.stats?.totalProperties || 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Max limit: {orgOverview.quotas?.maxProperties || 5}</p>
                  </div>

                  <div className="p-3 rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Beds</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {orgOverview.stats?.totalBeds || 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{orgOverview.stats?.occupiedBeds || 0} Occupied ({orgOverview.stats?.occupancyPercent || 0}%)</p>
                  </div>

                  <div className="p-3 rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Rooms</p>
                    <p className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                      {orgOverview.stats?.totalRooms || 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Across buildings</p>
                  </div>

                  <div className="p-3 rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Staff Accounts</p>
                    <p className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
                      {orgOverview.stats?.totalStaffCount || 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Staff & managers</p>
                  </div>

                  <div className="p-3 rounded-xl border bg-purple-50/50 dark:bg-purple-950/20 text-center col-span-2 sm:col-span-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Boarded Residents</p>
                    <p className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-300 mt-0.5">
                      {orgOverview.stats?.totalTenantsCount || 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Active residents</p>
                  </div>
                </div>

                {/* Tabs Hub with Scrollable Track */}
                <Tabs defaultValue="properties" className="w-full">
                  <div className="w-full overflow-x-auto pb-1 scrollbar-none">
                    <TabsList className="flex items-center gap-1.5 w-max min-w-full h-11 bg-muted/60 p-1 rounded-xl">
                      <TabsTrigger value="properties" className="text-xs font-bold rounded-lg flex items-center justify-center gap-2 px-3.5 py-1.5 shrink-0 whitespace-nowrap">
                        <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>Properties ({orgOverview.properties?.length || 0})</span>
                      </TabsTrigger>
                      <TabsTrigger value="staff" className="text-xs font-bold rounded-lg flex items-center justify-center gap-2 px-3.5 py-1.5 shrink-0 whitespace-nowrap">
                        <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Staff Directory ({orgOverview.staff?.length || 0})</span>
                      </TabsTrigger>
                      <TabsTrigger value="quotas" className="text-xs font-bold rounded-lg flex items-center justify-center gap-2 px-3.5 py-1.5 shrink-0 whitespace-nowrap">
                        <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>Plan Quotas &amp; Health</span>
                      </TabsTrigger>
                      <TabsTrigger value="governance" className="text-xs font-bold rounded-lg flex items-center justify-center gap-2 px-3.5 py-1.5 shrink-0 whitespace-nowrap">
                        <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span>Governance &amp; Plan</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* TAB 1: PROPERTIES BREAKDOWN */}
                  <TabsContent value="properties" className="space-y-3 pt-3">
                    {(!orgOverview.properties || orgOverview.properties.length === 0) ? (
                      <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/20">
                        No properties registered by this organization yet.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {orgOverview.properties.map((p: any) => (
                          <div key={p.id} className="p-4 rounded-xl border bg-card shadow-xs hover:border-indigo-300 transition space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <Building2 className="h-4 w-4 text-indigo-600" /> {p.name}
                                </h4>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 text-slate-400" /> {p.city ? `${p.city}, ${p.state || ''}` : p.address || 'Address unlisted'}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                                {p.occupancyPercent}% Occupied
                              </Badge>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-xs bg-muted/40 p-2.5 rounded-lg">
                              <div>
                                <p className="text-muted-foreground font-semibold text-[10px] uppercase">Rooms</p>
                                <p className="font-bold text-sm">{p.totalRooms || 0}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground font-semibold text-[10px] uppercase">Total Beds</p>
                                <p className="font-bold text-sm">{p.totalBeds || 0}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground font-semibold text-[10px] uppercase">Occupied</p>
                                <p className="font-bold text-sm text-emerald-600">{p.occupiedBeds || 0}</p>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                                <span>Occupancy Progress</span>
                                <span>{p.occupiedBeds || 0} / {p.totalBeds || 0} Beds</span>
                              </div>
                              <Progress value={p.occupancyPercent || 0} className="h-2 rounded-full" />
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                              <span>Manager: <strong className="text-slate-800 dark:text-slate-200">{p.managerName || 'Unassigned'}</strong></span>
                              {p.phone && <span>Desk: {p.phone}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* TAB 2: STAFF & USER DIRECTORY */}
                  <TabsContent value="staff" className="space-y-3 pt-3">
                    <div className="rounded-xl border bg-card overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead>Staff Member</TableHead>
                            <TableHead>Contact Email / Phone</TableHead>
                            <TableHead>Assigned Roles</TableHead>
                            <TableHead>Property Scoping</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(!orgOverview.staff || orgOverview.staff.length === 0) ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-6 text-slate-500">No staff user accounts found.</TableCell></TableRow>
                          ) : (
                            orgOverview.staff.map((u: any) => (
                              <TableRow key={u.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                                      {initials(u.name) || 'U'}
                                    </div>
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">{u.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <div className="text-slate-800 dark:text-slate-200 font-medium">{u.email}</div>
                                  <div className="text-slate-500">{u.mobile}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {(u.roles || []).map((r: string) => (
                                      <Badge key={r} variant="outline" className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                        {r.replace('ROLE_', '')}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                  {u.propertyScope}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* TAB 3: PLAN QUOTAS & COMPLIANCE */}
                  <TabsContent value="quotas" className="space-y-4 pt-3">
                    <div className="space-y-4 p-5 border rounded-xl bg-slate-50 dark:bg-slate-900/50">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SaaS Quota Health</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Properties Allowed</span>
                          <span>{orgOverview.stats?.totalProperties} / {orgOverview.quotas?.maxProperties} ({orgOverview.quotas?.propertiesUsagePercent}%)</span>
                        </div>
                        <Progress value={orgOverview.quotas?.propertiesUsagePercent || 0} className="h-2.5 rounded-full" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Beds Capacity Quota</span>
                          <span>{orgOverview.stats?.totalBeds} / {orgOverview.quotas?.maxBeds} Beds ({orgOverview.quotas?.bedsUsagePercent}%)</span>
                        </div>
                        <Progress value={orgOverview.quotas?.bedsUsagePercent || 0} className="h-2.5 rounded-full" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Staff User Accounts</span>
                          <span>{orgOverview.stats?.totalStaffCount} / {orgOverview.quotas?.maxUsers} Users ({orgOverview.quotas?.usersUsagePercent}%)</span>
                        </div>
                        <Progress value={orgOverview.quotas?.usersUsagePercent || 0} className="h-2.5 rounded-full" />
                      </div>
                    </div>

                    <div className="p-4 border rounded-xl bg-card space-y-2 shadow-xs">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
                        <ShieldCheck className="h-4 w-4" /> Multi-Tenant Isolation & Compliance
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        ✓ Organization ID: <span className="font-mono text-[11px] font-bold">{orgOverview.organization?.id}</span><br />
                        ✓ Subdomain: <span className="font-mono text-[11px] font-bold text-indigo-600">{orgOverview.organization?.subdomain}.stayeaze.com</span><br />
                        ✓ Strict Schema Isolation: Verified all properties, rooms, beds, and tenants mapped to Org Foreign Key.
                      </p>
                    </div>
                  </TabsContent>

                  {/* TAB 4: GOVERNANCE & OVERRIDES (FIXED WITH OPTIMAL PADDING & VISIBLE LABELS) */}
                  <TabsContent value="governance" className="space-y-4 pt-3">
                    <div className="grid gap-5 sm:grid-cols-2">
                      {/* Organization Lifecycle Status Override */}
                      <div className="p-5 border rounded-2xl space-y-4 bg-card shadow-xs flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-bold text-slate-900 dark:text-white">Organization Lifecycle Status</Label>
                            <Badge variant="outline" className="text-xs font-semibold">
                              Current: {orgOverview.billingProfile?.subscriptionStatus || 'ACTIVE'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Control operational access for this organization workspace.
                          </p>
                          <Select
                            value={statusForm.status}
                            onValueChange={(v) => setStatusForm({ status: v })}
                          >
                            <SelectTrigger className="rounded-xl h-10 bg-background text-sm font-medium">
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ACTIVE">ACTIVE (Normal Operations)</SelectItem>
                              <SelectItem value="TRIAL">TRIAL (Free Trial Period)</SelectItem>
                              <SelectItem value="PAYMENT_LOCKED">PAYMENT_LOCKED (Read-Only Mode)</SelectItem>
                              <SelectItem value="SUSPENDED">SUSPENDED (Compliance Freeze)</SelectItem>
                              <SelectItem value="EXPIRED">EXPIRED (Subscription Ended)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          size="default"
                          onClick={() => selectedOrgId && updateStatusMut.mutate({ id: selectedOrgId, status: statusForm.status })}
                          disabled={updateStatusMut.isPending}
                          className="w-full font-bold rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                        >
                          {updateStatusMut.isPending ? 'Saving...' : 'Save Lifecycle Status'}
                        </Button>
                      </div>

                      {/* Override SaaS Plan Tier */}
                      <div className="p-5 border rounded-2xl space-y-4 bg-card shadow-xs flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-bold text-slate-900 dark:text-white">Override SaaS Plan Tier</Label>
                            <Badge variant="outline" className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                              Current: {orgOverview.billingProfile?.subscriptionPlanName || 'Starter PG Plan'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Grant custom plan tier and limits directly to this organization.
                          </p>
                          <Select
                            value={planForm.planName}
                            onValueChange={(v) => {
                              let p = 1499;
                              if (v.includes('Professional')) p = 2999;
                              if (v.includes('Enterprise')) p = 5999;
                              setPlanForm({ ...planForm, planName: v, planPrice: p });
                            }}
                          >
                            <SelectTrigger className="rounded-xl h-10 bg-background text-sm font-medium">
                              <SelectValue placeholder="Select SaaS Plan" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Starter PG Plan">Starter PG Plan (₹1,499/mo)</SelectItem>
                              <SelectItem value="Professional Growth">Professional Growth (₹2,999/mo)</SelectItem>
                              <SelectItem value="Enterprise Co-Living">Enterprise Co-Living (₹5,999/mo)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          size="default"
                          onClick={() => selectedOrgId && updatePlanMut.mutate({ id: selectedOrgId, payload: planForm })}
                          disabled={updatePlanMut.isPending}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl h-10 shadow-xs"
                        >
                          {updatePlanMut.isPending ? 'Applying...' : 'Apply Plan Override'}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/30 border-t shrink-0">
            <Button variant="outline" onClick={() => setSelectedOrgId(null)} className="rounded-xl font-semibold">
              Close Dossier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enterprise White-Label Branding Dialog */}
      <Dialog open={!!brandingTarget} onOpenChange={(open) => !open && setBrandingTarget(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-xl max-h-[85vh] p-0 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl bg-purple-500/10 text-purple-600 shrink-0">
                <Palette className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Enterprise White-Label Custom Branding
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Customize the portal theme, logo, brand name, and color scheme for <strong>{brandingTarget?.name}</strong>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)] flex-1">
            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
              <div className="space-y-0.5">
                <Label className="text-xs sm:text-sm font-bold text-purple-950 dark:text-purple-200">
                  Enable White-Label Custom Branding
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Transform this subscriber's dashboard and public pages into their custom-branded portal.
                </p>
              </div>
              <Switch
                checked={brandingForm.customBrandingEnabled}
                onCheckedChange={(c) => setBrandingForm((f) => ({ ...f, customBrandingEnabled: c }))}
              />
            </div>

            {/* Brand Identity Inputs */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Brand / Portal Name *</Label>
                <Input
                  value={brandingForm.brandName}
                  onChange={(e) => setBrandingForm((f) => ({ ...f, brandName: e.target.value }))}
                  placeholder="e.g. Starlight Residences & Co-Living"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Brand Tagline</Label>
                <Input
                  value={brandingForm.brandTagline}
                  onChange={(e) => setBrandingForm((f) => ({ ...f, brandTagline: e.target.value }))}
                  placeholder="e.g. Premium Executive Living & Hospitality"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Custom Logo Image URL</Label>
                <Input
                  value={brandingForm.brandLogoUrl}
                  onChange={(e) => setBrandingForm((f) => ({ ...f, brandLogoUrl: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Custom Favicon URL</Label>
                <Input
                  value={brandingForm.brandFaviconUrl}
                  onChange={(e) => setBrandingForm((f) => ({ ...f, brandFaviconUrl: e.target.value }))}
                  placeholder="https://example.com/favicon.ico"
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Primary Palette */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Primary Brand Color (Hex)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandingForm.brandPrimaryColor}
                  onChange={(e) => setBrandingForm((f) => ({ ...f, brandPrimaryColor: e.target.value }))}
                  className="h-10 w-14 rounded-xl border cursor-pointer p-0.5 bg-transparent shrink-0"
                />
                <Input
                  value={brandingForm.brandPrimaryColor}
                  onChange={(e) => setBrandingForm((f) => ({ ...f, brandPrimaryColor: e.target.value }))}
                  placeholder="#4f46e5"
                  className="font-mono text-xs max-w-[120px] rounded-xl"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {colorPresets.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setBrandingForm((f) => ({ ...f, brandPrimaryColor: c.hex }))}
                      className="h-6 w-6 rounded-full border border-white shadow-xs transition hover:scale-110"
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Footer */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Custom Footer / Copyright Notice</Label>
              <Input
                value={brandingForm.customFooterText}
                onChange={(e) => setBrandingForm((f) => ({ ...f, customFooterText: e.target.value }))}
                placeholder="© 2026 Your Organization. All rights reserved."
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-2 shrink-0">
            <Button variant="ghost" onClick={() => setBrandingTarget(null)} className="rounded-xl h-9.5 text-xs font-semibold">Cancel</Button>
            <Button
              onClick={() => brandingTarget && updateBrandingMut.mutate({ id: brandingTarget.id, payload: brandingForm })}
              disabled={updateBrandingMut.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl h-9.5 text-xs sm:text-sm shadow-xs"
            >
              {updateBrandingMut.isPending ? 'Saving...' : 'Save White-Label Branding'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Validity Dialog */}
      <Dialog open={!!extendTarget} onOpenChange={(open) => !open && setExtendTarget(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] p-0 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl bg-blue-500/10 text-blue-600 shrink-0">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Extend Subscription Validity
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Grant additional validity days to <strong>{extendTarget?.name}</strong>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)] flex-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Extend by (Days)</Label>
              <Select value={String(extendDays)} onValueChange={(v) => setExtendDays(Number(v))}>
                <SelectTrigger className="rounded-xl h-10 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Days (+1 Week)</SelectItem>
                  <SelectItem value="15">15 Days (+Half Month)</SelectItem>
                  <SelectItem value="30">30 Days (+1 Month)</SelectItem>
                  <SelectItem value="60">60 Days (+2 Months)</SelectItem>
                  <SelectItem value="90">90 Days (+1 Quarter)</SelectItem>
                  <SelectItem value="365">365 Days (+1 Full Year)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-2 shrink-0">
            <Button variant="ghost" onClick={() => setExtendTarget(null)} className="rounded-xl h-9.5 text-xs font-semibold">Cancel</Button>
            <Button
              onClick={() => extendTarget && extendMut.mutate({ id: extendTarget.id, days: extendDays })}
              disabled={extendMut.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-9.5 text-xs sm:text-sm shadow-xs"
            >
              {extendMut.isPending ? 'Extending...' : `Extend by ${extendDays} Days`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1. PRE-APPROVAL DOUBLE VERIFICATION MODAL */}
      <Dialog open={!!verifyingOrg} onOpenChange={(o) => !approveSubscriberMut.isPending && !o && setVerifyingOrg(null)}>
        <DialogContent className="max-w-xl p-0 rounded-2xl overflow-hidden border shadow-2xl bg-card">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white space-y-1">
            <div className="flex items-center gap-2 text-emerald-100 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-emerald-300" /> Pre-Approval Security Review
            </div>
            <DialogTitle className="text-xl font-black text-white">
              Review &amp; Activate Workspace
            </DialogTitle>
            <DialogDescription className="text-emerald-100/90 text-xs">
              Verify applicant dossier before live provisioning and sending credentials.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-5">
            {/* Applicant Summary Card */}
            {verifyingOrg && (
              <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{verifyingOrg.name}</span>
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
                    {verifyingOrg.subdomain}.stayeaze.com
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-background border">
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Owner Contact</span>
                    <span className="font-bold text-foreground truncate block">{verifyingOrg.ownerName || 'N/A'}</span>
                    <span className="text-muted-foreground text-[11px] truncate block">{verifyingOrg.ownerEmail}</span>
                    <span className="text-muted-foreground text-[11px] font-mono block">{verifyingOrg.ownerMobile || 'No mobile'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border">
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Capacity &amp; Branch</span>
                    <span className="font-bold text-foreground block">{verifyingOrg.propertyCount || 1} Initial Branch</span>
                    <span className="text-muted-foreground text-[11px] block">{verifyingOrg.totalBeds || 0} Registered Beds</span>
                    {verifyingOrg.paymentId && (
                      <span className="text-emerald-600 font-mono text-[10px] font-bold block truncate">✓ Paid: {verifyingOrg.paymentId}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Plan & Validity Customization */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">SaaS Tier Plan</Label>
                <Select value={verifyForm.planName} onValueChange={(v) => setVerifyForm(p => ({ ...p, planName: v }))}>
                  <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Starter PG Plan">Starter PG Plan (₹1,499/mo)</SelectItem>
                    <SelectItem value="Professional Growth">Professional Growth (₹2,999/mo)</SelectItem>
                    <SelectItem value="Enterprise Co-Living">Enterprise Co-Living (₹5,999/mo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Initial Validity Period</Label>
                <Select value={String(verifyForm.validityDays)} onValueChange={(v) => setVerifyForm(p => ({ ...p, validityDays: Number(v) }))}>
                  <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="14">14 Days (Extended Trial)</SelectItem>
                    <SelectItem value="30">30 Days (Standard 1 Month)</SelectItem>
                    <SelectItem value="60">60 Days (2 Months Promo)</SelectItem>
                    <SelectItem value="90">90 Days (Quarterly Access)</SelectItem>
                    <SelectItem value="365">365 Days (Full Year Annual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Irreversible Action Warning Banner */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-1">
                <span className="font-bold block">Irreversible Onboarding Action:</span>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300/90">
                  Activating this workspace immediately provisions the live tenant database scope, unlocks the owner account credentials, initializes the <strong>{verifyForm.validityDays}-day</strong> billing period, and dispatches the official welcome email.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVerifyingOrg(null)}
              disabled={approveSubscriberMut.isPending}
              className="text-xs rounded-xl h-9 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (verifyingOrg) {
                  approveSubscriberMut.mutate({
                    orgId: verifyingOrg.id,
                    payload: {
                      validityDays: verifyForm.validityDays,
                      planName: verifyForm.planName,
                    }
                  });
                }
              }}
              disabled={approveSubscriberMut.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-9 px-4 shadow-emerald-600/20 shadow-lg transition-all active:scale-[0.98]"
            >
              {approveSubscriberMut.isPending ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Activating Workspace...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Confirm &amp; Launch Workspace 🚀
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. POST-APPROVAL CELEBRATION & CREDENTIALS READINESS MODAL */}
      <Dialog open={!!approvedOrgSuccess} onOpenChange={(o) => !o && setApprovedOrgSuccess(null)}>
        <DialogContent className="max-w-lg p-0 rounded-2xl overflow-hidden border shadow-2xl bg-card">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white text-center space-y-2 relative overflow-hidden">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/20 backdrop-blur-md text-white mb-1 shadow-inner">
              <Sparkles className="h-8 w-8 text-amber-300 animate-pulse" />
            </div>
            <DialogTitle className="text-2xl font-black text-white tracking-tight">
              🎉 Workspace Successfully Activated!
            </DialogTitle>
            <DialogDescription className="text-indigo-100 text-xs max-w-sm mx-auto">
              The organization environment is live and credentials are now ready for immediate login.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-4">
            {approvedOrgSuccess && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
                  <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider block">
                    Dedicated Workspace Portal URL
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-background p-2.5 rounded-lg border font-mono text-xs">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate">
                      {approvedOrgSuccess.subdomain}.stayeaze.com
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(`https://${approvedOrgSuccess.subdomain}.stayeaze.com/login`, 'Login URL')}
                      className="h-7 px-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy Link
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Owner Login Credentials Ready</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    The owner <strong>{approvedOrgSuccess.org.ownerName || 'Administrator'}</strong> (<strong>{approvedOrgSuccess.org.ownerEmail}</strong>) can now immediately log in with their registered password at their dedicated subdomain.
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
                    ✓ Welcome onboarding email with direct login link has been dispatched to {approvedOrgSuccess.org.ownerEmail}.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setApprovedOrgSuccess(null)}
              className="text-xs rounded-xl h-9 font-medium"
            >
              Done / Close
            </Button>
            {approvedOrgSuccess && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  impersonateMut.mutate(approvedOrgSuccess.org.id);
                  setApprovedOrgSuccess(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl h-9 px-4 shadow-xs"
              >
                <LogIn className="h-3.5 w-3.5 mr-1.5" /> Launch Workspace Preview
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. REJECTION & RAZORPAY REFUND MODAL */}
      <Dialog open={!!rejectingOrg} onOpenChange={(o) => !rejectSubscriberMut.isPending && !o && setRejectingOrg(null)}>
        <DialogContent className="max-w-md p-0 rounded-2xl overflow-hidden border shadow-2xl bg-card">
          <div className="bg-gradient-to-r from-rose-600 to-red-700 p-5 text-white space-y-1">
            <div className="flex items-center gap-1.5 text-rose-200 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="h-4 w-4" /> Registration Rejection Guard
            </div>
            <DialogTitle className="text-lg font-black text-white">
              Reject Organization Registration
            </DialogTitle>
            <DialogDescription className="text-rose-100/90 text-xs">
              Confirm applicant rejection, reason remarks, and fee refund options.
            </DialogDescription>
          </div>

          <div className="p-5 space-y-4">
            {rejectingOrg && (
              <div className="p-3 rounded-xl bg-muted/40 border text-xs space-y-1">
                <span className="font-bold text-foreground block">{rejectingOrg.name}</span>
                <span className="text-muted-foreground block">{rejectingOrg.ownerEmail} • {rejectingOrg.subdomain}.stayeaze.com</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Primary Rejection Reason</Label>
              <Select value={rejectionReason} onValueChange={setRejectionReason}>
                <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incomplete KYC or License Documentation">Incomplete KYC / License Documentation</SelectItem>
                  <SelectItem value="Duplicate Subdomain Registration">Duplicate Subdomain Registration</SelectItem>
                  <SelectItem value="Invalid Contact Information">Invalid Contact Information</SelectItem>
                  <SelectItem value="Outside Platform Service Scope">Outside Platform Service Scope</SelectItem>
                  <SelectItem value="Custom Reason">Custom Reason (specified below)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Additional Remarks / Feedback (Optional)</Label>
              <Textarea
                placeholder="Notes included in rejection notification email..."
                value={orgRejectionNotes}
                onChange={(e) => setOrgRejectionNotes(e.target.value)}
                className="text-xs rounded-xl min-h-[60px]"
              />
            </div>

            {/* Automated Razorpay Refund Toggle */}
            {rejectingOrg?.paymentId && (
              <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                        Automated Razorpay Refund
                      </span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                        Payment Ref: {rejectingOrg.paymentId}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="auto-refund"
                    checked={autoRefund}
                    onChange={(e) => setAutoRefund(e.target.checked)}
                    className="h-4 w-4 accent-emerald-600 rounded"
                  />
                </div>
                {autoRefund && (
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-tight">
                    ✓ Full onboarding fee will be instantly refunded via the Razorpay API to the applicant's original payment method.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectingOrg(null)}
              disabled={rejectSubscriberMut.isPending}
              className="text-xs rounded-xl h-9 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                if (rejectingOrg) {
                  rejectSubscriberMut.mutate({
                    orgId: rejectingOrg.id,
                    payload: {
                      reason: orgRejectionNotes ? `${rejectionReason}: ${orgRejectionNotes}` : rejectionReason,
                      autoRefund: !!(rejectingOrg.paymentId && autoRefund),
                    }
                  });
                }
              }}
              disabled={rejectSubscriberMut.isPending}
              className="font-bold text-xs rounded-xl h-9 px-4 shadow-xs"
            >
              {rejectSubscriberMut.isPending ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing Rejection...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" /> Confirm Rejection
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. BULK SELECTION FLOATING ACTION BAR */}
      {selectedOrgIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white dark:bg-slate-900/95 border border-slate-700/80 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 backdrop-blur-md animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="h-6 px-2 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[11px]">
              {selectedOrgIds.size}
            </span>
            <span>Selected</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => bulkApproveMut.mutate(Array.from(selectedOrgIds))}
              disabled={bulkApproveMut.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 rounded-xl shadow-xs"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Bulk Approve ({selectedOrgIds.size})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => bulkRejectMut.mutate({ orgIds: Array.from(selectedOrgIds), reason: 'Bulk rejection by admin', autoRefund: true })}
              disabled={bulkRejectMut.isPending}
              className="h-8 px-3 text-xs font-bold rounded-xl"
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Bulk Reject ({selectedOrgIds.size})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedOrgIds(new Set())}
              className="text-xs text-slate-400 hover:text-white h-8 px-2"
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
