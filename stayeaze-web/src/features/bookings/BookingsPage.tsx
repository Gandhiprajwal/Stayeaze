import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Plus, Pencil, Trash2, Eye, CheckCircle2, XCircle, CreditCard, Zap, Wallet, Calendar, FileText, Download } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { Booking, Property, Room, Bed } from '@/lib/types';
import { formatCurrency, formatDate, formatRoomName } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/bookings';
const statuses = [
  { value: 'pending', label: 'Pending' }, { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' }, { value: 'expired', label: 'Expired' },
  { value: 'checked_in', label: 'Checked In' },
];
const sources = [
  { value: 'direct', label: 'Direct' }, { value: 'website', label: 'Website' },
  { value: 'agent', label: 'Agent' }, { value: 'referral', label: 'Referral' },
];

const emptyForm = {
  tenantName: '', tenantEmail: '', tenantPhone: '', propertyId: '',
  roomNumber: '', bedNumber: 'B1', checkInDate: new Date().toISOString().slice(0, 10),
  durationMonths: 6, rent: 8000, deposit: 16000, advanceAmount: 2000, status: 'pending' as Booking['status'],
  source: 'direct' as Booking['source'],
};

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cash' | 'later'>('cash');
  const [processingPayment, setProcessingPayment] = useState(false);

  const { data: properties } = useQuery({
    queryKey: ['bookings-properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });
  const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));

  // Fetch all rooms for dropdown
  const { data: allRooms } = useQuery({
    queryKey: ['bookings-rooms'],
    queryFn: () => api.get<Room[]>('/rooms', { params: { pageSize: 500 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Room[];
      return (payload as { data: Room[] }).data ?? [];
    }),
    enabled: dialogOpen,
  });

  const roomOptions = (allRooms ?? []).filter((r) => r.status !== 'archived' && r.status !== 'maintenance' && r.status !== 'blocked');

  // Fetch beds for selected room
  const { data: bedsForRoom } = useQuery({
    queryKey: ['bookings-beds', selectedRoomId],
    queryFn: () => api.get<Bed[]>(`/rooms/${selectedRoomId}/beds`).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Bed[];
      return (payload as { data: Bed[] }).data ?? [];
    }),
    enabled: !!selectedRoomId,
  });

  const createMut = useCreate<Booking>(ENDPOINT, 'Booking');
  const updateMut = useUpdate<Booking>(ENDPOINT, 'Booking');
  const deleteMut = useDelete(ENDPOINT, 'Booking');
  const form = useForm(emptyForm);

  const { data: defaultDepData } = useQuery({
    queryKey: ['org-billing-profile-deposit-bookings'],
    queryFn: () => api.get<any>('/organization-billing-profile/default-deposit').then((r) => r.data),
  });

  function openCreate() {
    queryClient.invalidateQueries({ queryKey: ['bookings-rooms'] });
    queryClient.invalidateQueries({ queryKey: ['bookings-beds'] });
    setEditing(null);
    setPaymentMethod('cash');
    setSelectedRoomId('');
    const defaultDep = Number(defaultDepData?.defaultSecurityDeposit || 0);
    form.reset({ ...emptyForm, deposit: defaultDep });
    setDialogOpen(true);
  }

  function openEdit(row: Booking) {
    setEditing(row);
    const matchedRoom = (allRooms ?? []).find((r) => r.number === row.roomNumber);
    setSelectedRoomId(matchedRoom?.id ?? '');
    form.reset({
      tenantName: row.tenantName, tenantEmail: row.tenantEmail, tenantPhone: row.tenantPhone,
      propertyId: row.propertyId, roomNumber: row.roomNumber, bedNumber: row.bedNumber,
      checkInDate: row.checkInDate, durationMonths: row.durationMonths, rent: row.rent,
      deposit: row.deposit, advanceAmount: (row as any).advanceAmount ?? 2000, status: row.status, source: row.source,
    });
    setDialogOpen(true);
  }

  function submit() {
    if (!form.validate({
      tenantName: (v) => !v ? 'Required' : undefined,
      tenantEmail: (v) => !v ? 'Required' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? 'Invalid email' : undefined,
      propertyId: (v) => !v ? 'Select a property' : undefined,
    })) return;

    const payload = {
      ...form.values,
      bookingCode: editing?.bookingCode ?? `BK-${String(Date.now()).slice(-4)}`,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };

    const advanceAmt = Number(form.values.advanceAmount || 0);

    if (!editing && paymentMethod === 'razorpay' && advanceAmt > 0) {
      setProcessingPayment(true);
      api.post('/bookings/order', {
        propertyId: form.values.propertyId,
        advanceAmount: advanceAmt,
        tenantName: form.values.tenantName,
        tenantEmail: form.values.tenantEmail,
        tenantPhone: form.values.tenantPhone,
      }).then((res) => {
        const orderData = res.data;
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'StayEaze Booking Advance Deposit',
          description: `Advance Deposit for ${form.values.tenantName}`,
          order_id: orderData.orderId,
          handler: function (response: any) {
            setProcessingPayment(false);
            const rzpPayload = {
              ...payload,
              paymentMethod: 'RAZORPAY',
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            };
            createMut.mutate(rzpPayload, {
              onSuccess: () => {
                queryClient.invalidateQueries();
                toast({ title: 'Booking Created & Paid', description: `Razorpay advance payment ${response.razorpay_payment_id} recorded successfully.` });
                setDialogOpen(false);
              },
            });
          },
          modal: {
            ondismiss: function () {
              setProcessingPayment(false);
              toast({ title: 'Payment Dismissed', description: 'Razorpay checkout was closed without completing advance deposit payment.', variant: 'destructive' });
            },
          },
          prefill: {
            name: form.values.tenantName,
            email: form.values.tenantEmail || '',
            contact: form.values.tenantPhone || '',
          },
          theme: { color: '#4f46e5' },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }).catch((err) => {
        setProcessingPayment(false);
        const errMsg = err?.response?.data?.message || err?.message || 'Failed to initialize Razorpay checkout.';
        toast({ title: 'Payment Setup Error', description: errMsg, variant: 'destructive' });
      });
      return;
    }

    const finalPayload = {
      ...payload,
      paymentMethod: paymentMethod === 'cash' ? 'CASH' : 'LATER',
    };

    if (editing) updateMut.mutate({ id: editing.id, payload: finalPayload }, { onSuccess: () => { queryClient.invalidateQueries(); setDialogOpen(false); } });
    else createMut.mutate(finalPayload, { onSuccess: () => { queryClient.invalidateQueries(); setDialogOpen(false); } });
  }

  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => { queryClient.invalidateQueries(); setDeleteTarget(null); } }); }

  const columns: Column<Booking>[] = [
    { key: 'bookingCode', header: 'Booking ID', sortable: true, cell: (r) => <span className="font-mono text-xs font-medium">{r.bookingCode}</span> },
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => (
      <div><p className="font-medium">{r.tenantName}</p><p className="text-xs text-muted-foreground">{r.tenantEmail}</p></div>
    )},
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{String(propMap.get(r.propertyId) || '—')}</span> },
    { key: 'roomNumber', header: 'Room / Bed', sortable: true, cell: (r) => <span className="text-sm">Room {r.roomNumber} · {r.bedNumber}</span> },
    { key: 'checkInDate', header: 'Check-in', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.checkInDate)}</span> },
    { key: 'rent', header: 'Rent', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.rent)}</span> },
    { key: 'advanceAmount', header: 'Advance Paid', sortable: true, cell: (r) => (
      <div>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {formatCurrency((r as any).advanceAmount ?? 0)}
        </span>
        {(r as any).advancePaymentStatus === 'PAID' && (
          <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            PAID
          </span>
        )}
      </div>
    )},
    { key: 'source', header: 'Source', sortable: true, cell: (r) => <span className="text-sm capitalize">{r.source}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null);
  const propertyFilterOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Manage booking requests and reservations." icon={CalendarCheck}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> New Booking</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search by booking ID or tenant..." exportFilename="bookings" initialSortBy="checkInDate" initialSortOrder="desc"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          { key: 'source', label: 'Source', options: sources },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'View Details', icon: Pencil, onSelect: () => navigate(`/bookings/${row.id}`) },
            ...(Number(row.advanceAmount || 0) > 0 ? [{ label: 'Print Advance Receipt', icon: Download, onSelect: () => setReceiptBooking(row) }] : []),
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )}
      />

      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Booking' : 'New Booking'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending || processingPayment}
        submitLabel={editing ? 'Save' : (processingPayment ? 'Opening Razorpay...' : 'Create Booking')} size="lg">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput label="Tenant Name" required id="tenantName" value={form.values.tenantName} onChange={(e) => form.setValue('tenantName', e.target.value)} error={form.errors.tenantName} />
            <FormInput label="Email" required type="email" id="tenantEmail" value={form.values.tenantEmail} onChange={(e) => form.setValue('tenantEmail', e.target.value)} error={form.errors.tenantEmail} />
            <FormInput label="Phone" id="tenantPhone" value={form.values.tenantPhone} onChange={(e) => form.setValue('tenantPhone', e.target.value)} />
            <div className="space-y-1.5">
              <Label required>Property</Label>
              <Select value={form.values.propertyId} onValueChange={(v) => form.setValue('propertyId', v)}>
                <SelectTrigger className={form.errors.propertyId ? 'border-destructive' : ''}><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>{(properties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              {form.errors.propertyId && <p className="text-xs font-medium text-destructive">{form.errors.propertyId}</p>}
            </div>

            {/* Room Number Dropdown */}
            <div className="space-y-1.5">
              <Label required>Room Number</Label>
              <Select
                value={selectedRoomId}
                onValueChange={(roomId) => {
                  setSelectedRoomId(roomId);
                  const rm = roomOptions.find((r) => r.id === roomId);
                  if (rm) {
                    form.setValue('roomNumber', rm.number || rm.roomNumber || '');
                    const storedRent = Number(rm.rent ?? (rm as any).baseRent ?? 0);
                    if (storedRent > 0) {
                      form.setValue('rent', storedRent);
                    }
                  }
                }}>
                <SelectTrigger className={form.errors.roomNumber ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {roomOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {formatRoomName(r.number || r.roomNumber)} ({r.sharing ? `${r.sharing} share` : 'Room'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.errors.roomNumber && <p className="text-xs font-medium text-destructive">{form.errors.roomNumber}</p>}
              {editing && !selectedRoomId && (
                <p className="text-xs text-muted-foreground">Current: Room {form.values.roomNumber || '—'}</p>
              )}
            </div>

            {/* Bed Number Dropdown */}
            <div className="space-y-1.5">
              <Label required>Bed Number</Label>
              <Select
                value={form.values.bedNumber}
                onValueChange={(v) => form.setValue('bedNumber', v)}
                disabled={!selectedRoomId}>
                <SelectTrigger className={form.errors.bedNumber ? 'border-destructive' : ''}>
                  <SelectValue placeholder={!selectedRoomId ? 'Select room first' : (bedsForRoom?.length === 0 ? 'No beds' : 'Select bed')} />
                </SelectTrigger>
                <SelectContent>
                  {(bedsForRoom ?? []).map((b) => {
                    const bStatusLower = String(b.status || 'available').toLowerCase();
                    const bedNumStr = b.number || b.bedNumber || String(b.id);
                    const isUnavailable = (bStatusLower === 'occupied' || bStatusLower === 'archived' || bStatusLower === 'maintenance' || bStatusLower === 'blocked')
                      && (!editing || (b.number !== editing.bedNumber && b.bedNumber !== editing.bedNumber));
                    const statusLabel = bStatusLower === 'occupied' 
                      ? 'Occupied' 
                      : (bStatusLower === 'archived' ? 'Archived' : (bStatusLower === 'maintenance' ? 'Maintenance' : (bStatusLower === 'blocked' ? 'Blocked' : b.status)));
                    return (
                      <SelectItem key={b.id} value={bedNumStr} disabled={isUnavailable}>
                        {bedNumStr} {isUnavailable ? `(${statusLabel} - Unavailable)` : `(${b.status})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {form.errors.bedNumber && <p className="text-xs font-medium text-destructive">{form.errors.bedNumber}</p>}
              {editing && !selectedRoomId && form.values.bedNumber && (
                <p className="text-xs text-muted-foreground">Current: {form.values.bedNumber}</p>
              )}
            </div>

            <FormInput label="Check-in Date" required type="date" id="checkInDate" value={form.values.checkInDate} onChange={(e) => form.setValue('checkInDate', e.target.value)} error={form.errors.checkInDate} />
            <FormInput label="Duration (months)" type="number" id="durationMonths" value={String(form.values.durationMonths)} onChange={(e) => form.setValue('durationMonths', Number(e.target.value))} />
            <FormInput label="Monthly Rent (₹)" type="number" id="rent" value={String(form.values.rent)} onChange={(e) => form.setValue('rent', Number(e.target.value))} />
            <FormInput label="Deposit (₹)" type="number" id="deposit" value={String(form.values.deposit)} onChange={(e) => form.setValue('deposit', Number(e.target.value))} />
            <FormInput label="Advance Booking Deposit (₹)" type="number" id="advanceAmount" value={String(form.values.advanceAmount)} onChange={(e) => form.setValue('advanceAmount', Number(e.target.value))} />
            <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Booking['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Source</Label><Select value={form.values.source} onValueChange={(v) => form.setValue('source', v as Booking['source'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sources.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          </div>

          {!editing && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" /> Advance Booking Deposit Payment
                </span>
                <span className="text-sm font-extrabold text-indigo-900 dark:text-indigo-200">
                  Advance: ₹{Number(form.values.advanceAmount || 0)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('razorpay')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    paymentMethod === 'razorpay'
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Zap className="h-4 w-4 mb-1" />
                  <span>Razorpay Online</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    paymentMethod === 'cash'
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Wallet className="h-4 w-4 mb-1" />
                  <span>Cash / Offline</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('later')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    paymentMethod === 'later'
                      ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="h-4 w-4 mb-1" />
                  <span>Pay Later</span>
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                {paymentMethod === 'razorpay' && 'Launches Razorpay checkout popup to collect advance deposit online.'}
                {paymentMethod === 'cash' && 'Records booking and marks advance deposit as paid via cash/offline.'}
                {paymentMethod === 'later' && 'Creates booking entry with pending advance deposit.'}
              </p>
            </div>
          )}
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Booking" variant="destructive"
        description={`Delete booking "${deleteTarget?.bookingCode}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />

      {/* Advance Deposit Receipt Printable Modal */}
      {receiptBooking && (
        <FormDialog
          open={!!receiptBooking}
          onOpenChange={(open) => !open && setReceiptBooking(null)}
          title="Advance Deposit Receipt"
          onSubmit={() => handlePrintReceipt()}
          submitLabel="Print / Download PDF"
          size="lg"
        >
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-xl space-y-6 text-slate-800 dark:text-slate-100 printable-area">
            {/* Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">StayEaze Property Management</h2>
                <p className="text-xs text-muted-foreground">Official Payment Receipt & Deposit Voucher</p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold rounded-md">
                  ADVANCE DEPOSIT PAID
                </span>
                <p className="text-xs text-muted-foreground mt-1">Receipt #: REC-ADV-{(receiptBooking.bookingCode || receiptBooking.id).toString().slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-muted-foreground">Date: {formatDate(receiptBooking.createdAt || new Date().toISOString())}</p>
              </div>
            </div>

            {/* Guest & Room Details */}
            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Guest Information</p>
                <p className="font-semibold text-base mt-1">{receiptBooking.tenantName}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{receiptBooking.tenantEmail}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{receiptBooking.tenantPhone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Booking Assignment</p>
                <p className="font-semibold text-base mt-1">Room {receiptBooking.roomNumber || '—'}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Bed: {receiptBooking.bedNumber || 'B1'}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Expected Check-in: {formatDate(receiptBooking.checkInDate)}</p>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                  <tr>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-right">Payment Mode</th>
                    <th className="p-3 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  <tr>
                    <td className="p-3 font-medium">Advance Booking Deposit</td>
                    <td className="p-3 text-right capitalize font-semibold text-emerald-600">
                      {receiptBooking.paymentMethod === 'razorpay' ? 'Razorpay Online' : 'Cash / Offline'}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-600">
                      {formatCurrency(Number(receiptBooking.advanceAmount || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {receiptBooking.razorpayPaymentId && (
              <div className="text-xs bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-md text-emerald-800 dark:text-emerald-300 flex justify-between">
                <span>Razorpay Transaction ID:</span>
                <span className="font-mono font-bold">{receiptBooking.razorpayPaymentId}</span>
              </div>
            )}

            {/* Note */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              <strong>Check-in Payment Policy:</strong> This advance deposit reserves your bed assignment. Upon check-in, this amount of <strong>{formatCurrency(Number(receiptBooking.advanceAmount || 0))}</strong> will be deducted from your total initial payment (1 Month Rent + Security Deposit).
            </div>

            {/* Footer */}
            <div className="pt-4 border-t text-center text-xs text-muted-foreground">
              Thank you for choosing StayEaze! For assistance, contact support@stayeaze.com
            </div>
          </div>
        </FormDialog>
      )}
    </div>
  );
}

void CheckCircle2; void XCircle;
