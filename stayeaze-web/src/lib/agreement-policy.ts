export const DEFAULT_MASTER_AGREEMENT_TEMPLATE = `STAYEAZE CO-LIVING & PG RESIDENTIAL TENANCY AGREEMENT

1. PREMISES & ALLOCATION:
The Resident is allocated Bed {{bed_number}} in Room {{room_number}} at {{property_name}}, {{building_name}}.

2. FINANCIAL OBLIGATIONS:
- Monthly Rent: {{monthly_rent}} payable in advance on or before the 5th of each calendar month.
- Security Deposit: {{security_deposit}}, refundable upon final clearance at move-out.
- Electricity / Utility Tariff: {{electricity_rate}} based on actual sub-meter unit readings or standard room share basis.

3. LOCK-IN & NOTICE PERIOD:
- Minimum Contractual Lock-In Period: {{lock_in_period}}
- Mandatory Notice Period: {{notice_period}} must be served via the resident app prior to vacating.
- Security deposit refund is subject to room inspection, asset handover checklist, and clearance of all utility dues.

4. HOUSE RULES & CONDUCT:
- Non-resident visitors are permitted strictly during designated visiting hours after gate pass verification.
- Consumption of prohibited substances and excessive noise causing disturbance to co-residents is strictly forbidden.
- Safe custody of personal belongings is the responsibility of the resident.

5. STATUTORY ACKNOWLEDGMENT:
By accepting this agreement, the resident confirms that all submitted KYC identity details are authentic and valid under applicable statutory norms.`;

export function getMasterAgreementTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_MASTER_AGREEMENT_TEMPLATE;
  return localStorage.getItem('stayeaze_master_agreement_template') || DEFAULT_MASTER_AGREEMENT_TEMPLATE;
}

export function setMasterAgreementTemplate(template: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('stayeaze_master_agreement_template', template);
  }
}

export function populateAgreementTemplate(
  template: string,
  tenant: any,
  propertyName?: string,
  buildingName?: string
): string {
  const residentName = tenant?.name || tenant?.firstName || 'Resident';
  const roomNumber = tenant?.roomNumber || '—';
  const bedNumber = tenant?.bedNumber || '—';
  const propName = propertyName || 'StayEaze PG Residency';
  const bldName = buildingName || 'Main Wing';
  const rentFormatted = `₹${Number(tenant?.rent || 0).toLocaleString('en-IN')}`;
  const depositFormatted = `₹${Number(tenant?.securityDeposit || tenant?.deposit || 0).toLocaleString('en-IN')}`;

  const lockInMonths = tenant?.lockInMonths ?? tenant?.minimumLockInMonths ?? 3;
  const lockInText = Number(lockInMonths) > 0 ? `${lockInMonths} Months` : 'No Minimum Lock-In (Monthly Rolling)';
  const noticeDays = tenant?.noticePeriodDays ?? 30;
  const noticeText = `${noticeDays} Days`;
  const elecRate = tenant?.defaultElectricityRatePerUnit ?? tenant?.electricityRate ?? 10.0;
  const elecText = `₹${elecRate}/kWh`;

  return template
    .replace(/\{\{resident_name\}\}/gi, residentName)
    .replace(/\{\{tenant_name\}\}/gi, residentName)
    .replace(/\{\{room_number\}\}/gi, roomNumber)
    .replace(/\{\{bed_number\}\}/gi, bedNumber)
    .replace(/\{\{room_bed\}\}/gi, `Room ${roomNumber} (Bed ${bedNumber})`)
    .replace(/\{\{property_name\}\}/gi, propName)
    .replace(/\{\{building_name\}\}/gi, bldName)
    .replace(/\{\{monthly_rent\}\}/gi, rentFormatted)
    .replace(/\{\{security_deposit\}\}/gi, depositFormatted)
    .replace(/\{\{lock_in_period\}\}/gi, lockInText)
    .replace(/\{\{notice_period\}\}/gi, noticeText)
    .replace(/\{\{electricity_rate\}\}/gi, elecText);
}
