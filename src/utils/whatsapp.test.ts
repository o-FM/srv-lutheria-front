import { describe, expect, it } from 'vitest';
import { buildWhatsAppUrl } from './whatsapp';

describe('buildWhatsAppUrl', () => {
  it('usa só os dígitos do telefone com o DDI 55', () => {
    expect(buildWhatsAppUrl('(11) 98765-4321')).toBe('https://wa.me/5511987654321');
  });

  it('codifica o texto uma única vez', () => {
    expect(buildWhatsAppUrl('11987654321', 'Olá, OS #1042 & cia')).toBe(
      'https://wa.me/5511987654321?text=Ol%C3%A1%2C%20OS%20%231042%20%26%20cia'
    );
  });

  it('devolve null sem telefone', () => {
    expect(buildWhatsAppUrl('')).toBeNull();
    expect(buildWhatsAppUrl(undefined)).toBeNull();
    expect(buildWhatsAppUrl('sem número')).toBeNull();
  });
});
