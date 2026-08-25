import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wifi, Plus, Trash2, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Router, Layers, Building2, DoorOpen, Tag } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

export interface WifiNetworkConfig {
  id: string;
  ssid: string;
  password: string;
  targetBuildingName?: string; // e.g. "ALL" | "Tower A" | "Tower B"
  coverageType: 'ALL_PROPERTY' | 'BUILDINGS' | 'FLOORS' | 'ROOMS';
  coveredBuildingNames: string[];
  coveredFloorNames: string[];
  coveredRoomNumbers: string[];
  frequency: string;
  notes: string;
}

export default function WifiSettingsSection() {
  const queryClient = useQueryClient();

  // 1. Fetch properties (Multi-Property Support)
  const { data: rawProperties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ['properties-minimal'],
    queryFn: async () => {
      const res = await api.get('/properties/minimal');
      const payload = res.data;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.content)) return payload.content;
      if (Array.isArray(payload)) return payload;
      return [];
    },
  });

  const properties = useMemo(() => (Array.isArray(rawProperties) ? rawProperties : []), [rawProperties]);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  useEffect(() => {
    if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  // 2. Fetch selected property detail
  const { data: propertyDetail, isLoading: propertyLoading, refetch } = useQuery({
    queryKey: ['property-detail', selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return null;
      const res = await api.get(`/properties/${selectedPropertyId}`);
      return res.data;
    },
    enabled: Boolean(selectedPropertyId),
  });

  // 3. Fetch buildings for selected property (Multi-Building Support)
  const { data: rawBuildings = [] } = useQuery({
    queryKey: ['property-buildings', selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      try {
        const res = await api.get(`/properties/${selectedPropertyId}/buildings`);
        const payload = res.data;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.content)) return payload.content;
        if (Array.isArray(payload)) return payload;
        return [];
      } catch {
        const fallback = await api.get('/buildings?pageSize=100');
        const list = Array.isArray(fallback.data?.data)
          ? fallback.data.data
          : Array.isArray(fallback.data?.content)
          ? fallback.data.content
          : Array.isArray(fallback.data)
          ? fallback.data
          : [];
        return list.filter((b: any) => !b.propertyId || b.propertyId === selectedPropertyId);
      }
    },
    enabled: Boolean(selectedPropertyId),
  });

  const dbBuildings = useMemo(() => (Array.isArray(rawBuildings) ? rawBuildings : []), [rawBuildings]);

  // 4. Fetch floors for selected property
  const { data: rawFloors = [] } = useQuery({
    queryKey: ['property-all-floors', selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      try {
        const res = await api.get(`/properties/${selectedPropertyId}/all-floors`);
        const payload = res.data;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.content)) return payload.content;
        if (Array.isArray(payload)) return payload;
        return [];
      } catch {
        const fallback = await api.get('/floors?pageSize=100');
        const list = Array.isArray(fallback.data?.data)
          ? fallback.data.data
          : Array.isArray(fallback.data?.content)
          ? fallback.data.content
          : Array.isArray(fallback.data)
          ? fallback.data
          : [];
        return list.filter((f: any) => !f.propertyId || f.propertyId === selectedPropertyId);
      }
    },
    enabled: Boolean(selectedPropertyId),
  });

  const dbFloors = useMemo(() => (Array.isArray(rawFloors) ? rawFloors : []), [rawFloors]);

  // Form state
  const [defaultSsid, setDefaultSsid] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [networks, setNetworks] = useState<WifiNetworkConfig[]>([]);
  const [customFloorInput, setCustomFloorInput] = useState<Record<string, string>>({});
  const [customRoomInput, setCustomRoomInput] = useState<Record<string, string>>({});

  // Touched state for onBlur validation
  const [touchedDefaultSsid, setTouchedDefaultSsid] = useState(false);
  const [touchedDefaultPassword, setTouchedDefaultPassword] = useState(false);
  const [touchedNetworks, setTouchedNetworks] = useState<Record<string, { ssid?: boolean; password?: boolean; coverage?: boolean }>>({});

  useEffect(() => {
    if (propertyDetail) {
      setDefaultSsid(propertyDetail.wifiSsid || '');
      setDefaultPassword(propertyDetail.wifiPassword || '');
      if (propertyDetail.wifiNetworksJson) {
        try {
          const parsed = JSON.parse(propertyDetail.wifiNetworksJson);
          if (Array.isArray(parsed)) {
            setNetworks(parsed);
          } else {
            setNetworks([]);
          }
        } catch {
          setNetworks([]);
        }
      } else {
        setNetworks([]);
      }
      setTouchedDefaultSsid(false);
      setTouchedDefaultPassword(false);
      setTouchedNetworks({});
    }
  }, [propertyDetail]);

  // Building List
  const availableBuildingOptions = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    dbBuildings.forEach((b: any) => {
      if (b.name) list.push({ id: b.id, name: b.name });
    });
    if (list.length === 0) {
      list.push({ id: 'bld-a', name: 'Tower A' });
      list.push({ id: 'bld-b', name: 'Tower B' });
    }
    return list;
  }, [dbBuildings]);

  // Floor options grouped by building
  const floorsByBuilding = useMemo(() => {
    const map: Record<string, string[]> = {};
    dbFloors.forEach((f: any) => {
      const bName = f.buildingName || 'General Building';
      const fName = f.name || `Floor ${f.number || f.floorNumber}`;
      if (!map[bName]) map[bName] = [];
      if (!map[bName].includes(fName)) map[bName].push(fName);
    });
    // Fallback if no floors in DB
    availableBuildingOptions.forEach((b) => {
      if (!map[b.name] || map[b.name].length === 0) {
        map[b.name] = ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor'];
      }
    });
    return map;
  }, [dbFloors, availableBuildingOptions]);

  // Validation Rules
  const defaultSsidError = useMemo(() => {
    if (!defaultSsid.trim() && networks.length === 0) return 'Primary Wi-Fi Name (SSID) is required';
    return '';
  }, [defaultSsid, networks]);

  const defaultPasswordError = useMemo(() => {
    if (!defaultPassword.trim() && networks.length === 0) return 'Primary Wi-Fi Password is required';
    if (defaultPassword.trim() && defaultPassword.trim().length < 8) return 'Password must be at least 8 characters long';
    return '';
  }, [defaultPassword, networks]);

  const networkErrors = useMemo(() => {
    const errors: Record<string, { ssid?: string; password?: string; coverage?: string }> = {};
    networks.forEach((net) => {
      const err: { ssid?: string; password?: string; coverage?: string } = {};
      if (!net.ssid.trim()) {
        err.ssid = 'Router SSID name is required';
      }
      if (!net.password.trim()) {
        err.password = 'Wi-Fi Password is required';
      } else if (net.password.trim().length < 8) {
        err.password = 'Must be at least 8 characters';
      }
      if (net.coverageType === 'BUILDINGS' && (!net.coveredBuildingNames || net.coveredBuildingNames.length === 0)) {
        err.coverage = 'Select at least one covered building';
      }
      if (net.coverageType === 'FLOORS' && (!net.coveredFloorNames || net.coveredFloorNames.length === 0)) {
        err.coverage = 'Select at least one covered floor';
      }
      if (net.coverageType === 'ROOMS' && (!net.coveredRoomNumbers || net.coveredRoomNumbers.length === 0)) {
        err.coverage = 'Add at least one covered room or range';
      }
      if (Object.keys(err).length > 0) {
        errors[net.id] = err;
      }
    });
    return errors;
  }, [networks]);

  const isFormValid = useMemo(() => {
    if (defaultSsidError || defaultPasswordError) return false;
    if (Object.keys(networkErrors).length > 0) return false;
    return true;
  }, [defaultSsidError, defaultPasswordError, networkErrors]);

  const addNetwork = () => {
    const newId = `router-${Date.now()}`;
    const defaultBld = availableBuildingOptions[0]?.name || 'Tower A';
    const defaultFloor = floorsByBuilding[defaultBld]?.[0] || '1st Floor';
    setNetworks((prev) => [
      ...prev,
      {
        id: newId,
        ssid: '',
        password: '',
        targetBuildingName: defaultBld,
        coverageType: 'FLOORS',
        coveredBuildingNames: [defaultBld],
        coveredFloorNames: [defaultFloor],
        coveredRoomNumbers: [],
        frequency: 'Dual-Band',
        notes: '',
      },
    ]);
  };

  const removeNetwork = (id: string) => {
    setNetworks((prev) => prev.filter((n) => n.id !== id));
    const nextTouched = { ...touchedNetworks };
    delete nextTouched[id];
    setTouchedNetworks(nextTouched);
  };

  const updateNetworkField = (id: string, field: keyof WifiNetworkConfig, value: any) => {
    setNetworks((prev) => prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)));
  };

  const updateNetworkFields = (id: string, updates: Partial<WifiNetworkConfig>) => {
    setNetworks((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  };

  const toggleFloorForNetwork = (id: string, floorName: string) => {
    setNetworks((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const current = n.coveredFloorNames || [];
        const updated = current.includes(floorName)
          ? current.filter((f) => f !== floorName)
          : [...current, floorName];
        return { ...n, coveredFloorNames: updated };
      })
    );
  };

  const toggleBuildingForNetwork = (id: string, buildingName: string) => {
    setNetworks((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const current = n.coveredBuildingNames || [];
        const updated = current.includes(buildingName)
          ? current.filter((b) => b !== buildingName)
          : [...current, buildingName];
        return { ...n, coveredBuildingNames: updated };
      })
    );
  };

  const addRoomToNetwork = (id: string) => {
    const inputVal = customRoomInput[id]?.trim();
    if (!inputVal) return;
    setNetworks((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const current = n.coveredRoomNumbers || [];
        if (current.includes(inputVal)) return n;
        return { ...n, coveredRoomNumbers: [...current, inputVal] };
      })
    );
    setCustomRoomInput({ ...customRoomInput, [id]: '' });
  };

  const removeRoomFromNetwork = (id: string, roomNum: string) => {
    setNetworks((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        return { ...n, coveredRoomNumbers: (n.coveredRoomNumbers || []).filter((r) => r !== roomNum) };
      })
    );
  };

  const addCustomFloorToNetwork = (id: string) => {
    const inputVal = customFloorInput[id]?.trim();
    if (!inputVal) return;
    toggleFloorForNetwork(id, inputVal);
    setCustomFloorInput({ ...customFloorInput, [id]: '' });
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        wifiSsid: defaultSsid.trim() || undefined,
        wifiPassword: defaultPassword.trim() || undefined,
        wifiNetworksJson: JSON.stringify(networks),
      };
      const res = await api.put(`/properties/${selectedPropertyId}/wifi-networks`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Wi-Fi Networks & Router Configuration Saved Successfully!');
      queryClient.invalidateQueries({ queryKey: ['property-detail', selectedPropertyId] });
      queryClient.invalidateQueries({ queryKey: ['tenant-overview'] });
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save Wi-Fi configuration');
    },
  });

  const selectedPropertyObj = properties.find((p: any) => p?.id === selectedPropertyId);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="border-indigo-100 dark:border-indigo-950/60 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                <Wifi className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Centralized Wi-Fi Management Hub</CardTitle>
                <CardDescription className="text-xs">
                  Manage Wi-Fi for multi-building properties, specific towers/blocks, floors, or room clusters.
                </CardDescription>
              </div>
            </div>

            {/* Multi-Property Switcher */}
            {properties.length > 1 && (
              <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Active Property:</Label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger className="w-[220px] h-8 text-xs font-bold bg-background">
                    <SelectValue placeholder="Select Property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {propertyLoading ? (
            <div className="py-8 flex items-center justify-center text-xs text-muted-foreground gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading property Wi-Fi configuration...
            </div>
          ) : (
            <>
              {/* Preset 1: Primary Campus / Whole Building Wi-Fi */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Router className="h-4 w-4 text-indigo-500" />
                    <h4 className="text-sm font-bold">Primary Campus Default Wi-Fi</h4>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-semibold bg-indigo-50/80 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                    {selectedPropertyObj?.name ? `${selectedPropertyObj.name} Default` : 'Whole Property Fallback'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="defaultSsid" className="text-xs font-semibold">
                      Campus Wi-Fi Name (SSID) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="defaultSsid"
                      value={defaultSsid}
                      onChange={(e) => setDefaultSsid(e.target.value)}
                      onBlur={() => setTouchedDefaultSsid(true)}
                      placeholder="e.g. StayEaze_Campus_HighSpeed"
                      className={`h-9 text-xs ${touchedDefaultSsid && defaultSsidError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {touchedDefaultSsid && defaultSsidError && (
                      <p className="text-[11px] text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {defaultSsidError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="defaultPassword" className="text-xs font-semibold">
                      Wi-Fi Password (Min 8 characters) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="defaultPassword"
                      value={defaultPassword}
                      onChange={(e) => setDefaultPassword(e.target.value)}
                      onBlur={() => setTouchedDefaultPassword(true)}
                      placeholder="e.g. StayEaze@2026"
                      className={`h-9 text-xs ${touchedDefaultPassword && defaultPasswordError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {touchedDefaultPassword && defaultPasswordError && (
                      <p className="text-[11px] text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {defaultPasswordError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Preset 2: Multi-Building & Multi-Floor / Room Zone Routers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <Layers className="h-4 w-4 text-cyan-500" /> Building, Floor & Room Specific Routers
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Add routers covering specific buildings (e.g. Tower A), specific floors, or room clusters.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNetwork}
                    className="h-8 text-xs font-semibold border-dashed gap-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Router
                  </Button>
                </div>

                {networks.length === 0 ? (
                  <div className="py-6 border border-dashed rounded-xl text-center space-y-2 text-muted-foreground">
                    <Wifi className="h-7 w-7 mx-auto opacity-40" />
                    <p className="text-xs">No building or floor routers configured. All tenants in this property will connect to the Primary Campus Wi-Fi above.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {networks.map((net, index) => {
                      const netError = networkErrors[net.id] || {};
                      const netTouched = touchedNetworks[net.id] || {};
                      const currentSelectedBuilding = net.targetBuildingName || availableBuildingOptions[0]?.name || 'Tower A';
                      const buildingFloors = floorsByBuilding[currentSelectedBuilding] || ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor'];

                      return (
                        <div
                          key={net.id}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-card space-y-4 shadow-2xs relative"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-indigo-600 dark:text-cyan-400 flex items-center gap-1.5">
                                <Router className="h-3.5 w-3.5" /> Router #{index + 1}
                              </span>
                              {net.coverageType === 'BUILDINGS' && (
                                <Badge variant="secondary" className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                  🏢 Whole Building Coverage
                                </Badge>
                              )}
                              {net.coverageType === 'FLOORS' && (
                                <Badge variant="secondary" className="text-[10px] bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300">
                                  📶 Floor-Wise ({currentSelectedBuilding})
                                </Badge>
                              )}
                              {net.coverageType === 'ROOMS' && (
                                <Badge variant="secondary" className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                  🚪 Room-Wise
                                </Badge>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeNetwork(net.id)}
                              className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">
                                SSID Name <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                value={net.ssid}
                                onChange={(e) => updateNetworkField(net.id, 'ssid', e.target.value)}
                                onBlur={() =>
                                  setTouchedNetworks({
                                    ...touchedNetworks,
                                    [net.id]: { ...netTouched, ssid: true },
                                  })
                                }
                                placeholder="e.g. TowerB_Floor2_5GHz"
                                className={`h-8 text-xs ${netTouched.ssid && netError.ssid ? 'border-red-500' : ''}`}
                              />
                              {netTouched.ssid && netError.ssid && (
                                <p className="text-[10px] text-red-500">{netError.ssid}</p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">
                                Password <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                value={net.password}
                                onChange={(e) => updateNetworkField(net.id, 'password', e.target.value)}
                                onBlur={() =>
                                  setTouchedNetworks({
                                    ...touchedNetworks,
                                    [net.id]: { ...netTouched, password: true },
                                  })
                                }
                                placeholder="Min 8 characters"
                                className={`h-8 text-xs ${netTouched.password && netError.password ? 'border-red-500' : ''}`}
                              />
                              {netTouched.password && netError.password && (
                                <p className="text-[10px] text-red-500">{netError.password}</p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Coverage Level</Label>
                              <Select
                                value={net.coverageType || 'FLOORS'}
                                onValueChange={(val: any) => updateNetworkField(net.id, 'coverageType', val)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="FLOORS" className="text-xs">Floor-Wise (Specific Floors in Building)</SelectItem>
                                  <SelectItem value="BUILDINGS" className="text-xs">Building-Wise (Entire Block/Tower)</SelectItem>
                                  <SelectItem value="ROOMS" className="text-xs">Room-Wise (Specific Rooms / Wings)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Band / Frequency</Label>
                              <Select
                                value={net.frequency || 'Dual-Band'}
                                onValueChange={(val) => updateNetworkField(net.id, 'frequency', val)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Dual-Band" className="text-xs">Dual-Band (2.4G & 5G)</SelectItem>
                                  <SelectItem value="5GHz" className="text-xs">5GHz (High Speed)</SelectItem>
                                  <SelectItem value="2.4GHz" className="text-xs">2.4GHz (Long Range)</SelectItem>
                                  <SelectItem value="Mesh AP" className="text-xs">Mesh Access Point</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* CASE 1: Building-Wise Coverage */}
                          {net.coverageType === 'BUILDINGS' && (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                                  Select Buildings / Towers Covered by this Router:
                                </Label>
                                {netTouched.coverage && netError.coverage && (
                                  <span className="text-[10px] text-red-500 font-medium">{netError.coverage}</span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {availableBuildingOptions.map((b) => {
                                  const isSelected = net.coveredBuildingNames?.includes(b.name);
                                  return (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => {
                                        toggleBuildingForNetwork(net.id, b.name);
                                        setTouchedNetworks({
                                          ...touchedNetworks,
                                          [net.id]: { ...netTouched, coverage: true },
                                        });
                                      }}
                                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                                          : 'bg-muted/60 text-muted-foreground hover:bg-muted border-slate-200 dark:border-slate-800'
                                      }`}
                                    >
                                      {isSelected ? '✓ ' : '+ '}
                                      {b.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* CASE 2: Floor-Wise Coverage with Building Selector */}
                          {net.coverageType === 'FLOORS' && (
                            <div className="space-y-3 pt-1">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                                  <Label className="text-xs font-semibold">Target Building for this Router:</Label>
                                </div>
                                <Select
                                  value={currentSelectedBuilding}
                                  onValueChange={(bName) => {
                                    const bFloors = floorsByBuilding[bName] || [];
                                    updateNetworkFields(net.id, {
                                      targetBuildingName: bName,
                                      coveredBuildingNames: [bName],
                                      coveredFloorNames: bFloors.length > 0 ? [bFloors[0]] : ['1st Floor'],
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-[200px] text-xs font-semibold bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableBuildingOptions.map((b) => (
                                      <SelectItem key={b.id} value={b.name} className="text-xs">
                                        {b.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                                    <Layers className="h-3.5 w-3.5 text-cyan-500" />
                                    Floors in <span className="text-indigo-600 dark:text-cyan-400 font-bold">{currentSelectedBuilding}</span> covered by this Router:
                                  </Label>
                                  {netTouched.coverage && netError.coverage && (
                                    <span className="text-[10px] text-red-500 font-medium">{netError.coverage}</span>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {buildingFloors.map((fName) => {
                                    const isSelected = net.coveredFloorNames?.includes(fName);
                                    return (
                                      <button
                                        key={fName}
                                        type="button"
                                        onClick={() => {
                                          toggleFloorForNetwork(net.id, fName);
                                          setTouchedNetworks({
                                            ...touchedNetworks,
                                            [net.id]: { ...netTouched, coverage: true },
                                          });
                                        }}
                                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                                          isSelected
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                                            : 'bg-muted/60 text-muted-foreground hover:bg-muted border-slate-200 dark:border-slate-800'
                                        }`}
                                      >
                                        {isSelected ? '✓ ' : '+ '}
                                        {fName}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <Input
                                    placeholder={`Add floor to ${currentSelectedBuilding} (e.g. 4th Floor)`}
                                    value={customFloorInput[net.id] || ''}
                                    onChange={(e) =>
                                      setCustomFloorInput({ ...customFloorInput, [net.id]: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addCustomFloorToNetwork(net.id);
                                      }
                                    }}
                                    className="h-7 text-xs max-w-xs"
                                  />
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => addCustomFloorToNetwork(net.id)}
                                    disabled={!customFloorInput[net.id]?.trim()}
                                    className="h-7 px-2.5 text-xs font-semibold"
                                  >
                                    <Tag className="h-3 w-3 mr-1" /> Add Floor
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* CASE 3: Room-Wise Coverage */}
                          {net.coverageType === 'ROOMS' && (
                            <div className="space-y-3 pt-1">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                                  <Label className="text-xs font-semibold">Target Building for these Rooms:</Label>
                                </div>
                                <Select
                                  value={currentSelectedBuilding}
                                  onValueChange={(bName) => {
                                    updateNetworkFields(net.id, {
                                      targetBuildingName: bName,
                                      coveredBuildingNames: [bName],
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-[200px] text-xs font-semibold bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableBuildingOptions.map((b) => (
                                      <SelectItem key={b.id} value={b.name} className="text-xs">
                                        {b.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                                    <DoorOpen className="h-3.5 w-3.5 text-emerald-500" />
                                    Covered Rooms in <span className="text-indigo-600 dark:text-cyan-400 font-bold">{currentSelectedBuilding}</span>:
                                  </Label>
                                  {netTouched.coverage && netError.coverage && (
                                    <span className="text-[10px] text-red-500 font-medium">{netError.coverage}</span>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {(net.coveredRoomNumbers || []).map((rm) => (
                                    <Badge
                                      key={rm}
                                      variant="outline"
                                      className="text-xs gap-1 font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                                    >
                                      Room {rm}
                                      <button
                                        type="button"
                                        onClick={() => removeRoomFromNetwork(net.id, rm)}
                                        className="hover:text-red-500 ml-1"
                                      >
                                        ×
                                      </button>
                                    </Badge>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <Input
                                    placeholder={`Type room number in ${currentSelectedBuilding} (e.g. 101, 102)`}
                                    value={customRoomInput[net.id] || ''}
                                    onChange={(e) =>
                                      setCustomRoomInput({ ...customRoomInput, [net.id]: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addRoomToNetwork(net.id);
                                      }
                                    }}
                                    className="h-7 text-xs max-w-xs"
                                  />
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => addRoomToNetwork(net.id)}
                                    disabled={!customRoomInput[net.id]?.trim()}
                                    className="h-7 px-2.5 text-xs font-semibold"
                                  >
                                    <Plus className="h-3 w-3 mr-1" /> Add Room
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Changes sync instantly across all matching tenant dashboards.</span>
          </div>

          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!isFormValid || saveMutation.isPending || propertyLoading}
            className="font-bold gap-2 text-xs shadow-xs"
          >
            {saveMutation.isPending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving Wi-Fi Hub...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Save Wi-Fi Configuration
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
