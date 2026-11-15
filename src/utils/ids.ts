/**
 * Id único com prefixo legível (ex.: `mov-3f2a…`). Substitui `'mov-' + Date.now()`,
 * que repetia ids quando vários registros eram criados no mesmo milissegundo.
 */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
