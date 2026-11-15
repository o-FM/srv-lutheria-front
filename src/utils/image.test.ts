import { describe, expect, it } from 'vitest';
import { fitWithin } from './image';

describe('fitWithin', () => {
  it('reduz a foto paisagem mantendo a proporção', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('reduz a foto retrato pelo lado maior', () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('não amplia imagens menores que o limite', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('devolve zero para dimensões inválidas', () => {
    expect(fitWithin(0, 600, 1600)).toEqual({ width: 0, height: 0 });
  });
});
