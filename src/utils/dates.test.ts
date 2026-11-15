import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, nowTimestamp, todayDate } from './dates';

describe('datas locais', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 22h30 em São Paulo = 01h30 do dia seguinte em UTC
    vi.setSystemTime(new Date(2026, 10, 8, 22, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('todayDate usa o dia local, não o UTC', () => {
    // Em UTC já é dia 9: era o que o app gravava antes.
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-09');
    expect(todayDate()).toBe('2026-11-08');
  });

  it('nowTimestamp segue o formato das seeds', () => {
    expect(nowTimestamp()).toBe('2026-11-08 22:30');
  });

  it('addDays soma dias de calendário, inclusive na virada do mês', () => {
    expect(addDays(5)).toBe('2026-11-13');
    expect(addDays(23)).toBe('2026-12-01');
  });
});
