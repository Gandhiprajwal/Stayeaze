import { formatCurrency, formatDate } from '@/lib/format';

/**
 * Clean phone number to international WhatsApp format (e.g. +91 98765 43210 -> 919876543210)
 */
export function sanitizePhoneForWhatsApp(phone: string): string {
  let cleaned = (phone || '').replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Open WhatsApp Web/App with pre-filled message
 */
export function openWhatsApp(phone: string, text: string) {
  const cleanNumber = sanitizePhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(text);
  const url = cleanNumber
    ? `https://wa.me/${cleanNumber}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
}

/**
 * Generate & open Rent Due Reminder WhatsApp message
 */
export function sendRentDueReminder({
  tenantName,
  tenantMobile,
  propertyName,
  roomNumber,
  bedNumber,
  amountDue,
  dueDate,
  paymentLink,
  upiId,
}: {
  tenantName: string;
  tenantMobile?: string;
  propertyName?: string;
  roomNumber?: string;
  bedNumber?: string;
  amountDue: number;
  dueDate?: string;
  paymentLink?: string;
  upiId?: string;
}) {
  const prop = propertyName ? `*${propertyName}*` : 'StayEaze';
  const spaceInfo = roomNumber ? ` (Room ${roomNumber}${bedNumber ? `, Bed ${bedNumber}` : ''})` : '';
  const dateStr = dueDate ? formatDate(dueDate) : 'Immediately';

  const message = `Hello *${tenantName || 'Tenant'}*,

This is a gentle reminder regarding your monthly rent invoice for ${prop}${spaceInfo}.

📌 *Amount Due:* ${formatCurrency(amountDue)}
📅 *Due Date:* ${dateStr}

${upiId ? `💳 *Pay via UPI:* ${upiId}\n` : ''}${paymentLink ? `🔗 *Online Payment Portal:* ${paymentLink}\n` : ''}
Please share the payment screenshot once paid. Thank you!

— Management, ${prop}`;

  openWhatsApp(tenantMobile || '', message);
}

/**
 * Generate & open Welcome Pack & WiFi Credentials WhatsApp message
 */
export function sendWelcomePack({
  tenantName,
  tenantMobile,
  propertyName,
  roomNumber,
  bedNumber,
  wifiSsid,
  wifiPassword,
  rulesUrl,
}: {
  tenantName: string;
  tenantMobile?: string;
  propertyName?: string;
  roomNumber?: string;
  bedNumber?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  rulesUrl?: string;
}) {
  const prop = propertyName ? `*${propertyName}*` : 'our PG';

  const message = `🎉 *Welcome to ${prop}, ${tenantName || 'Guest'}!*

We are delighted to have you stay with us! Here are your check-in details:

🛏️ *Your Space:* Room ${roomNumber || '—'}, Bed ${bedNumber || '—'}
📶 *Wi-Fi SSID:* ${wifiSsid || 'StayEaze-HighSpeed'}
🔑 *Wi-Fi Password:* ${wifiPassword || 'StayEaze@2026'}

${rulesUrl ? `📜 *House Rules & Notice Period:* ${rulesUrl}\n` : ''}
If you need any support or maintenance assistance, feel free to raise a request via your Tenant Portal. Enjoy your stay!

— Property Manager, ${prop}`;

  openWhatsApp(tenantMobile || '', message);
}

/**
 * Generate & open Payment Receipt WhatsApp message
 */
export function sendPaymentReceipt({
  tenantName,
  tenantMobile,
  propertyName,
  amountPaid,
  paymentMode,
  receiptNumber,
  date,
}: {
  tenantName: string;
  tenantMobile?: string;
  propertyName?: string;
  amountPaid: number;
  paymentMode?: string;
  receiptNumber?: string;
  date?: string;
}) {
  const prop = propertyName ? `*${propertyName}*` : 'StayEaze';

  const message = `🧾 *Payment Receipt — ${prop}*

Dear *${tenantName || 'Tenant'}*,

We have received your payment of *${formatCurrency(amountPaid)}*.

🔖 *Receipt #:* ${receiptNumber || 'REC-' + Date.now().toString().slice(-6)}
💳 *Payment Mode:* ${(paymentMode || 'UPI / Online').toUpperCase()}
📅 *Date:* ${date ? formatDate(date) : formatDate(new Date().toISOString())}

Thank you for paying on time!

— Accounts, ${prop}`;

  openWhatsApp(tenantMobile || '', message);
}
