import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  BedDouble,
  Search,
  Filter,
  DollarSign,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import api from '@/lib/api';

interface OccupantInfo {
  name: string;
  gender: string;
  bedNumber: string;
  checkInDate: string;
}

interface MatchResult {
  bedId: string;
  bedNumber: string;
  roomId: string;
  roomNumber: string;
  sharingType: string;
  baseRent: number;
  amenities: string[];
  floorNumber: number;
  floorName: string;
  buildingName: string;
  totalBeds: number;
  availableBedsCount: number;
  currentOccupants: OccupantInfo[];
}

interface SmartSpaceMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  onSelectBed?: (match: MatchResult) => void;
}

export const SmartSpaceMatcherModal: React.FC<SmartSpaceMatcherModalProps> = ({
  isOpen,
  onClose,
  propertyId,
  onSelectBed
}) => {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [sharingType, setSharingType] = useState<string>('');
  const [maxBudget, setMaxBudget] = useState<number | ''>('');
  const [selectedAmenity, setSelectedAmenity] = useState<string>('');
  const [floorNumber, setFloorNumber] = useState<number | ''>('');

  useEffect(() => {
    if (isOpen && propertyId) {
      fetchMatches();
    }
  }, [isOpen, propertyId, sharingType, maxBudget, selectedAmenity, floorNumber]);

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/properties/${propertyId}/smart-space-matcher`, {
        params: {
          sharingType: sharingType || undefined,
          maxBudget: maxBudget || undefined,
          amenity: selectedAmenity || undefined,
          floorNumber: floorNumber || undefined
        }
      });
      setMatches(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to find matching spaces');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white flex justify-between items-center border-b border-indigo-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 border border-white/20 flex items-center justify-center text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Smart Bed Finder & Allocation Matcher</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-semibold">
                  Instant Availability & Roommate Filter
                </span>
              </div>
              <p className="text-xs text-indigo-100">
                Filter by sharing type, budget, amenities, and view current roommates in 1 click.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          {/* Sharing Type */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Sharing Type</label>
            <select
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
              value={sharingType}
              onChange={(e) => setSharingType(e.target.value)}
            >
              <option value="">All Sharing Types</option>
              <option value="SINGLE">Single Occupancy</option>
              <option value="DOUBLE">Double Sharing</option>
              <option value="TRIPLE">Triple Sharing</option>
              <option value="FOUR_SHARING">4-Sharing</option>
            </select>
          </div>

          {/* Max Budget */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Max Budget (₹/mo)</label>
            <input
              type="number"
              placeholder="e.g. 10000"
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value ? Number(e.target.value) : '')}
            />
          </div>

          {/* Amenity Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Amenity</label>
            <select
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
              value={selectedAmenity}
              onChange={(e) => setSelectedAmenity(e.target.value)}
            >
              <option value="">Any Amenity</option>
              <option value="AC">Air Conditioner (AC)</option>
              <option value="Attached Washroom">Attached Washroom</option>
              <option value="Balcony">Balcony</option>
              <option value="Geyser">Geyser</option>
              <option value="WiFi">High-Speed WiFi</option>
            </select>
          </div>

          {/* Floor Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Floor</label>
            <select
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
              value={floorNumber}
              onChange={(e) => setFloorNumber(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All Floors</option>
              <option value="1">1st Floor</option>
              <option value="2">2nd Floor</option>
              <option value="3">3rd Floor</option>
              <option value="4">4th Floor</option>
            </select>
          </div>
        </div>

        {/* Results List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-100/50">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-600" />
              Finding best matching spaces...
            </div>
          ) : matches.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <BedDouble className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <div className="font-semibold text-slate-600">No matching spaces found</div>
              <p className="text-xs text-slate-400 mt-1">Try broadening your budget or sharing criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map((item) => (
                <div
                  key={item.bedId}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-black text-sm">
                          {item.roomNumber}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            Bed {item.bedNumber} <span className="text-xs font-normal text-slate-500">({item.sharingType})</span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5">
                            <span>{item.buildingName}</span> • <span>{item.floorName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-black text-indigo-600 font-mono">
                          ₹{item.baseRent}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">per month</div>
                      </div>
                    </div>

                    {/* Amenities Badges */}
                    {item.amenities && item.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.amenities.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Current Roommates Profile Card */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Users className="h-3 w-3 text-slate-400" />
                        Current Roommates ({item.currentOccupants.length}/{item.totalBeds}):
                      </div>

                      {item.currentOccupants.length === 0 ? (
                        <div className="text-emerald-700 font-semibold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Entire Room Currently Vacant!
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {item.currentOccupants.map((occ, i) => (
                            <div key={i} className="flex justify-between items-center text-[11px] text-slate-700">
                              <span className="font-semibold text-slate-800">
                                • {occ.name} <span className="text-[10px] text-slate-400">({occ.gender || 'Tenant'})</span>
                              </span>
                              <span className="text-slate-500 font-mono">Bed {occ.bedNumber}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Select Action */}
                  <button
                    onClick={() => {
                      if (onSelectBed) onSelectBed(item);
                      onClose();
                    }}
                    className="w-full mt-4 py-2 px-3 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all border border-indigo-200 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Allocate Bed {item.bedNumber} in Room {item.roomNumber}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span>Found {matches.length} matching beds available for occupancy</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartSpaceMatcherModal;
