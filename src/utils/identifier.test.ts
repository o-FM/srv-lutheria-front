import { describe, expect, it } from 'vitest';
import { formatIdentifierInput, isEmailIdentifier } from './identifier';

describe('formatIdentifierInput', () => {
  it('mantém texto com letras mesmo antes do "@"', () => {
    expect(formatIdentifierInput('lucas2')).toBe('lucas2');
    expect(formatIdentifierInput('lucas2@x.com')).toBe('lucas2@x.com');
  });

  it('aplica a máscara de CPF quando só há dígitos', () => {
    expect(formatIdentifierInput('12345678909')).toBe('123.456.789-09');
  });

  it('reformata um CPF já mascarado sem perder dígitos', () => {
    expect(formatIdentifierInput('123.456.789-0')).toBe('123.456.789-0');
  });

  it('remove espaços nas pontas de um e-mail', () => {
    expect(formatIdentifierInput(' a@b.com ')).toBe('a@b.com');
  });

  it('devolve vazio para entrada vazia', () => {
    expect(formatIdentifierInput('')).toBe('');
  });
});

describe('isEmailIdentifier', () => {
  it('reconhece e-mail pelo "@"', () => {
    expect(isEmailIdentifier('a@b.com')).toBe(true);
    expect(isEmailIdentifier('123.456.789-09')).toBe(false);
  });
});
