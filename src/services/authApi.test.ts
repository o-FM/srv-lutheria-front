import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, authApi, isSessionRejected } from './authApi';

function stubFetchStatus(status: number): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ error: 'x' }), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isSessionRejected', () => {
  it('é verdadeiro só para 401 e 403', () => {
    expect(isSessionRejected(new AuthApiError('x', 401))).toBe(true);
    expect(isSessionRejected(new AuthApiError('x', 403))).toBe(true);
    expect(isSessionRejected(new AuthApiError('x', 500))).toBe(false);
    expect(isSessionRejected(new AuthApiError('x', 404))).toBe(false);
  });

  it('é falso para erro de rede e valores que não são AuthApiError', () => {
    expect(isSessionRejected(new TypeError('Failed to fetch'))).toBe(false);
    expect(isSessionRejected(new Error('x'))).toBe(false);
    expect(isSessionRejected(undefined)).toBe(false);
  });
});

describe('authApi.getMe', () => {
  it('lança AuthApiError com o status quando o servidor recusa o token', async () => {
    stubFetchStatus(401);
    const err = await authApi.getMe('t').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthApiError);
    expect(isSessionRejected(err)).toBe(true);
  });

  it('erro 5xx não conta como sessão recusada', async () => {
    stubFetchStatus(503);
    const err = await authApi.getMe('t').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthApiError);
    expect((err as AuthApiError).status).toBe(503);
    expect(isSessionRejected(err)).toBe(false);
  });

  it('falha de rede não conta como sessão recusada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const err = await authApi.getMe('t').catch((e: unknown) => e);
    expect(isSessionRejected(err)).toBe(false);
  });

  it('devolve o usuário quando a sessão é válida', async () => {
    const user = { id: 'u1', name: 'A', email: 'a@b.c', maskedCpf: '', phone: '', role: 'luthier' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ user }), { status: 200 })),
    );
    await expect(authApi.getMe('t')).resolves.toEqual(user);
  });
});
