/**
 * Links do WhatsApp. O texto é passado puro e codificado aqui uma única vez.
 * O telefone vai sem o 55 (DDI do Brasil), com ou sem máscara.
 */

/** URL do wa.me, ou `null` quando não há telefone. */
export function buildWhatsAppUrl(phone: string | undefined, text?: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/55${digits}${query}`;
}

/** Abre a conversa em nova aba sem dar acesso ao `window.opener`. `false` se não houver telefone. */
export function openWhatsApp(phone: string | undefined, text?: string): boolean {
  const url = buildWhatsAppUrl(phone, text);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
