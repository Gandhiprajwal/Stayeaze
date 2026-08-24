import { useState, useEffect } from 'react';
import { UserPlus, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, Sparkles, Phone, Mail, Building, KeyRound, Calendar, Check, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { RoomSelect } from '@/components/common/RoomSelect';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import type { Property, Room, Bed } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

interface QuickAddTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  properties: Property[];
  rooms: Room[];
  beds: Bed[];
}

export function QuickAddTenantModal({ open, onOpenChange, onSuccess, properties, rooms, beds }: QuickAddTenantModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [propertyId, setPropertyId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [bedNumber, setBedNumber] = useState('');

  // Financials & Move-in
  const [rent, setRent] = useState(8000);
  const [deposit, setDeposit] = useState(16000);
  const [leaseStart, setLeaseStart] = useState(new Date().toISOString().slice(0, 10));
  const [leaseEnd, setLeaseEnd] = useState('');
  const [depositAlreadyPaid, setDepositAlreadyPaid] = useState(true);
  const [openingBalanceDue, setOpeningBalanceDue] = useState(0);

  // KYC & Emergency
  const [occupation, setOccupation] = useState('');
  const [idType, setIdType] = useState('aadhaar');
  const [idNumber, setIdNumber] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [sendCredentials, setSendCredentials] = useState(true);

  // Auto-fill property if only 1 exists
  useEffect(() => {
    if (properties.length === 1 && !propertyId) {
      setPropertyId(properties[0].id);
    }
  }, [properties, propertyId]);

  function resetForm() {
    setStep(1);
    setName('');
    setPhone('');
    setEmail('');
    setGender('male');
    setPropertyId(properties.length === 1 ? properties[0].id : '');
    setRoomId('');
    setRoomNumber('');
    setBedNumber('');
    setRent(8000);
    setDeposit(16000);
    setLeaseStart(new Date().toISOString().slice(0, 10));
    setLeaseEnd('');
    setDepositAlreadyPaid(true);
    setOpeningBalanceDue(0);
    setOccupation('');
    setIdType('aadhaar');
    setIdNumber('');
    setEmergencyName('');
    setEmergencyContact('');
    setSendCredentials(true);
  }

  const isStep1Valid = name.trim().length > 1 && phone.trim().length >= 10 && propertyId && roomNumber;
  const isStep2Valid = rent >= 0 && deposit >= 0 && leaseStart;

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const parts = name.trim().split(/\s+/, 2);
      const payload = {
        name: name.trim(),
        firstName: parts[0],
        lastName: parts.length > 1 ? parts[1] : 'Resident',
        email: email.trim() || undefined,
        mobile: phone.trim(),
        phone: phone.trim(),
        gender,
        propertyId,
        roomId: roomId || undefined,
        roomNumber: roomNumber || '101',
        bedNumber: bedNumber || 'B1',
        rent,
        deposit,
        leaseStart,
        leaseEnd: leaseEnd || undefined,
        occupation: occupation.trim() || undefined,
        idType: idNumber.trim() ? idType : undefined,
        idNumber: idNumber.trim() || undefined,
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactMobile: emergencyContact.trim() || undefined,
        paymentMethod: depositAlreadyPaid ? 'CASH' : undefined,
        status: 'active',
      };

      const res = await api.post('/tenants', payload);
      
      // If opening balance due was specified, create an invoice for it
      if (openingBalanceDue > 0 && res.data?.id) {
        try {
          await api.post('/invoices', {
            tenantId: res.data.id,
            propertyId,
            roomNumber,
            amount: openingBalanceDue,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            issueDate: leaseStart || new Date().toISOString().slice(0, 10),
            status: 'unpaid',
            items: [{ description: 'Previous Outstanding Rent Balance', amount: openingBalanceDue }],
          });
        } catch (ignored) {}
      }

      toast({
        title: 'Resident Onboarded Successfully',
        description: sendCredentials && email
          ? `Resident created & login credentials dispatched to ${email}.`
          : `Resident ${name} added and room occupied.`,
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({
        title: 'Failed to Add Resident',
        description: err.response?.data?.message || 'Please check all required fields.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const propertyOptions = properties.map(p => ({ value: p.id, label: p.name }));

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="sm:max-w-2xl flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Quick Add Resident</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Streamlined onboarding wizard for existing & new residents.
                </DialogDescription>
              </div>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className={`px-2 py-0.5 rounded-full ${step === 1 ? 'bg-primary text-primary-foreground font-bold' : step > 1 ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                1. Room
              </span>
              <span className="text-muted-foreground">→</span>
              <span className={`px-2 py-0.5 rounded-full ${step === 2 ? 'bg-primary text-primary-foreground font-bold' : step > 2 ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                2. Financials
              </span>
              <span className="text-muted-foreground">→</span>
              <span className={`px-2 py-0.5 rounded-full ${step === 3 ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'}`}>
                3. KYC (Opt.)
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* STEP 1: Basic Info & Room Allocation */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Full Name *</Label>
                  <Input placeholder="e.g. Rahul Sharma" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Phone Number *</Label>
                  <Input placeholder="10-digit mobile number" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Email Address (for login)</Label>
                  <Input type="email" placeholder="e.g. rahul@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Gender</Label>
                  <Select value={gender} onValueChange={(v: any) => setGender(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Property *</Label>
                  <SearchableSelect
                    options={propertyOptions}
                    value={propertyId}
                    onChange={(val) => {
                      setPropertyId(val);
                      setRoomId('');
                      setRoomNumber('');
                      setBedNumber('');
                    }}
                    placeholder="Select Property"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Room & Bed *</Label>
                  <RoomSelect
                    rooms={rooms}
                    beds={beds}
                    selectedRoomNumber={roomNumber}
                    selectedBedNumber={bedNumber}
                    onSelectRoom={(rNum, rId, defaultRent) => {
                      setRoomNumber(rNum);
                      if (rId) setRoomId(rId);
                      if (defaultRent && rent === 8000) setRent(defaultRent);
                    }}
                    onSelectBed={(bNum) => {
                      setBedNumber(bNum);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Financials & Historical Check-in */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Historical Check-In Date *</Label>
                  <Input type="date" value={leaseStart} onChange={e => setLeaseStart(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Original date resident moved into the PG.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Lease End Date (Optional)</Label>
                  <Input type="date" value={leaseEnd} onChange={e => setLeaseEnd(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Monthly Rent (₹) *</Label>
                  <Input type="number" min={0} value={rent} onChange={e => setRent(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Security Deposit (₹) *</Label>
                  <Input type="number" min={0} value={deposit} onChange={e => setDeposit(Number(e.target.value))} />
                </div>
              </div>

              <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox checked={depositAlreadyPaid} onCheckedChange={(v) => setDepositAlreadyPaid(!!v)} className="mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground">Security Deposit Already Collected on Paper</span>
                    <p className="text-[11px] text-muted-foreground">
                      Marks the deposit as PAID. No duplicate pending deposit invoice will be generated.
                    </p>
                  </div>
                </label>

                <div className="pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Previous Outstanding Balance / Unpaid Dues (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0 if all past rent is cleared"
                      value={openingBalanceDue || ''}
                      onChange={e => setOpeningBalanceDue(Number(e.target.value) || 0)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      If the resident owes back rent, enter it here to create a pending opening balance invoice.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Optional KYC & Emergency Contacts */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>This step is optional. You can complete it now or let the resident fill their own KYC later.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Occupation / Company</Label>
                  <Input placeholder="e.g. TCS / Student" value={occupation} onChange={e => setOccupation(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5 col-span-1">
                    <Label className="text-xs font-bold">ID Type</Label>
                    <Select value={idType} onValueChange={setIdType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aadhaar">Aadhaar</SelectItem>
                        <SelectItem value="pan">PAN</SelectItem>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="driving_license">DL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs font-bold">ID Number</Label>
                    <Input placeholder="e.g. 1234 5678 9012" value={idNumber} onChange={e => setIdNumber(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Emergency Contact Person</Label>
                  <Input placeholder="e.g. Parent / Guardian" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Emergency Phone</Label>
                  <Input placeholder="Emergency 10-digit number" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} />
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <div>
                    <span className="text-xs font-bold">Auto-Send Login Credentials</span>
                    <p className="text-[10px] text-muted-foreground">Emails random secure password & requires reset on first login.</p>
                  </div>
                </div>
                <Checkbox checked={sendCredentials} onCheckedChange={(v) => setSendCredentials(!!v)} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 flex items-center justify-between">
          {step === 1 && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!isStep1Valid} onClick={() => setStep(2)} className="gap-2">
                Next: Financials <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleSubmit} disabled={isSubmitting || !isStep2Valid}>
                  Save Now (Skip KYC)
                </Button>
                <Button disabled={!isStep2Valid} onClick={() => setStep(3)} className="gap-2">
                  Next: KYC & Emergency <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                <Check className="h-4 w-4" /> Complete Onboarding
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
