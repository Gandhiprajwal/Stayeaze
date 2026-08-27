import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, XCircle, ArrowRight, RefreshCw, FileText, Check, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface BulkImportTenantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  properties: Array<{ id: string; name: string }>;
}

interface ParsedTenantRow {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  gender: string;
  propertyName?: string;
  roomNumber: string;
  bedNumber: string;
  rent: number;
  deposit: number;
  leaseStart: string;
  leaseEnd?: string;
  occupation?: string;
  idType?: string;
  idNumber?: string;
  emergencyContactName?: string;
  emergencyContactMobile?: string;
  depositCollected: boolean;
  openingBalanceDue: number;
  sendCredentials: boolean;
  isValid: boolean;
  errors: string[];
}

export function BulkImportTenantsModal({ open, onOpenChange, onSuccess, properties }: BulkImportTenantsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'summary'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedTenantRow[]>([]);
  const [globalDepositCollected, setGlobalDepositCollected] = useState(true);
  const [globalSendCredentials, setGlobalSendCredentials] = useState(true);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ importedCount: number; failedCount: number; results: any[] } | null>(null);

  const sampleCsvContent = `Name,Email,Mobile,RoomNumber,BedNumber,Rent,Deposit,CheckInDate,Occupation,IDType,IDNumber,EmergencyContactName,EmergencyContactMobile,OpeningBalanceDue
Rahul Sharma,rahul.sharma@example.com,9876543210,101,B1,8500,17000,2024-01-15,Software Engineer,Aadhaar,123456789012,Ramesh Sharma,9876543211,0
Priya Patel,priya.patel@example.com,9876543220,102,B2,9000,18000,2024-03-01,Data Analyst,Aadhaar,987654321098,Suresh Patel,9876543222,0
Amit Kumar,amit.kumar@example.com,9876543230,201,B1,7500,15000,2023-11-10,Designer,PAN,ABCDE1234F,Sunita Kumar,9876543233,4500`;

  function downloadSampleCsv() {
    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'stayeaze_residents_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Template Downloaded', description: 'Fill the CSV template and upload it here.' });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCsvText(content);
    };
    reader.readAsText(file);
  }

  function parseCsvText(text: string) {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      toast({ title: 'Invalid File', description: 'The CSV file must have a header row and at least one resident record.', variant: 'destructive' });
      return;
    }

    const rawHeaders = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    const rows: ParsedTenantRow[] = [];
    const seenMobiles = new Set<string>();
    const seenEmails = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
      if (values.length < 2 || !values.some(v => v !== '')) continue;

      const rowObj: Record<string, string> = {};
      rawHeaders.forEach((header, index) => {
        rowObj[header] = values[index] || '';
      });

      const name = rowObj['name'] || rowObj['fullname'] || rowObj['tenantname'] || rowObj['residentname'] || `${rowObj['firstname'] || ''} ${rowObj['lastname'] || ''}`.trim() || 'Resident';
      const parts = name.split(/\s+/, 2);
      const firstName = rowObj['firstname'] || parts[0] || 'Resident';
      const lastName = rowObj['lastname'] || (parts.length > 1 ? parts[1] : 'User');
      const email = rowObj['email'] || rowObj['emailaddress'] || '';
      const mobile = rowObj['mobile'] || rowObj['phone'] || rowObj['phonenumber'] || rowObj['contact'] || '';
      const roomNumber = rowObj['roomnumber'] || rowObj['room'] || '101';
      const bedNumber = rowObj['bednumber'] || rowObj['bed'] || 'B1';
      const rent = parseFloat(rowObj['rent'] || rowObj['monthlyrent'] || '0') || 0;
      const deposit = parseFloat(rowObj['deposit'] || rowObj['securitydeposit'] || '0') || 0;
      const leaseStart = rowObj['checkindate'] || rowObj['leasestart'] || rowObj['startdate'] || new Date().toISOString().slice(0, 10);
      const occupation = rowObj['occupation'] || rowObj['profession'] || '';
      const idType = (rowObj['idtype'] || 'aadhaar').toLowerCase();
      const idNumber = rowObj['idnumber'] || rowObj['id'] || '';
      const emergencyContactName = rowObj['emergencycontactname'] || rowObj['emergencyname'] || '';
      const emergencyContactMobile = rowObj['emergencycontactmobile'] || rowObj['emergencyphone'] || rowObj['emergencycontact'] || '';
      const openingBalanceDue = parseFloat(rowObj['openingbalancedue'] || rowObj['openingbalance'] || rowObj['due'] || '0') || 0;

      const errors: string[] = [];
      if (!name || name === 'Resident') errors.push('Name is required');
      if (!mobile) errors.push('Mobile number is required');

      const cleanMob = mobile.replace(/\D/g, '').slice(-10);
      if (cleanMob.length < 10) {
        errors.push('Mobile must be 10 digits');
      } else if (seenMobiles.has(cleanMob)) {
        errors.push(`Duplicate mobile ${cleanMob} in this file`);
      } else {
        seenMobiles.add(cleanMob);
      }

      if (email) {
        const cleanEm = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEm)) {
          errors.push('Invalid email format');
        } else if (seenEmails.has(cleanEm)) {
          errors.push(`Duplicate email ${cleanEm} in this file`);
        } else {
          seenEmails.add(cleanEm);
        }
      }

      if (cleanMob && emergencyContactMobile) {
        const cleanEmerg = emergencyContactMobile.replace(/\D/g, '').slice(-10);
        if (cleanEmerg === cleanMob) {
          errors.push('Emergency contact same as resident phone');
        }
      }

      rows.push({
        name,
        firstName,
        lastName,
        email,
        mobile,
        gender: 'other',
        roomNumber,
        bedNumber,
        rent,
        deposit,
        leaseStart,
        occupation,
        idType,
        idNumber,
        emergencyContactName,
        emergencyContactMobile,
        depositCollected: globalDepositCollected,
        openingBalanceDue,
        sendCredentials: globalSendCredentials,
        isValid: errors.length === 0,
        errors,
      });
    }

    if (rows.length === 0) {
      toast({ title: 'No Data Found', description: 'Could not extract valid records from the file.', variant: 'destructive' });
      return;
    }

    setParsedRows(rows);
    setStep('preview');
  }

  async function executeBulkImport() {
    setStep('importing');
    setImportProgress(10);

    try {
      const payload = parsedRows.map(r => ({
        name: r.name,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        mobile: r.mobile,
        gender: r.gender,
        roomNumber: r.roomNumber,
        bedNumber: r.bedNumber,
        rent: r.rent,
        deposit: r.deposit,
        leaseStart: r.leaseStart,
        occupation: r.occupation,
        idType: r.idType,
        idNumber: r.idNumber,
        emergencyContactName: r.emergencyContactName,
        emergencyContactMobile: r.emergencyContactMobile,
        depositCollected: globalDepositCollected,
        openingBalanceDue: r.openingBalanceDue,
        sendCredentials: globalSendCredentials,
      }));

      setImportProgress(40);
      const res = await api.post('/tenants/bulk-import', payload);
      setImportProgress(100);
      setImportResults(res.data);
      setStep('summary');
      onSuccess();
      toast({
        title: 'Bulk Import Complete',
        description: `Successfully onboarded ${res.data.importedCount} residents.`,
      });
    } catch (err: any) {
      toast({
        title: 'Import Failed',
        description: err.response?.data?.message || 'Error occurred during bulk onboarding.',
        variant: 'destructive',
      });
      setStep('preview');
    }
  }

  function resetModal() {
    setStep('upload');
    setParsedRows([]);
    setImportResults(null);
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetModal(); onOpenChange(val); }}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-3xl lg:max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold">Existing Resident Bulk Onboarding</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Import multiple residents from Excel/CSV with historical check-in dates, deposit accounting, and automated login credentials.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-h-[calc(85vh-130px)] bg-white dark:bg-slate-900">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                      <Download className="h-4 w-4" /> 1. Download CSV Template
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use our pre-configured template with proper column headers for room numbers, rents, deposits, and historical move-in dates.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadSampleCsv} className="mt-4 border-primary/30 text-primary hover:bg-primary/10">
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download Template (.CSV)
                  </Button>
                </div>

                <div className="p-4 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <Upload className="h-4 w-4 text-primary" /> 2. Upload Filled Spreadsheet
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload your CSV or Excel export. The system will preview all rows and validate them before creating any records.
                    </p>
                  </div>
                  <div>
                    <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
                    <Button size="sm" onClick={() => fileInputRef.current?.click()} className="mt-4 w-full">
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Select CSV File
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Smart Onboarding Rules Applied</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-muted/40 border space-y-1">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> Historical Check-In
                    </span>
                    <p className="text-muted-foreground text-[11px]">Creates completed check-in records matching the resident's original move-in date.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border space-y-1">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> Deposit Accounting
                    </span>
                    <p className="text-muted-foreground text-[11px]">Marks historical security deposit as already collected (PAID) so duplicate dues aren't generated.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border space-y-1">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" /> Auto-Provision Login
                    </span>
                    <p className="text-muted-foreground text-[11px]">Generates secure credentials and emails/SMS each resident with password reset on first login.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-bold">{parsedRows.length} Total Records</Badge>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold">
                    {parsedRows.filter(r => r.isValid).length} Valid
                  </Badge>
                  {parsedRows.filter(r => !r.isValid).length > 0 && (
                    <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold">
                      {parsedRows.filter(r => !r.isValid).length} Issues
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={globalDepositCollected} onCheckedChange={(v) => setGlobalDepositCollected(!!v)} />
                    <span>Mark Deposits as Already Collected</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={globalSendCredentials} onCheckedChange={(v) => setGlobalSendCredentials(!!v)} />
                    <span>Auto-Dispatch Credentials</span>
                  </label>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/80 sticky top-0 text-[11px] uppercase tracking-wider font-semibold border-b">
                    <tr>
                      <th className="p-2.5">Resident</th>
                      <th className="p-2.5">Contact</th>
                      <th className="p-2.5">Room & Bed</th>
                      <th className="p-2.5">Rent / Deposit</th>
                      <th className="p-2.5">Move-In Date</th>
                      <th className="p-2.5">Opening Due</th>
                      <th className="p-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'hover:bg-muted/20' : 'bg-rose-500/5 hover:bg-rose-500/10'}>
                        <td className="p-2.5 font-medium">
                          <div>{row.name}</div>
                          {row.occupation && <div className="text-[10px] text-muted-foreground">{row.occupation}</div>}
                        </td>
                        <td className="p-2.5">
                          <div>{row.mobile}</div>
                          <div className="text-[10px] text-muted-foreground">{row.email || '—'}</div>
                        </td>
                        <td className="p-2.5">
                          <span className="font-semibold text-primary">Room {row.roomNumber}</span>
                          <span className="text-muted-foreground"> · {row.bedNumber}</span>
                        </td>
                        <td className="p-2.5">
                          <div className="font-medium">{formatCurrency(row.rent)}</div>
                          <div className="text-[10px] text-muted-foreground">Dep: {formatCurrency(row.deposit)}</div>
                        </td>
                        <td className="p-2.5 text-muted-foreground">{row.leaseStart}</td>
                        <td className="p-2.5">
                          {row.openingBalanceDue > 0 ? (
                            <span className="font-bold text-amber-600">{formatCurrency(row.openingBalanceDue)}</span>
                          ) : (
                            <span className="text-muted-foreground">₹0</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          {row.isValid ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                              Ready
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]" title={row.errors.join(', ')}>
                              {row.errors[0]}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <RefreshCw className="h-10 w-10 text-primary animate-spin" />
              <div className="space-y-1">
                <h3 className="font-bold text-lg">Onboarding Residents...</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Creating tenant profiles, backdating check-in records, recording deposits, and provisioning secure user accounts.
                </p>
              </div>
              <div className="w-full max-w-md space-y-2">
                <Progress value={importProgress} className="h-2" />
                <div className="text-xs text-muted-foreground">{importProgress}% complete</div>
              </div>
            </div>
          )}

          {step === 'summary' && importResults && (
            <div className="space-y-6 text-center py-6">
              <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold">Onboarding Complete!</h3>
                <p className="text-xs text-muted-foreground">
                  Successfully added <span className="font-bold text-foreground">{importResults.importedCount}</span> resident accounts.
                  {importResults.failedCount > 0 && ` (${importResults.failedCount} skipped or failed)`}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto text-left">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[10px] uppercase font-bold text-emerald-600">Imported</div>
                  <div className="text-2xl font-black text-emerald-700">{importResults.importedCount}</div>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="text-[10px] uppercase font-bold text-blue-600">Credentials Sent</div>
                  <div className="text-2xl font-black text-blue-700">{globalSendCredentials ? importResults.importedCount : 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted border">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Skipped/Failed</div>
                  <div className="text-2xl font-black">{importResults.failedCount}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-row items-center justify-between gap-3 shrink-0">
          {step === 'upload' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-9 px-4 text-xs font-semibold">
                Cancel
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2 h-9 px-4 text-xs font-semibold shadow-xs">
                <Upload className="h-4 w-4" /> Select CSV File
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')} className="h-9 px-4 text-xs font-semibold">
                Back
              </Button>
              <Button onClick={executeBulkImport} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-9 px-4 text-xs shadow-xs">
                Confirm & Import {parsedRows.filter(r => r.isValid).length} Residents <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {step === 'summary' && (
            <Button onClick={() => onOpenChange(false)} className="w-full h-9 text-xs font-semibold">
              Done & View Tenants
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
