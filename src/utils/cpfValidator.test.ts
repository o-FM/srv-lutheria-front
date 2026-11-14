import { describe, expect, it } from 'vitest';
import { cleanCpf, formatCpf, isValidCpf, maskCpf } from './cpfValidator';

describe('isValidCpf', () => {
  it('aceita CPFs com dígitos verificadores corretos, com ou sem máscara', () => {
    expect(isValidCpf('12345678909')).toBe(true);
    expect(isValidCpf('123.456.789-09')).toBe(true);
  });

  it('rejeita dígitos verificadores errados', () => {
    expect(isValidCpf('12345678900')).toBe(false);
  });

  it('rejeita sequências repetidas e tamanhos errados', () => {
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('1234567890')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });
});

describe('formatCpf', () => {
  it('formata progressivamente conforme a digitação', () => {
    expect(formatCpf('123')).toBe('123');
    expect(formatCpf('1234')).toBe('123.4');
    expect(formatCpf('1234567')).toBe('123.456.7');
    expect(formatCpf('12345678909')).toBe('123.456.789-09');
  });

  it('ignora dígitos além de 11', () => {
    expect(formatCpf('123456789091234')).toBe('123.456.789-09');
  });
});

describe('maskCpf', () => {
  it('esconde os três primeiros e os dois últimos dígitos', () => {
    expect(maskCpf('321.654.987-91')).toBe('***.654.987-**');
  });

  it('devolve máscara cega para CPF incompleto', () => {
    expect(maskCpf('123')).toBe('***.***.***-**');
  });
});

describe('cleanCpf', () => {
  it('remove tudo que não for dígito', () => {
    expect(cleanCpf('123.456.789-09')).toBe('12345678909');
  });
});
