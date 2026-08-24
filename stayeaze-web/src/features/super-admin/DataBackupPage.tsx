import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Database, Download, HardDrive, ShieldCheck, FileSpreadsheet, Server, Cloud } from 'lucide-react';

export default function DataBackupPage() {
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [exportingOrg, setExportingOrg] = useState(false);
  const [exportingSystem, setExportingSystem] = useState(false);

  const { data: subscribersData } = useQuery({
    queryKey: ['super-admin-subscribers-backup-list'],
    queryFn: () => api.get('/super-admin/subscribers?pageSize=100').then((r) => r.data),
  });

  const subscribersList = Array.isArray(subscribersData)
    ? subscribersData
    : Array.isArray(subscribersData?.content)
    ? subscribersData.content
    : Array.isArray(subscribersData?.data)
    ? subscribersData.data
    : [];

  const handleExportOrg = async () => {
    if (!selectedOrgId) {
      toast.error('Please select an organization to export');
      return;
    }
    setExportingOrg(true);
    try {
      const response = await api.get(`/super-admin/backup/export-org/${selectedOrgId}`, {
        responseType: 'blob',
      });
      
      const selectedOrg = subscribersList.find((s: any) => s.id === selectedOrgId);
      const orgName = selectedOrg ? selectedOrg.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'org';
      
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)], { type: 'application/json' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stayeaze_backup_${orgName}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Organization backup downloaded successfully!');
    } catch (err: any) {
      toast.error('Failed to export organization backup');
    } finally {
      setExportingOrg(false);
    }
  };

  const handleExportSystem = async () => {
    setExportingSystem(true);
    try {
      const response = await api.get('/super-admin/backup/export-system', {
        responseType: 'blob',
      });
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)], { type: 'application/json' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stayeaze_system_snapshot_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Global platform snapshot downloaded successfully!');
    } catch (err: any) {
      toast.error('Failed to export platform snapshot');
    } finally {
      setExportingSystem(false);
    }
  };

  const [purging, setPurging] = useState(false);

  const handlePurgeAllData = async () => {
    if (!window.confirm('WARNING: Are you sure you want to purge all tenant subscribers, properties, users, and organization data? This action CANNOT be undone!')) {
      return;
    }
    setPurging(true);
    try {
      const res = await api.post('/super-admin/backup/purge-all-data');
      toast.success(res.data?.message || 'Database purged successfully!');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to purge database');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" /> Tenant Data Backup & Reset Tool
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate, download, and manage full database JSON dumps, backups, or reset tenant organization data.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization Export */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Subscriber Organization Backup</CardTitle>
            </div>
            <CardDescription>
              Export full entity dump for a single organization (Users, Properties, Beds, Bookings, Payments, Complaints).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Select Subscriber Organization</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Organization" />
                </SelectTrigger>
                <SelectContent>
                  {subscribersList.map((sub: any) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name} ({sub.ownerEmail || 'Org'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Includes Entities:
              </p>
              <p>• Organization Profile, User Accounts & Roles</p>
              <p>• Properties, Buildings, Floors, Rooms & Beds</p>
              <p>• Tenant Profiles, Check-ins, Bookings & Invoices</p>
            </div>
            <Button
              onClick={handleExportOrg}
              disabled={!selectedOrgId || exportingOrg}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Download className="mr-2 h-4 w-4" />
              {exportingOrg ? 'Generating JSON Backup...' : 'Export Complete Org Data (JSON)'}
            </Button>
          </CardContent>
        </Card>

        {/* Global Snapshot Export */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-lg">Full Platform Snapshot & Reset</CardTitle>
            </div>
            <CardDescription>
              Export platform snapshot or perform a complete database purge of all tenant subscribers & properties.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5 text-indigo-600" /> System Health Status:
              </p>
              <div className="flex items-center justify-between pt-1">
                <span>Database Status:</span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">ONLINE</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>S3 Storage Sync:</span>
                <Badge variant="outline">READY</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Button
                onClick={handleExportSystem}
                disabled={exportingSystem}
                variant="outline"
                className="w-full border-indigo-600/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {exportingSystem ? 'Creating Snapshot...' : 'Export Full Platform Snapshot (JSON)'}
              </Button>
              <Button
                onClick={handlePurgeAllData}
                disabled={purging}
                variant="destructive"
                className="w-full"
              >
                <Database className="mr-2 h-4 w-4" />
                {purging ? 'Purging All Database Data...' : 'Purge All Subscriber & Tenant Data (Clean Reset)'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
