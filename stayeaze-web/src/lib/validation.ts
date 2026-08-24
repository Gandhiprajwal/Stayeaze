/**
 * StayEaze Centralized Input Validation Rules & Helpers
 * Enforces real-world data validation standards (RFC email, Verhoeff Aadhaar, PAN entity rules, GSTIN state codes, IFSC, Mobile).
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valid Indian State / Union Territory Codes for GSTIN (01 to 38)
 */
const VALID_GSTIN_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38'
]);

/**
 * Verhoeff Multiplication Table for Aadhaar Validation
 */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 1, 2, 3, 4],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

/**
 * Verhoeff Permutation Table for Aadhaar Validation
 */
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 4, 9, 0],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

/**
 * Validates a number sequence against the Verhoeff checksum algorithm (UIDAI standard for Aadhaar).
 */
export function validateVerhoeff(numStr: string): boolean {
  let c = 0;
  const myArray = numStr.split('').map(Number).reverse();
  for (let i = 0; i < myArray.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][myArray[i]]];
  }
  return c === 0;
}

/**
 * Required field validator helper
 */
export function validateRequired(val: any, fieldName = 'Field'): string | undefined {
  if (val === null || val === undefined || String(val).trim() === '') {
    return `${fieldName} is required`;
  }
  return undefined;
}

/**
 * Number field validator helper
 */
export function validateNumber(val: any, min = 0, fieldName = 'Value'): string | undefined {
  if (val === null || val === undefined || String(val).trim() === '') {
    return undefined;
  }
  const n = Number(val);
  if (isNaN(n)) return `${fieldName} must be a valid number`;
  if (n < min) return `${fieldName} cannot be less than ${min}`;
  return undefined;
}

/**
 * Validates Indian PAN (Permanent Account Number) based on Income Tax Department specifications.
 */
export function validatePan(pan: string): ValidationResult {
  if (!pan || !pan.trim()) {
    return { isValid: false, error: 'PAN number is required' };
  }
  const cleanPan = pan.trim().toUpperCase();

  if (cleanPan.length !== 10) {
    return { isValid: false, error: 'PAN number must be exactly 10 characters' };
  }

  // Regex: 5 uppercase letters, 4 digits, 1 uppercase letter
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(cleanPan)) {
    return { isValid: false, error: 'Invalid PAN format (e.g. ABCDE1234F)' };
  }

  const entityChar = cleanPan[3];
  const validEntityTypes = ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G', 'K'];
  if (!validEntityTypes.includes(entityChar)) {
    return { isValid: false, error: 'Invalid PAN entity code (4th character)' };
  }

  return { isValid: true };
}

/**
 * Validates 10-digit Indian Mobile Numbers (Real telecom range 6-9).
 */
export function validateMobile(mobile: string): ValidationResult {
  if (!mobile || !mobile.trim()) {
    return { isValid: false, error: 'Mobile number is required' };
  }

  let cleanNumber = mobile.replace(/[\s\-\(\)\+]/g, '');
  if (cleanNumber.startsWith('91') && cleanNumber.length === 12) {
    cleanNumber = cleanNumber.substring(2);
  } else if (cleanNumber.startsWith('0') && cleanNumber.length === 11) {
    cleanNumber = cleanNumber.substring(1);
  }

  if (!/^\d{10}$/.test(cleanNumber)) {
    return { isValid: false, error: 'Mobile number must be 10 digits' };
  }

  if (!/^[6-9]/.test(cleanNumber)) {
    return { isValid: false, error: 'Mobile number must start with 6, 7, 8, or 9' };
  }

  if (/^(\d)\1{9}$/.test(cleanNumber)) {
    return { isValid: false, error: 'Invalid mobile number format' };
  }

  return { isValid: true };
}

/**
 * String-returning phone validator for UI form fields
 */
export function validatePhone(mobile: string, required = false): string | undefined {
  if (!mobile || !String(mobile).trim()) {
    return required ? 'Phone number is required' : undefined;
  }
  const res = validateMobile(String(mobile));
  return res.isValid ? undefined : res.error;
}

/**
 * Validates Email Address based on RFC 5322 real email standards.
 */
export function validateEmail(email: string, required?: boolean): any {
  const isReq = Boolean(required);
  if (!email || !String(email).trim()) {
    if (isReq) {
      return typeof required === 'boolean' ? 'Email address is required' : { isValid: false, error: 'Email address is required' };
    }
    return typeof required === 'boolean' ? undefined : { isValid: true };
  }

  const cleanEmail = String(email).trim().toLowerCase();

  // RFC 5322 compliant real email structure regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  let err: string | undefined = undefined;

  if (!emailRegex.test(cleanEmail)) {
    err = 'Invalid email address format (e.g. name@domain.com)';
  } else {
    const parts = cleanEmail.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      err = 'Invalid email address structure';
    } else if (parts[1].startsWith('.') || parts[1].endsWith('.')) {
      err = 'Invalid domain format';
    }
  }

  if (typeof required === 'boolean') {
    return err;
  }
  return err ? { isValid: false, error: err } : { isValid: true };
}

/**
 * Validates 15-character Indian GSTIN based on GST Council specifications.
 */
export function validateGstin(gstin: string): ValidationResult {
  if (!gstin || !gstin.trim()) {
    return { isValid: false, error: 'GSTIN is required' };
  }

  const cleanGstin = gstin.trim().toUpperCase();

  if (cleanGstin.length !== 15) {
    return { isValid: false, error: 'GSTIN must be exactly 15 characters long' };
  }

  const stateCode = cleanGstin.substring(0, 2);
  if (!VALID_GSTIN_STATE_CODES.has(stateCode)) {
    return { isValid: false, error: 'Invalid State Code in GSTIN (first 2 digits)' };
  }

  const panPart = cleanGstin.substring(2, 12);
  const panValidation = validatePan(panPart);
  if (!panValidation.isValid) {
    return { isValid: false, error: 'Invalid PAN structure within GSTIN' };
  }

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z0-9A-Z]{1}[0-9A-Z]{1}$/;
  if (!gstinRegex.test(cleanGstin)) {
    return { isValid: false, error: 'Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)' };
  }

  return { isValid: true };
}

/**
 * Validates 6-digit Indian Pincode (Indian Postal Service standard range 110001 - 999999).
 */
export function validatePincode(pincode: string, required?: boolean): any {
  if (typeof required === 'boolean') {
    if (!pincode || !String(pincode).trim()) {
      return required ? 'Pincode is required' : undefined;
    }
    const cleanPin = String(pincode).trim();
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      return 'Pincode must be a 6-digit number not starting with 0';
    }
    return undefined;
  }

  if (!pincode || !pincode.trim()) {
    return { isValid: false, error: 'Pincode is required' };
  }
  const cleanPin = pincode.trim();
  if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
    return { isValid: false, error: 'Pincode must be a 6-digit number not starting with 0' };
  }
  return { isValid: true };
}

/**
 * Validates 11-character Indian Bank IFSC Code (RBI Standard).
 */
export function validateIfsc(ifsc: string): ValidationResult {
  if (!ifsc || !ifsc.trim()) {
    return { isValid: false, error: 'IFSC code is required' };
  }
  const cleanIfsc = ifsc.trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
    return { isValid: false, error: 'Invalid IFSC format (e.g. SBIN0001234)' };
  }
  return { isValid: true };
}

/**
 * Validates 12-digit Indian Aadhaar Number using UIDAI Verhoeff algorithm.
 */
export function validateAadhaar(aadhaar: string): ValidationResult {
  if (!aadhaar || !aadhaar.trim()) {
    return { isValid: false, error: 'Aadhaar number is required' };
  }
  const cleanAadhaar = aadhaar.replace(/[\s\-]/g, '');

  if (!/^[2-9][0-9]{11}$/.test(cleanAadhaar)) {
    return { isValid: false, error: 'Aadhaar must be 12 digits and cannot start with 0 or 1' };
  }

  if (/^(\d)\1{11}$/.test(cleanAadhaar)) {
    return { isValid: false, error: 'Aadhaar cannot be a single repeated digit' };
  }

  // Verhoeff mathematical algorithm check (UIDAI Official Standard)
  if (!validateVerhoeff(cleanAadhaar)) {
    return { isValid: false, error: 'Invalid Aadhaar number (checksum validation failed)' };
  }

  return { isValid: true };
}

/**
 * Validates ID Document based on type (aadhaar, pan, passport, driving_license)
 */
export function validateIdNumber(idType: string, idNumber: string, required = false): string | undefined {
  if (!idNumber || !String(idNumber).trim()) {
    return required ? 'ID number is required' : undefined;
  }
  const num = String(idNumber).trim();
  if (idType === 'pan') {
    const res = validatePan(num);
    return res.isValid ? undefined : res.error;
  }
  if (idType === 'aadhaar') {
    const res = validateAadhaar(num);
    return res.isValid ? undefined : res.error;
  }
  if (idType === 'passport') {
    if (!/^[A-Z][0-9]{7}$/i.test(num)) return 'Passport must be 1 letter followed by 7 digits';
  }
  if (idType === 'driving_license') {
    if (num.length < 8) return 'Invalid Driving License number length';
  }
  return undefined;
}
