/**
 * CPF utility functions: validation, formatting, and masking (LGPD compliance)
 */

export function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function formatCpf(value: string): string {
  const digits = cleanCpf(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Validates Brazilian CPF check digits
 */
export function isValidCpf(cpf: string): boolean {
  const digits = cleanCpf(cpf);
  if (digits.length !== 11) return false;

  // Reject sequences like 11111111111, 00000000000
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let firstCheck = (sum * 10) % 11;
  if (firstCheck === 10 || firstCheck === 11) firstCheck = 0;
  if (firstCheck !== parseInt(digits[9], 10)) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  let secondCheck = (sum * 10) % 11;
  if (secondCheck === 10 || secondCheck === 11) secondCheck = 0;
  if (secondCheck !== parseInt(digits[10], 10)) return false;

  return true;
}

/**
 * Validates standard email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Masks CPF according to LGPD rules: ***.456.789-**
 */
export function maskCpf(cpf: string): string {
  const digits = cleanCpf(cpf);
  if (digits.length !== 11) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}
