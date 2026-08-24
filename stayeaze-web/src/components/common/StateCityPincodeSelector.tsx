import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getStatesList,
  getCitiesForState,
  validatePincodeForState,
} from '@/lib/location-data';
import { CheckCircle2, AlertCircle, MapPin, List, Pencil } from 'lucide-react';

interface StateCityPincodeSelectorProps {
  state: string;
  city: string;
  pincode: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  onPincodeChange: (pincode: string) => void;
  disabled?: boolean;
  className?: string;
}

export function StateCityPincodeSelector({
  state,
  city,
  pincode,
  onStateChange,
  onCityChange,
  onPincodeChange,
  disabled = false,
  className = '',
}: StateCityPincodeSelectorProps) {
  const [isCustomCity, setIsCustomCity] = React.useState(false);
  const statesList = useMemo(() => getStatesList(), []);
  const availableCities = useMemo(() => getCitiesForState(state), [state]);

  const pincodeCheck = useMemo(
    () => (pincode ? validatePincodeForState(pincode, state) : null),
    [pincode, state]
  );

  function handleStateSelect(selectedState: string) {
    onStateChange(selectedState);
    const newCities = getCitiesForState(selectedState);
    // Reset city if current city is not in new state
    if (city && !newCities.includes(city)) {
      onCityChange(newCities[0] || '');
    }
  }

  function handleCitySelect(selectedCity: string) {
    if (selectedCity === '__OTHER_CUSTOM_CITY__') {
      setIsCustomCity(true);
      onCityChange('');
    } else {
      setIsCustomCity(false);
      onCityChange(selectedCity);
    }
  }

  function handlePincodeInput(val: string) {
    onPincodeChange(val);
    // If state is not selected yet, auto-suggest state from pincode
    if (!state && val.length >= 2) {
      const res = validatePincodeForState(val);
      if (res.matchedState) {
        onStateChange(res.matchedState);
        const newCities = getCitiesForState(res.matchedState);
        if (newCities.length > 0 && !city) {
          onCityChange(newCities[0]);
        }
      }
    }
  }

  const showDropdown = availableCities.length > 0 && !isCustomCity;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* State Dropdown */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" /> State
          </Label>
          <Select value={state} onValueChange={handleStateSelect} disabled={disabled}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select State" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {statesList.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* City Dropdown or Custom Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-foreground">City</Label>
            {availableCities.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsCustomCity(!isCustomCity);
                  if (isCustomCity && availableCities.length > 0) {
                    onCityChange(availableCities[0]);
                  }
                }}
                className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                {isCustomCity ? (
                  <>
                    <List className="h-3 w-3" /> Select from list
                  </>
                ) : (
                  <>
                    <Pencil className="h-3 w-3" /> Type city manually
                  </>
                )}
              </button>
            )}
          </div>

          {showDropdown ? (
            <Select value={city} onValueChange={handleCitySelect} disabled={disabled || !state}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={state ? 'Select City' : 'Select State First'} />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {availableCities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem
                  value="__OTHER_CUSTOM_CITY__"
                  className="font-semibold text-primary focus:text-primary cursor-pointer border-t mt-1"
                >
                  + Other / Type Custom City...
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder={state ? `Enter city name in ${state}` : 'Enter City'}
              disabled={disabled}
            />
          )}
        </div>

        {/* Pincode Input */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Pincode</Label>
          <Input
            value={pincode}
            onChange={(e) => handlePincodeInput(e.target.value)}
            placeholder="e.g. 560001"
            maxLength={6}
            disabled={disabled}
            className={
              pincodeCheck
                ? pincodeCheck.isValid
                  ? 'border-emerald-500/50 focus-visible:ring-emerald-500'
                  : 'border-destructive focus-visible:ring-destructive'
                : ''
            }
          />
        </div>
      </div>

      {/* Pincode State Verification Feedback */}
      {pincodeCheck && (
        <div
          className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md transition-all ${
            pincodeCheck.isValid
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {pincodeCheck.isValid ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          )}
          <span>{pincodeCheck.message}</span>
        </div>
      )}
    </div>
  );
}
