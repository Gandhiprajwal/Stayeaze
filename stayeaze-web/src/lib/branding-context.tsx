import React, { createContext, useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from './api';
import { resolveFileUrl } from './format';
import { useAuthStore } from './stores/auth-store';

export interface BrandingConfig {
  enabled: boolean;
  isEnterprise: boolean;
  allowCustomBranding: boolean;
  organizationId?: string;
  organizationName?: string;
  subdomain?: string;
  brandName: string;
  brandLogoUrl?: string | null;
  brandFaviconUrl?: string | null;
  brandPrimaryColor: string;
  brandAccentColor: string;
  brandTagline?: string | null;
  customFooterText?: string | null;
  hideStayEazeBranding: boolean;
  supportEmail?: string | null;
  supportPhone?: string | null;
}

const defaultBranding: BrandingConfig = {
  enabled: false,
  isEnterprise: false,
  allowCustomBranding: false,
  brandName: 'StayEaze',
  brandLogoUrl: null,
  brandFaviconUrl: null,
  brandPrimaryColor: '#4f46e5',
  brandAccentColor: '#06b6d4',
  brandTagline: 'Smart PG & Co-Living Management Platform',
  customFooterText: null,
  hideStayEazeBranding: false,
};

interface BrandingContextType {
  branding: BrandingConfig;
  isLoading: boolean;
  refetchBranding: () => void;
  brandName: string;
  brandLogo: string | null;
  primaryColor: string;
  isWhiteLabeled: boolean;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  isLoading: false,
  refetchBranding: () => {},
  brandName: 'StayEaze',
  brandLogo: null,
  primaryColor: '#4f46e5',
  isWhiteLabeled: false,
});

/**
 * Converts HEX color to space-separated HSL values (e.g. "238 82% 59%") for Tailwind CSS variables.
 */
function hexToHsl(hex: string): string | null {
  if (!hex) return null;
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  if (cleanHex.length !== 6) return null;

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuthStore();

  const { data: brandingData, isLoading, refetch } = useQuery<BrandingConfig>({
    queryKey: ['portal-branding', user?.orgId, token],
    queryFn: () => api.get<BrandingConfig>('/branding/current').then((r) => r.data),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const branding: BrandingConfig = brandingData || defaultBranding;
  const isWhiteLabeled = Boolean(branding.enabled && branding.brandName);
  const brandName = isWhiteLabeled && branding.brandName ? branding.brandName : 'StayEaze';
  const brandLogo = isWhiteLabeled && branding.brandLogoUrl ? resolveFileUrl(branding.brandLogoUrl) : null;
  const primaryColor = isWhiteLabeled && branding.brandPrimaryColor ? branding.brandPrimaryColor : '#4f46e5';

  // Dynamically update document title, favicon, and CSS custom properties
  useEffect(() => {
    // 1. Update Document Title
    if (isWhiteLabeled && brandName) {
      document.title = `${brandName} — Living & Property Management`;
    } else {
      document.title = 'StayEaze — PG & Hostel Management Platform';
    }

    // 2. Update Favicon if custom provided
    if (isWhiteLabeled && branding.brandFaviconUrl) {
      const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = resolveFileUrl(branding.brandFaviconUrl);
      document.getElementsByTagName('head')[0].appendChild(link);
    }

    // 3. Update CSS Variables for Primary Color Theme
    if (isWhiteLabeled && branding.brandPrimaryColor) {
      const hslVal = hexToHsl(branding.brandPrimaryColor);
      if (hslVal) {
        document.documentElement.style.setProperty('--primary', hslVal);
        document.documentElement.style.setProperty('--ring', hslVal);
        document.documentElement.style.setProperty('--chart-1', hslVal);
      }
    } else {
      // Revert to standard StayEaze indigo
      document.documentElement.style.setProperty('--primary', '217 91% 60%');
      document.documentElement.style.setProperty('--ring', '217 91% 60%');
      document.documentElement.style.setProperty('--chart-1', '217 91% 60%');
    }
  }, [isWhiteLabeled, brandName, branding.brandPrimaryColor, branding.brandFaviconUrl]);

  return (
    <BrandingContext.Provider
      value={{
        branding,
        isLoading,
        refetchBranding: refetch,
        brandName,
        brandLogo,
        primaryColor,
        isWhiteLabeled,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
export default BrandingProvider;
