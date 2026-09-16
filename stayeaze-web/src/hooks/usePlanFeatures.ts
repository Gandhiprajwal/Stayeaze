import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface PlanFeatures {
  planKey: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  planName: string;
  isStarter: boolean;
  isGrowth: boolean;
  isEnterprise: boolean;
  isLoading: boolean;
  
  // Feature Booleans
  allowsWhatsAppAutomations: boolean;
  allowsBulkRentRun: boolean;
  allowsTaxReports: boolean;
  allowsDigitalAgreements: boolean;
  allowsSubMeterEngine: boolean;
  allowsCustomBranding: boolean;
  allowsFullAuditLogs: boolean;
  allowsDataBackups: boolean;

  // Numerical Quotas
  maxProperties: number;
  maxBeds: number;
  maxStaffUsers: number;
  currentProperties?: number;
  currentBeds?: number;
  currentStaffUsers?: number;

  // Quota Helper Functions
  canAddProperty: (currentCount?: number) => boolean;
  canAddBeds: (additionalBeds?: number, currentCount?: number) => boolean;
  canAddStaff: (currentCount?: number) => boolean;
}

export function usePlanFeatures(): PlanFeatures {
  const { data: subDetails, isLoading } = useQuery({
    queryKey: ['my-subscription-details'],
    queryFn: () => api.get('/subscription/my-subscription').then((r) => r.data),
    staleTime: 60000,
  });

  const rawPlanName: string = subDetails?.planName || 'Starter PG Plan';
  const nameLower = rawPlanName.toLowerCase();

  let planKey: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' = 'STARTER';
  if (subDetails?.planKey) {
    const pk = subDetails.planKey.toUpperCase();
    if (pk.includes('ENTERPRISE')) planKey = 'ENTERPRISE';
    else if (pk.includes('PRO') || pk.includes('GROWTH')) planKey = 'PROFESSIONAL';
    else planKey = 'STARTER';
  } else {
    if (nameLower.includes('enterprise')) planKey = 'ENTERPRISE';
    else if (nameLower.includes('pro') || nameLower.includes('growth')) planKey = 'PROFESSIONAL';
    else planKey = 'STARTER';
  }

  const isStarter = planKey === 'STARTER';
  const isGrowth = planKey === 'PROFESSIONAL';
  const isEnterprise = planKey === 'ENTERPRISE';

  const usage = (subDetails as any)?.usage;
  const currentBeds = subDetails?.totalBeds ?? usage?.currentBeds ?? usage?.totalBeds ?? 0;
  const currentProperties = subDetails?.totalProperties ?? usage?.totalProperties ?? 1;
  const currentStaffUsers = subDetails?.totalStaff ?? usage?.totalStaff ?? 1;

  const maxProperties = subDetails?.maxProperties ?? (isEnterprise ? 10 : isGrowth ? 2 : 1);
  const maxBeds = subDetails?.maxBeds ?? (isEnterprise ? 500 : isGrowth ? 120 : 35);
  const maxStaffUsers = subDetails?.maxStaffUsers ?? (isEnterprise ? 25 : isGrowth ? 6 : 2);

  return {
    planKey,
    planName: rawPlanName,
    isStarter,
    isGrowth,
    isEnterprise,
    isLoading,

    allowsWhatsAppAutomations: !isStarter,
    allowsBulkRentRun: !isStarter,
    allowsTaxReports: !isStarter,
    allowsDigitalAgreements: !isStarter,
    allowsSubMeterEngine: !isStarter,
    allowsCustomBranding: isEnterprise,
    allowsFullAuditLogs: isEnterprise,
    allowsDataBackups: isEnterprise,

    maxProperties,
    maxBeds,
    maxStaffUsers,
    currentProperties,
    currentBeds,
    currentStaffUsers,

    canAddProperty: (currentCount = currentProperties) => currentCount < maxProperties,
    canAddBeds: (additionalBeds = 1, currentCount = currentBeds) => (currentCount + additionalBeds) <= maxBeds,
    canAddStaff: (currentCount = currentStaffUsers) => currentCount < maxStaffUsers,
  };
}
