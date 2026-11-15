import { cleanCpf, formatCpf } from './cpfValidator';

/**
 * Formata o campo "E-mail ou CPF" durante a digitação.
 * Só aplica a máscara de CPF quando o texto tem apenas dígitos, pontos, hífens
 * ou espaços; qualquer outro caractere mantém o texto como está (e-mail).
 */
export function formatIdentifierInput(raw: string): string {
  if (/^[\d.\-\s]*$/.test(raw)) {
    const digits = cleanCpf(raw);
    return digits ? formatCpf(digits) : raw;
  }
  return raw.trim();
}

/** Indica se o identificador parece um e-mail (contém "@"). */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@');
}
