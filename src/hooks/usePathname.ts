import { useEffect, useState } from 'react';

/** Roteamento mínimo por caminho (as poucas rotas públicas não justificam um roteador). */
export function usePathname(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return path;
}
