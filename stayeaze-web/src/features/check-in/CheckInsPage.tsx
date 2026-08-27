import { useState, useEffect, useMemo } from 'react';
import { LogIn, Plus, Pencil, Trash2, BadgeCheck, Calendar, CreditCard, Zap, Wallet, UserCheck, ShieldCheck, FileText } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormDialog } from '@/components/common/FormDialog';
import { FormInput } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { usePropertyStore } from '@/lib/stores/property-store';
import { formatCurrency, formatDate, formatRoomName } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';
import { validateRequired, validateEmail, validatePhone, validateIdNumber, validateNumber } from '@/lib/validation';
import type { CheckIn, Property, Tenant, Room, Bed } from '@/lib/types';

import { TenantSelect } from '@/components/common/TenantSelect';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { RoomSelect } from '@/components/common/RoomSelect';

const ENDPOINT = '/check-ins';
const statuses = [{ value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' }];

const emptyForm = {
  tenantId: '', tenantName: '', propertyId: '', roomNumber: '', bedNumber: 'B1',
  checkInDate: new Date().toISOString().slice(0, 10), leaseEnd: '',
  rent: 8000, depositPaid: 16000, idVerified: true, status: 'pending' as CheckIn['status'],
};

export default function CheckInsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CheckIn | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CheckIn | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<CheckIn | null>(null);
  const [checkInDate, setCheckInDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();

  const { data: properties } = useQuery({
    queryKey: ['checkins-properties-minimal'],
    queryFn: () => api.get<Property[]>('/properties/minimal').then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Property[];
      return (payload as { data: Property[] }).data || [];
    }),
  });
  const propMap = new Map((properties ?? []).map((p: Property) => [p.id, p.name]));

  const { data: tenants } = useQuery({
    queryKey: ['checkins-tenants'],
    queryFn: () => api.get<{ data: Tenant[] }>('/tenants', { params: { pageSize: 100 } }).then((r) => r.data.data),
    enabled: dialogOpen,
  });

  // Fetch all rooms for dropdown
  const { data: allRooms } = useQuery({
    queryKey: ['checkins-rooms'],
    queryFn: () => api.get<Room[]>('/rooms', { params: { pageSize: 500 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Room[];
      return (payload as { data: Room[] }).data ?? [];
    }),
    enabled: dialogOpen,
  });

  const form = useForm(emptyForm);

  const roomOptions = useMemo(() => {
    return (allRooms ?? []).filter((r: any) => {
      if (r.status === 'archived' || r.status === 'maintenance' || r.status === 'blocked') return false;
      if (form.values.propertyId && r.propertyId && r.propertyId !== form.values.propertyId) return false;
      return true;
    });
  }, [allRooms, form.values.propertyId]);

  // Fetch beds for selected room
  const { data: bedsForRoom } = useQuery({
    queryKey: ['checkins-beds', selectedRoomId],
    queryFn: () => api.get<Bed[]>(`/rooms/${selectedRoomId}/beds`).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Bed[];
      return (payload as { data: Bed[] }).data ?? [];
    }),
    enabled: !!selectedRoomId,
  });

  const createMut = useCreate<CheckIn>(ENDPOINT, 'Check-in');
  const updateMut = useUpdate<CheckIn>(ENDPOINT, 'Check-in');
  const deleteMut = useDelete(ENDPOINT, 'Check-in');

  function handleSelectTenant(tenantId: string) {
    form.setValue('tenantId', tenantId);
    const selected = (tenants ?? []).find((t) => t.id === tenantId);
    if (selected) {
      form.setValue('tenantName', selected.name);
      if (selected.propertyId) form.setValue('propertyId', selected.propertyId);
      if (selected.rent) form.setValue('rent', selected.rent);
      if (selected.deposit) form.setValue('depositPaid', selected.deposit);
      if (selected.leaseEnd) form.setValue('leaseEnd', selected.leaseEnd);
    }
  }

  const { data: defaultDepData } = useQuery({
    queryKey: ['org-billing-profile-deposit-checkins'],
    queryFn: () => api.get<any>('/organization-billing-profile/default-deposit').then((r) => r.data),
  });

  const { data: bookingsData } = useQuery({
    queryKey: ['checkins-bookings-lookup'],
    queryFn: () => api.get<any>('/bookings', { params: { pageSize: 500 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload;
      return (payload as { data: any[] }).data ?? [];
    }),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['checkins-invoices-lookup'],
    queryFn: () => api.get<any>('/invoices', { params: { pageSize: 500 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload;
      return (payload as { data: any[] }).data ?? [];
    }),
  });

  const { selectedPropertyId } = usePropertyStore();
  const [manualPaymentSettled, setManualPaymentSettled] = useState(false);

  function openCreate() {
    queryClient.invalidateQueries({ queryKey: ['checkins-rooms'] });
    queryClient.invalidateQueries({ queryKey: ['checkins-beds'] });
    setEditing(null);
    setSelectedRoomId('');
    const defaultDep = Number(defaultDepData?.defaultSecurityDeposit || 0);
    const defaultProp = selectedPropertyId && selectedPropertyId !== 'ALL' ? selectedPropertyId : '';
    form.reset({ ...emptyForm, propertyId: defaultProp, depositPaid: defaultDep });
    setDialogOpen(true);
  }

  function openEdit(row: CheckIn) {
    setEditing(row);
    const matchedRoom = (allRooms ?? []).find((r) => r.number === row.roomNumber);
    setSelectedRoomId(matchedRoom?.id ?? '');
    form.reset({
      tenantId: '', tenantName: row.tenantName, propertyId: row.propertyId, roomNumber: row.roomNumber,
      bedNumber: row.bedNumber, checkInDate: row.checkInDate, leaseEnd: row.leaseEnd,
      rent: row.rent, depositPaid: row.depositPaid, idVerified: row.idVerified, status: row.status,
    });
    setDialogOpen(true);
  }

  function submit() {
    if (!form.validate({ tenantName: (v) => !v ? 'Required' : undefined, propertyId: (v) => !v ? 'Select a property' : undefined })) return;
    const payload = { ...form.values, code: editing?.code ?? `CI-${String(Date.now()).slice(-4)}`, bookingId: editing?.bookingId };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  const genders = [
    { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' },
  ];
  const idTypes = [
    { value: 'aadhaar', label: 'Aadhaar Card' }, { value: 'pan', label: 'PAN Card' },
    { value: 'passport', label: 'Passport' }, { value: 'voter_id', label: 'Voter ID' },
    { value: 'driving_license', label: 'Driving License' },
  ];

  const [tenantDetailsForm, setTenantDetailsForm] = useState({
    name: '',
    email: '',
    phone: '',
    gender: 'male' as 'male' | 'female' | 'other',
    dob: '',
    occupation: '',
    idType: 'aadhaar' as Tenant['idType'],
    idNumber: '',
    emergencyName: '',
    emergencyContact: '',
  });

  const [tenantDetailsErrors, setTenantDetailsErrors] = useState<Record<string, string>>({});

  const handleTenantFieldBlur = (field: string, val: string, idTypeVal?: string) => {
    let err: string | undefined = undefined;
    if (field === 'name') err = validateRequired(val, 'Full Name');
    else if (field === 'phone') err = validatePhone(val, true);
    else if (field === 'email') err = validateEmail(val, true);
    else if (field === 'idNumber') err = validateIdNumber(idTypeVal || tenantDetailsForm.idType, val, false);
    else if (field === 'emergencyContact') err = validatePhone(val, false);
    
    setTenantDetailsErrors((prev) => ({ ...prev, [field]: err || '' }));
  };

  const [checkInPaymentMethod, setCheckInPaymentMethod] = useState<'razorpay' | 'cash' | 'later'>('cash');

  useEffect(() => {
    if (!checkInTarget) return;

    const row = checkInTarget;
    const matchedTenant = (tenants ?? []).find((t: any) =>
      (row.tenantId && t.id === row.tenantId) ||
      (t.name && row.tenantName && t.name.toLowerCase() === row.tenantName.toLowerCase()) ||
      ((t.firstName || t.lastName) && row.tenantName && `${t.firstName || ''} ${t.lastName || ''}`.trim().toLowerCase() === row.tenantName.toLowerCase())
    );

    const matchedBooking = (bookingsData ?? []).find((b: any) =>
      (row.bookingId && b.id === row.bookingId) ||
      (b.tenantName && row.tenantName && b.tenantName.toLowerCase() === row.tenantName.toLowerCase()) ||
      (b.roomNumber === row.roomNumber && b.bedNumber === row.bedNumber)
    );

    const extractedEmail =
      row.tenantEmail ||
      (row as any).email ||
      matchedTenant?.email ||
      matchedBooking?.tenantEmail ||
      matchedBooking?.email ||
      matchedBooking?.tenant?.email ||
      '';

    const extractedPhone =
      row.tenantPhone ||
      (row as any).phone ||
      (row as any).mobile ||
      matchedTenant?.phone ||
      matchedTenant?.mobile ||
      matchedBooking?.tenantPhone ||
      matchedBooking?.phone ||
      matchedBooking?.mobile ||
      matchedBooking?.tenant?.mobile ||
      matchedBooking?.tenant?.phone ||
      '';

    setTenantDetailsForm((prev) => ({
      name: prev.name || row.tenantName || matchedTenant?.name || matchedBooking?.tenantName || '',
      email: prev.email || extractedEmail,
      phone: prev.phone || extractedPhone,
      gender: prev.gender || (matchedTenant?.gender || matchedBooking?.tenant?.gender || 'male') as any,
      dob: prev.dob || matchedTenant?.dob || matchedBooking?.tenant?.dob || '',
      occupation: prev.occupation || matchedTenant?.occupation || matchedBooking?.tenant?.occupation || '',
      idType: prev.idType || (matchedTenant?.idType || matchedBooking?.tenant?.idType || 'aadhaar') as any,
      idNumber: prev.idNumber || matchedTenant?.idNumber || matchedBooking?.tenant?.idNumber || '',
      emergencyName: prev.emergencyName || matchedTenant?.emergencyName || matchedTenant?.emergencyContactName || matchedBooking?.tenant?.emergencyContactName || '',
      emergencyContact: prev.emergencyContact || matchedTenant?.emergencyContact || matchedTenant?.emergencyContactMobile || matchedBooking?.tenant?.emergencyContactMobile || '',
    }));

    const resolvedTenantId = row.tenantId || matchedTenant?.id;
    if (resolvedTenantId) {
      Promise.all([
        api.get(`/tenants/${resolvedTenantId}`).then((r) => r.data).catch(() => null),
        api.get(`/tenants/${resolvedTenantId}/documents`).then((r) => Array.isArray(r.data) ? r.data : (r.data as any)?.data || []).catch(() => []),
      ]).then(([fullTenant, docs]) => {
        if (!fullTenant && (!docs || docs.length === 0)) return;
        const validDoc = (docs ?? []).find((d: any) => d.documentNumber && d.documentNumber.trim().length > 0) || docs?.[0];

        setTenantDetailsForm((prev) => ({
          name: fullTenant?.name || (fullTenant?.firstName ? `${fullTenant.firstName} ${fullTenant.lastName || ''}`.trim() : prev.name),
          email: fullTenant?.email || prev.email,
          phone: fullTenant?.mobile || fullTenant?.phone || prev.phone,
          gender: (fullTenant?.gender || prev.gender || 'male') as any,
          dob: fullTenant?.dob || prev.dob || '',
          occupation: fullTenant?.occupation || prev.occupation || '',
          idType: (validDoc?.documentType?.toLowerCase() || fullTenant?.idType?.toLowerCase() || prev.idType || 'aadhaar') as any,
          idNumber: validDoc?.documentNumber || fullTenant?.idNumber || prev.idNumber || '',
          emergencyName: fullTenant?.emergencyContactName || fullTenant?.emergencyName || prev.emergencyName || '',
          emergencyContact: fullTenant?.emergencyContactMobile || fullTenant?.emergencyContact || prev.emergencyContact || '',
        }));

        if (fullTenant?.leaseStart) {
          setCheckInDate(fullTenant.leaseStart);
        }
      });
    }
  }, [checkInTarget, bookingsData, tenants]);

  function openProcessModal(row: CheckIn) {
    setCheckInTarget(row);
    setCheckInDate(row.checkInDate || new Date().toISOString().slice(0, 10));
    setCheckInPaymentMethod('cash');
    setTenantDetailsErrors({});

    const matchedTenant = (tenants ?? []).find((t: any) =>
      (row.tenantId && t.id === row.tenantId) ||
      (t.name && row.tenantName && t.name.toLowerCase() === row.tenantName.toLowerCase()) ||
      ((t.firstName || t.lastName) && row.tenantName && `${t.firstName || ''} ${t.lastName || ''}`.trim().toLowerCase() === row.tenantName.toLowerCase())
    );

    const matchedBooking = (bookingsData ?? []).find((b: any) =>
      (row.bookingId && b.id === row.bookingId) ||
      (b.tenantName && row.tenantName && b.tenantName.toLowerCase() === row.tenantName.toLowerCase()) ||
      (b.roomNumber === row.roomNumber && b.bedNumber === row.bedNumber)
    );

    const extractedEmail =
      row.tenantEmail ||
      (row as any).email ||
      matchedTenant?.email ||
      matchedBooking?.tenantEmail ||
      matchedBooking?.email ||
      matchedBooking?.tenant?.email ||
      '';

    const extractedPhone =
      row.tenantPhone ||
      (row as any).phone ||
      (row as any).mobile ||
      matchedTenant?.phone ||
      matchedTenant?.mobile ||
      matchedBooking?.tenantPhone ||
      matchedBooking?.phone ||
      matchedBooking?.mobile ||
      matchedBooking?.tenant?.mobile ||
      matchedBooking?.tenant?.phone ||
      '';

    setTenantDetailsForm({
      name: row.tenantName || matchedTenant?.name || matchedBooking?.tenantName || '',
      email: extractedEmail,
      phone: extractedPhone,
      gender: (matchedTenant?.gender || matchedBooking?.tenant?.gender || 'male') as any,
      dob: matchedTenant?.dob || matchedBooking?.tenant?.dob || '',
      occupation: matchedTenant?.occupation || matchedBooking?.tenant?.occupation || '',
      idType: (matchedTenant?.idType || matchedBooking?.tenant?.idType || 'aadhaar') as any,
      idNumber: matchedTenant?.idNumber || matchedBooking?.tenant?.idNumber || '',
      emergencyName: matchedTenant?.emergencyName || matchedTenant?.emergencyContactName || matchedBooking?.tenant?.emergencyContactName || '',
      emergencyContact: matchedTenant?.emergencyContact || matchedTenant?.emergencyContactMobile || matchedBooking?.tenant?.emergencyContactMobile || '',
    });
    setManualPaymentSettled(false);

    const resolvedTenantId = row.tenantId || matchedTenant?.id;
    if (resolvedTenantId) {
      Promise.all([
        api.get(`/tenants/${resolvedTenantId}`).then((r) => r.data).catch(() => null),
        api.get(`/tenants/${resolvedTenantId}/documents`).then((r) => Array.isArray(r.data) ? r.data : (r.data as any)?.data || []).catch(() => []),
      ]).then(([fullTenant, docs]) => {
        if (!fullTenant && (!docs || docs.length === 0)) return;
        const validDoc = (docs ?? []).find((d: any) => d.documentNumber && d.documentNumber.trim().length > 0) || docs?.[0];

        setTenantDetailsForm((prev) => ({
          name: fullTenant?.name || (fullTenant?.firstName ? `${fullTenant.firstName} ${fullTenant.lastName || ''}`.trim() : prev.name),
          email: fullTenant?.email || prev.email,
          phone: fullTenant?.mobile || fullTenant?.phone || prev.phone,
          gender: (fullTenant?.gender || prev.gender || 'male') as any,
          dob: fullTenant?.dob || prev.dob || '',
          occupation: fullTenant?.occupation || prev.occupation || '',
          idType: (validDoc?.documentType?.toLowerCase() || fullTenant?.idType?.toLowerCase() || prev.idType || 'aadhaar') as any,
          idNumber: validDoc?.documentNumber || fullTenant?.idNumber || prev.idNumber || '',
          emergencyName: fullTenant?.emergencyContactName || fullTenant?.emergencyName || prev.emergencyName || '',
          emergencyContact: fullTenant?.emergencyContactMobile || fullTenant?.emergencyContact || prev.emergencyContact || '',
        }));

        if (fullTenant?.leaseStart) {
          setCheckInDate(fullTenant.leaseStart);
        }
      });
    }
  }

  async function handleCompleteCheckIn() {
    if (!checkInTarget) return;

    const nameErr = validateRequired(tenantDetailsForm.name, 'Full Name');
    const phoneErr = validatePhone(tenantDetailsForm.phone, true);
    const emailErr = validateEmail(tenantDetailsForm.email, false);
    const idErr = validateIdNumber(tenantDetailsForm.idType, tenantDetailsForm.idNumber, false);
    const emergencyErr = validatePhone(tenantDetailsForm.emergencyContact, false);

    if (nameErr || phoneErr || emailErr || idErr || emergencyErr) {
      setTenantDetailsErrors({
        name: nameErr || '',
        phone: phoneErr || '',
        email: emailErr || '',
        idNumber: idErr || '',
        emergencyContact: emergencyErr || '',
      });
      toast({ title: 'Validation Error', description: 'Please fix the errors in the tenant details form.', variant: 'destructive' });
      return;
    }

    const matchedTenant = (tenants ?? []).find((t: any) =>
      (checkInTarget.tenantId && t.id === checkInTarget.tenantId) ||
      (t.name && checkInTarget.tenantName && t.name.toLowerCase() === checkInTarget.tenantName.toLowerCase()) ||
      ((t.firstName || t.lastName) && checkInTarget.tenantName && `${t.firstName || ''} ${t.lastName || ''}`.trim().toLowerCase() === checkInTarget.tenantName.toLowerCase())
    );

    const tenantPaidInvoices = (invoicesData ?? []).filter((inv: any) =>
      (matchedTenant && inv.tenantId === matchedTenant.id) ||
      (inv.tenantName && checkInTarget.tenantName && inv.tenantName.toLowerCase() === checkInTarget.tenantName.toLowerCase())
    ).filter((inv: any) => inv.status === 'PAID');

    const totalInvoicesPaid = tenantPaidInvoices.reduce((sum: number, inv: any) => sum + Number(inv.amountPaid || inv.amount || 0), 0);

    const monthlyRent = Number(checkInTarget.rent || matchedTenant?.rent || 0);
    const securityDeposit = Number((checkInTarget as any).deposit || checkInTarget.depositPaid || matchedTenant?.deposit || 0);
    const totalOnboardingAmt = monthlyRent + securityDeposit;
    const matchedBooking = (bookingsData ?? []).find((b: any) =>
      (checkInTarget.bookingId && b.id === checkInTarget.bookingId) ||
      (b.tenantName && checkInTarget.tenantName && b.tenantName.toLowerCase() === checkInTarget.tenantName.toLowerCase()) ||
      (b.roomNumber === checkInTarget.roomNumber && b.bedNumber === checkInTarget.bedNumber)
    );
    const advancePaidAmt = Math.max(
      Number(checkInTarget.advanceAmount || 0),
      Number((checkInTarget as any).advancePaid || 0),
      Number(matchedBooking?.advanceAmount || 0),
      totalInvoicesPaid
    );
    const isAlreadyPaid = manualPaymentSettled || (totalOnboardingAmt > 0 && advancePaidAmt >= totalOnboardingAmt) || (totalInvoicesPaid >= totalOnboardingAmt && totalOnboardingAmt > 0);
    const netRemainingDue = isAlreadyPaid ? 0 : Math.max(0, totalOnboardingAmt - advancePaidAmt);

    const checkInPayload = {
      tenantName: tenantDetailsForm.name || checkInTarget.tenantName,
      roomNumber: checkInTarget.roomNumber,
      bedNumber: checkInTarget.bedNumber,
      propertyId: checkInTarget.propertyId,
      checkInDate: checkInDate || new Date().toISOString().slice(0, 10),
      tenantDetails: tenantDetailsForm,
      paymentMethod: isAlreadyPaid ? (checkInTarget.paymentMethod || 'ALREADY_PAID') : (checkInPaymentMethod === 'cash' ? 'CASH' : (checkInPaymentMethod === 'razorpay' ? 'RAZORPAY' : 'LATER')),
      netRemainingDue,
    };

    if (!isAlreadyPaid && checkInPaymentMethod === 'razorpay' && netRemainingDue > 0) {
      setIsSubmitting(true);
      try {
        const orderRes = await api.post('/tenants/onboarding-order', {
          propertyId: checkInTarget.propertyId,
          rentAmount: netRemainingDue,
          depositAmount: 0,
          tenantName: tenantDetailsForm.name || checkInTarget.tenantName,
          tenantEmail: tenantDetailsForm.email,
          tenantPhone: tenantDetailsForm.phone,
        });

        const orderData = orderRes.data;
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'StayEaze Remaining Check-in Payment',
          description: `Remaining Balance for ${tenantDetailsForm.name || checkInTarget.tenantName}`,
          order_id: orderData.orderId,
          handler: async function (response: any) {
            try {
              await api.post(`/check-ins/${checkInTarget.id}/mark-completed`, {
                ...checkInPayload,
                paymentMethod: 'RAZORPAY',
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              });
              toast({ title: 'Check-in Completed & Remaining Balance Paid!', description: `Payment ${response.razorpay_payment_id} recorded successfully.` });
              setCheckInTarget(null);
              queryClient.invalidateQueries();
            } catch (err: any) {
              toast({ title: 'Check-in Error', description: err?.message || 'Failed to complete check-in.', variant: 'destructive' });
            } finally {
              setIsSubmitting(false);
            }
          },
          modal: {
            ondismiss: function () {
              setIsSubmitting(false);
              toast({ title: 'Payment Dismissed', description: 'Razorpay checkout was closed without completing remaining check-in payment.', variant: 'destructive' });
            },
          },
          prefill: {
            name: tenantDetailsForm.name || checkInTarget.tenantName,
            email: tenantDetailsForm.email || '',
            contact: tenantDetailsForm.phone || '',
          },
          theme: { color: '#4f46e5' },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } catch (err: any) {
        setIsSubmitting(false);
        const errMsg = err?.response?.data?.message || err?.message || 'Failed to initialize Razorpay checkout.';
        toast({ title: 'Payment Setup Error', description: errMsg, variant: 'destructive' });
      }
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post(`/check-ins/${checkInTarget.id}/mark-completed`, checkInPayload);
      toast({ title: 'Tenant Checked In Successfully!', description: `${tenantDetailsForm.name || checkInTarget.tenantName} is now active.` });
      setCheckInTarget(null);
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({ title: 'Check-in Completion Error', description: err?.message || 'Failed to complete check-in.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: Column<CheckIn>[] = [
    { key: 'code', header: 'Check-in ID', sortable: true, cell: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs font-medium">{r.code}</span>
        {r.bookingId && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-[10px] font-semibold border border-blue-200/60 dark:border-blue-800/40">
            <Calendar className="h-3 w-3" /> Booking
          </span>
        )}
      </div>
    )},
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => <span className="font-medium">{r.tenantName}</span> },
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{propMap.get(r.propertyId) ?? '—'}</span> },
    { key: 'roomNumber', header: 'Room / Bed', sortable: true, cell: (r) => <span className="text-sm">Room {r.roomNumber} · {r.bedNumber}</span> },
    { key: 'checkInDate', header: 'Scheduled Date', sortable: true, cell: (r) => <span className="text-sm">{r.checkInDate ? formatDate(r.checkInDate) : '—'}</span> },
    { key: 'leaseEnd', header: 'Lease End', sortable: true, cell: (r) => <span className="text-sm">{r.leaseEnd ? formatDate(r.leaseEnd) : '—'}</span> },
    { key: 'depositPaid', header: 'Deposit', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.depositPaid)}</span> },
    { key: 'idVerified', header: 'ID', cell: (r) => r.idVerified ? <BadgeCheck className="h-5 w-5 text-success" /> : <span className="text-xs text-muted-foreground">Pending</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const [invoiceCheckIn, setInvoiceCheckIn] = useState<CheckIn | null>(null);

  const isNameValid = !!tenantDetailsForm.name && tenantDetailsForm.name.trim().length >= 2;
  const isPhoneValid = !!tenantDetailsForm.phone && /^[6-9]\d{9}$/.test(tenantDetailsForm.phone.replace(/[\s-+()]/g, ''));
  const isEmailValid = !!tenantDetailsForm.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantDetailsForm.email.trim());
  const isDateValid = !!checkInDate && checkInDate.trim().length > 0;

  let isIdValid = true;
  if (tenantDetailsForm.idNumber && tenantDetailsForm.idNumber.trim()) {
    isIdValid = !validateIdNumber(tenantDetailsForm.idType, tenantDetailsForm.idNumber, false);
  }

  let isEmergencyValid = true;
  if (tenantDetailsForm.emergencyContact && tenantDetailsForm.emergencyContact.trim()) {
    isEmergencyValid = !validatePhone(tenantDetailsForm.emergencyContact, false);
  }

  const hasFieldErrors = Object.values(tenantDetailsErrors).some((err) => !!err && err.length > 0);

  const isCheckInSubmitDisabled =
    !isNameValid ||
    !isPhoneValid ||
    !isEmailValid ||
    !isDateValid ||
    !isIdValid ||
    !isEmergencyValid ||
    hasFieldErrors ||
    isSubmitting;

  const handlePrintTaxInvoice = () => {
    window.print();
  };

  const propertyFilterOptions = (properties ?? []).map((p: Property) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Check-in" description="Process tenant check-ins and room assignments." icon={LogIn}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> New Check-in</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search check-ins..." exportFilename="check-ins" initialSortBy="checkInDate"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        rowActions={(row) => {
          const isAlreadyCheckedIn = row.status && ['completed', 'checked_in', 'active'].includes(row.status.toLowerCase());
          return (
            <div className="flex items-center justify-end gap-2">
              {!isAlreadyCheckedIn ? (
                <Button
                  size="sm"
                  onClick={() => openProcessModal(row)}
                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                >
                  <BadgeCheck className="h-4 w-4" /> Mark Checked In
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md">
                  <BadgeCheck className="h-3.5 w-3.5" /> Checked In
                </span>
              )}
              <RowActions items={[
                ...(isAlreadyCheckedIn ? [{ label: 'Print Tax Invoice', icon: FileText, onSelect: () => setInvoiceCheckIn(row) }] : []),
                { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
                { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
              ]} />
            </div>
          );
        }} />

      {/* New / Edit Check-In Form Dialog */}
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Check-in' : 'New Check-in'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Process Check-in'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          {!editing && tenants && tenants.length > 0 && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Registered Tenant</Label>
              <TenantSelect
                tenants={(tenants ?? []).filter((t) => {
                  const st = (t.status || '').toLowerCase();
                  return st !== 'active' && st !== 'checked_in' && st !== 'completed' && st !== 'checked_out';
                })}
                selectedTenantId={form.values.tenantId}
                onSelectTenant={(t) => {
                  if (!t) {
                    form.setValue('tenantId', '');
                    return;
                  }
                  form.setValue('tenantId', t.id);
                  form.setValue('tenantName', t.name);
                  if (t.propertyId) form.setValue('propertyId', t.propertyId);
                  if (t.rent) form.setValue('rent', t.rent);
                  if (t.deposit) form.setValue('depositPaid', t.deposit);
                  if (t.leaseEnd) form.setValue('leaseEnd', t.leaseEnd);
                }}
              />
            </div>
          )}

          <FormInput label="Tenant Name" required id="tenantName" value={form.values.tenantName} onChange={(e) => form.setValue('tenantName', e.target.value)} error={form.errors.tenantName} />
          <div className="space-y-1.5">
            <Label>Property</Label>
            <SearchableSelect
              options={(properties ?? []).map((p: Property) => ({
                value: p.id,
                label: p.name,
                sublabel: p.city || p.code || 'Property',
                badge: p.type || 'PG',
              }))}
              value={form.values.propertyId}
              onChange={(v) => {
                form.setValue('propertyId', v);
                form.setValue('roomNumber', '');
                form.setValue('bedNumber', '');
                setSelectedRoomId('');
              }}
              placeholder="Search & select property..."
              searchPlaceholder="Search properties..."
            />
            {form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}
          </div>

          {/* Room & Bed Allocation with interactive bed cards */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Room &amp; Bed Allocation</Label>
            <RoomSelect
              rooms={roomOptions}
              beds={bedsForRoom}
              selectedRoomNumber={form.values.roomNumber || selectedRoomId}
              selectedBedNumber={form.values.bedNumber}
              onSelectRoom={(rNum, rId, rentVal) => {
                form.setValue('roomNumber', rNum);
                setSelectedRoomId(rId || rNum);
                if (rId) {
                  queryClient.invalidateQueries({ queryKey: ['checkins-beds', rId] });
                }
                if (rentVal && rentVal > 0) {
                  form.setValue('rent', rentVal);
                }
                form.setValue('bedNumber', '');
              }}
              onSelectBed={(bNum) => form.setValue('bedNumber', bNum)}
            />
          </div>

          <FormInput label="Check-in Date" type="date" id="checkInDate" value={form.values.checkInDate} onChange={(e) => form.setValue('checkInDate', e.target.value)} />
          <FormInput label="Lease End Date" type="date" id="leaseEnd" value={form.values.leaseEnd} onChange={(e) => form.setValue('leaseEnd', e.target.value)} />
          <FormInput label="Monthly Rent (₹)" type="number" id="rent" value={String(form.values.rent)} onChange={(e) => form.setValue('rent', Number(e.target.value))} />
          <FormInput label="Deposit Paid (₹)" type="number" id="depositPaid" value={String(form.values.depositPaid)} onChange={(e) => form.setValue('depositPaid', Number(e.target.value))} />
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as CheckIn['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex items-center gap-2 pt-6"><Checkbox id="idVerified" checked={form.values.idVerified} onCheckedChange={(v) => form.setValue('idVerified', v === true)} /><Label htmlFor="idVerified">ID document verified</Label></div>
        </div>
      </FormDialog>

      {/* Process Check-In Quick Dialog with Full Booking Details */}
      <FormDialog
        open={!!checkInTarget}
        onOpenChange={(open) => !open && setCheckInTarget(null)}
        title="Complete Tenant Check-in & Payment"
        onSubmit={handleCompleteCheckIn}
        loading={isSubmitting}
        disabled={isCheckInSubmitDisabled}
        submitLabel={isSubmitting ? (checkInPaymentMethod === 'razorpay' ? 'Opening Razorpay...' : 'Processing Check-in...') : 'Complete Check-in'}
        size="lg"
      >
        {checkInTarget && (
          <div className="space-y-5">
            {/* Step Header Banner */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 p-4 text-sm space-y-2">
              <div className="flex items-center justify-between font-semibold text-blue-900 dark:text-blue-200">
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {checkInTarget.bookingId ? 'Booking Details' : 'Check-in Details'}</span>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 font-bold">{checkInTarget.code}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
                <div><span className="text-muted-foreground">Property:</span> <p className="font-semibold text-foreground">{propMap.get(checkInTarget.propertyId) ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Room / Bed:</span> <p className="font-semibold text-foreground">Room {checkInTarget.roomNumber} · {checkInTarget.bedNumber}</p></div>
                <div><span className="text-muted-foreground">Monthly Rent:</span> <p className="font-semibold text-foreground">{formatCurrency(checkInTarget.rent)}</p></div>
                <div><span className="text-muted-foreground">Security Deposit:</span> <p className="font-semibold text-foreground">{formatCurrency((checkInTarget as any).deposit || checkInTarget.depositPaid || 0)}</p></div>
              </div>
            </div>

            {/* Section 1: Tenant Information Details */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b pb-1">
                <UserCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Step 1: Mandatory Tenant Details
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormInput
                  label="Full Name"
                  required
                  id="tenantName"
                  value={tenantDetailsForm.name}
                  error={tenantDetailsErrors.name}
                  onChange={(e) => {
                    setTenantDetailsForm((prev) => ({ ...prev, name: e.target.value }));
                    if (tenantDetailsErrors.name) handleTenantFieldBlur('name', e.target.value);
                  }}
                  onBlur={(e) => handleTenantFieldBlur('name', e.target.value)}
                />
                <FormInput
                  label="Mobile Phone"
                  required
                  id="tenantPhone"
                  value={tenantDetailsForm.phone}
                  error={tenantDetailsErrors.phone}
                  onChange={(e) => {
                    setTenantDetailsForm((prev) => ({ ...prev, phone: e.target.value }));
                    if (tenantDetailsErrors.phone) handleTenantFieldBlur('phone', e.target.value);
                  }}
                  onBlur={(e) => handleTenantFieldBlur('phone', e.target.value)}
                />
                <FormInput
                  label="Email Address"
                  required
                  type="email"
                  id="tenantEmail"
                  value={tenantDetailsForm.email}
                  error={tenantDetailsErrors.email}
                  onChange={(e) => {
                    setTenantDetailsForm((prev) => ({ ...prev, email: e.target.value }));
                    if (tenantDetailsErrors.email) handleTenantFieldBlur('email', e.target.value);
                  }}
                  onBlur={(e) => handleTenantFieldBlur('email', e.target.value)}
                />
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select value={tenantDetailsForm.gender} onValueChange={(v) => setTenantDetailsForm((prev) => ({ ...prev, gender: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{genders.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <FormInput label="Date of Birth" type="date" id="dob" value={tenantDetailsForm.dob} onChange={(e) => setTenantDetailsForm((prev) => ({ ...prev, dob: e.target.value }))} />
                <FormInput label="Occupation" id="occupation" value={tenantDetailsForm.occupation} onChange={(e) => setTenantDetailsForm((prev) => ({ ...prev, occupation: e.target.value }))} />
                <div className="space-y-1.5">
                  <Label>ID Document Type</Label>
                  <Select
                    value={tenantDetailsForm.idType}
                    onValueChange={(v) => {
                      setTenantDetailsForm((prev) => ({ ...prev, idType: v as any }));
                      if (tenantDetailsForm.idNumber) {
                        handleTenantFieldBlur('idNumber', tenantDetailsForm.idNumber, v);
                      }
                    }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{idTypes.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <FormInput
                  label="ID Document Number"
                  id="idNumber"
                  value={tenantDetailsForm.idNumber}
                  error={tenantDetailsErrors.idNumber}
                  placeholder={tenantDetailsForm.idType === 'aadhaar' ? '12 digits Aadhaar number' : (tenantDetailsForm.idType === 'pan' ? 'e.g. ABCDE1234F' : 'Document Number')}
                  onChange={(e) => {
                    setTenantDetailsForm((prev) => ({ ...prev, idNumber: e.target.value }));
                    if (tenantDetailsErrors.idNumber) handleTenantFieldBlur('idNumber', e.target.value);
                  }}
                  onBlur={(e) => handleTenantFieldBlur('idNumber', e.target.value)}
                />
                <FormInput label="Emergency Contact Name" id="emergencyName" value={tenantDetailsForm.emergencyName} onChange={(e) => setTenantDetailsForm((prev) => ({ ...prev, emergencyName: e.target.value }))} />
                <FormInput
                  label="Emergency Contact Phone"
                  id="emergencyContact"
                  value={tenantDetailsForm.emergencyContact}
                  error={tenantDetailsErrors.emergencyContact}
                  onChange={(e) => {
                    setTenantDetailsForm((prev) => ({ ...prev, emergencyContact: e.target.value }));
                    if (tenantDetailsErrors.emergencyContact) handleTenantFieldBlur('emergencyContact', e.target.value);
                  }}
                  onBlur={(e) => handleTenantFieldBlur('emergencyContact', e.target.value)}
                />
              </div>
            </div>

            {/* Section 2: Effective Date */}
            <div className="space-y-1.5">
              <FormInput
                label="Effective Check-in Date / Lease Start Date"
                type="date"
                required
                id="checkInDate"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                This date will be recorded as both the tenant's official check-in date and their lease commencement start date.
              </p>
            </div>

            {/* Section 3: Financial Calculation & Advance Deduction */}
            {(() => {
              const matchedTenant = (tenants ?? []).find((t: any) =>
                (checkInTarget.tenantId && t.id === checkInTarget.tenantId) ||
                (t.name && checkInTarget.tenantName && t.name.toLowerCase() === checkInTarget.tenantName.toLowerCase()) ||
                ((t.firstName || t.lastName) && checkInTarget.tenantName && `${t.firstName || ''} ${t.lastName || ''}`.trim().toLowerCase() === checkInTarget.tenantName.toLowerCase())
              );

              const tenantPaidInvoices = (invoicesData ?? []).filter((inv: any) =>
                (matchedTenant && inv.tenantId === matchedTenant.id) ||
                (inv.tenantName && checkInTarget.tenantName && inv.tenantName.toLowerCase() === checkInTarget.tenantName.toLowerCase())
              ).filter((inv: any) => inv.status === 'PAID');

              const totalInvoicesPaid = tenantPaidInvoices.reduce((sum: number, inv: any) => sum + Number(inv.amountPaid || inv.amount || 0), 0);

              const monthlyRent = Number(checkInTarget.rent || matchedTenant?.rent || 0);
              const securityDeposit = Number((checkInTarget as any).deposit || checkInTarget.depositPaid || matchedTenant?.deposit || 0);
              const totalOnboardingAmt = monthlyRent + securityDeposit;
              const matchedBooking = (bookingsData ?? []).find((b: any) =>
                (checkInTarget.bookingId && b.id === checkInTarget.bookingId) ||
                (b.tenantName && checkInTarget.tenantName && b.tenantName.toLowerCase() === checkInTarget.tenantName.toLowerCase()) ||
                (b.roomNumber === checkInTarget.roomNumber && b.bedNumber === checkInTarget.bedNumber)
              );
              const advancePaidAmt = Math.max(
                Number(checkInTarget.advanceAmount || 0),
                Number((checkInTarget as any).advancePaid || 0),
                Number(matchedBooking?.advanceAmount || 0),
                totalInvoicesPaid
              );
              const isAlreadyPaid = manualPaymentSettled || (totalOnboardingAmt > 0 && advancePaidAmt >= totalOnboardingAmt) || (totalInvoicesPaid >= totalOnboardingAmt && totalOnboardingAmt > 0);
              const netRemainingDue = isAlreadyPaid ? 0 : Math.max(0, totalOnboardingAmt - advancePaidAmt);

              return (
                <div className={`rounded-xl border p-4 space-y-3 ${
                  isAlreadyPaid
                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      isAlreadyPaid ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-700 dark:text-indigo-400'
                    }`}>
                      {isAlreadyPaid ? <BadgeCheck className="h-4 w-4 text-emerald-600" /> : <ShieldCheck className="h-4 w-4" />}
                      Step 2: Move-In Payment &amp; Deposit Verification
                    </span>
                    {isAlreadyPaid && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                        Paid in Full • ₹0 Due
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg bg-white dark:bg-slate-900 border p-3 text-xs space-y-1.5">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Monthly Rent (1 Month)</span>
                      <span className="font-semibold text-foreground">{formatCurrency(monthlyRent)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Security Deposit</span>
                      <span className="font-semibold text-foreground">{formatCurrency(securityDeposit)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1 text-slate-800 dark:text-slate-200">
                      <span>Total Initial Amount</span>
                      <span>{formatCurrency(totalOnboardingAmt)}</span>
                    </div>

                    {(advancePaidAmt > 0 || isAlreadyPaid) && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold border-t pt-1">
                        <span>Less: Payment Already Paid (Onboarding / Booking / Desk)</span>
                        <span>- {formatCurrency(isAlreadyPaid && advancePaidAmt === 0 ? totalOnboardingAmt : advancePaidAmt)}</span>
                      </div>
                    )}

                    <div className={`flex justify-between text-sm font-extrabold border-t pt-2 mt-1 ${
                      isAlreadyPaid ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-700 dark:text-indigo-300'
                    }`}>
                      <span>Net Due at Check-in</span>
                      <span className="text-base">{formatCurrency(netRemainingDue)}</span>
                    </div>
                  </div>

                  {isAlreadyPaid ? (
                    <div className="p-2.5 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>Payment Cleared:</strong> Move-in payment has already been verified and settled. No payment is required. Fill in tenant details and complete check-in.</span>
                    </div>
                  ) : (
                    <>
                      {/* Toggle if payment was received outside */}
                      <div className="flex items-center space-x-2 pt-1">
                        <Checkbox
                          id="manualSettled"
                          checked={manualPaymentSettled}
                          onCheckedChange={(c) => setManualPaymentSettled(!!c)}
                        />
                        <label
                          htmlFor="manualSettled"
                          className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          Payment already collected / settled outside (Skip payment at check-in)
                        </label>
                      </div>

                      {/* Payment Mode Selector if not settled */}
                      <div className="space-y-1.5 pt-1">
                        <Label className="text-xs font-semibold">Remaining Balance Payment Mode</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setCheckInPaymentMethod('razorpay')}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                              checkInPaymentMethod === 'razorpay'
                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <Zap className="h-4 w-4 mb-1" />
                            <span>Razorpay Online</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCheckInPaymentMethod('cash')}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                              checkInPaymentMethod === 'cash'
                                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <Wallet className="h-4 w-4 mb-1" />
                            <span>Cash / Offline</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCheckInPaymentMethod('later')}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                              checkInPaymentMethod === 'later'
                                ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <Calendar className="h-4 w-4 mb-1" />
                            <span>Pay Later</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground pt-1">
                          {checkInPaymentMethod === 'razorpay' && `Launches Razorpay checkout modal for ${formatCurrency(netRemainingDue)}.`}
                          {checkInPaymentMethod === 'cash' && `Marks tenant active and records ${formatCurrency(netRemainingDue)} paid via cash.`}
                          {checkInPaymentMethod === 'later' && `Marks tenant active and issues pending invoice for ${formatCurrency(netRemainingDue)} due in 7 days.`}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </FormDialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Check-in" variant="destructive"
        description={`Delete check-in record "${deleteTarget?.code}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />

      {/* Printable Check-in Tax Invoice Dialog */}
      {invoiceCheckIn && (
        <FormDialog
          open={!!invoiceCheckIn}
          onOpenChange={(open) => !open && setInvoiceCheckIn(null)}
          title="Tenant Check-in Tax Invoice"
          onSubmit={() => handlePrintTaxInvoice()}
          submitLabel="Print / Download PDF"
          size="lg"
        >
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-xl space-y-6 text-slate-800 dark:text-slate-100 printable-area">
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">StayEaze Co-Living & Hostels</h2>
                <p className="text-xs text-muted-foreground">GST & Tax Compliant Stay Invoice</p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold rounded-md">
                  PAID & CHECKED-IN
                </span>
                <p className="text-xs text-muted-foreground mt-1">Invoice #: INV-{(invoiceCheckIn.code || invoiceCheckIn.id).toString().toUpperCase()}</p>
                <p className="text-xs text-muted-foreground">Date: {formatDate(invoiceCheckIn.checkInDate || new Date().toISOString())}</p>
              </div>
            </div>

            {/* Tenant & Room Information */}
            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Billed To</p>
                <p className="font-semibold text-base mt-1">{invoiceCheckIn.tenantName || 'Tenant'}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Phone: {invoiceCheckIn.tenantPhone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Property & Room</p>
                <p className="font-semibold text-base mt-1">{invoiceCheckIn.propertyName || 'StayEaze Residence'}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Room: {formatRoomName(invoiceCheckIn.roomNumber)} | Bed: {invoiceCheckIn.bedNumber || 'B1'}
                </p>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                  <tr>
                    <th className="p-3 text-left">Item Description</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  <tr>
                    <td className="p-3 font-medium">1st Month Security Deposit</td>
                    <td className="p-3 text-right font-semibold">{formatCurrency(Number((invoiceCheckIn as any).securityDeposit ?? invoiceCheckIn.depositPaid ?? 0))}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">1st Month Room Rent</td>
                    <td className="p-3 text-right font-semibold">{formatCurrency(Number((invoiceCheckIn as any).rentAmount ?? invoiceCheckIn.rent ?? 0))}</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">Gross Total Initial Charges</td>
                    <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrency(Number((invoiceCheckIn as any).securityDeposit ?? invoiceCheckIn.depositPaid ?? 0) + Number((invoiceCheckIn as any).rentAmount ?? invoiceCheckIn.rent ?? 0))}
                    </td>
                  </tr>
                  {Number(invoiceCheckIn.advanceAmount || 0) > 0 && (
                    <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
                      <td className="p-3 font-medium">Less: Advance Deposit Paid</td>
                      <td className="p-3 text-right font-bold">- {formatCurrency(Number(invoiceCheckIn.advanceAmount || 0))}</td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <td className="p-3 font-bold text-base text-slate-900 dark:text-white">Net Balance Collected at Check-in</td>
                    <td className="p-3 text-right font-bold text-base text-emerald-600">
                      {formatCurrency(
                        Math.max(0, (Number((invoiceCheckIn as any).securityDeposit ?? invoiceCheckIn.depositPaid ?? 0) + Number((invoiceCheckIn as any).rentAmount ?? invoiceCheckIn.rent ?? 0)) - Number(invoiceCheckIn.advanceAmount || 0))
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Mode Note */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 flex justify-between">
              <span>Status: <strong className="text-emerald-600">FULLY SETTLED & VERIFIED</strong></span>
              <span>Authorized Signature: <strong className="font-serif italic">StayEaze Admin</strong></span>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t text-center text-xs text-muted-foreground">
              This is a computer-generated tax receipt. No physical signature required.
            </div>
          </div>
        </FormDialog>
      )}
    </div>
  );
}
