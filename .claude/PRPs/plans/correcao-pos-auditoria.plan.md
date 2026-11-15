# Plano: Correção pós-auditoria (bugs/segurança → design/UX → refatoração/desempenho)

## Resumo
Plano em 3 fases para corrigir os achados dos seis relatórios em `.claude/PRPs/reports/`:
- `react-review.md`
- `code-review.md`
- `codigo-morto.md`
- `seguranca.md`
- `performance.md`
- `design-a11y.md`

**Formato das tarefas:** cada tarefa é pequena (1 a 4 arquivos), lista os arquivos afetados e cita a origem do achado. Todas compartilham o mesmo critério de pronto:

> **Critério de pronto (toda tarefa):** `npm run lint` (= `tsc --noEmit`) **e** `npm run build` passando, mais a checagem manual indicada na tarefa.

**Siglas de origem:** RR = react-review, CR = code-review, SEG = seguranca, PERF = performance, design = design-a11y.

## User Story
Como luthier ou atendente que usa o app no celular da oficina, quero que ele não quebre, proteja os dados dos clientes, seja fácil de tocar e ler, e continue rápido conforme os dados crescem. Assim abro e acompanho OS sem perder trabalho.

## Problema → Solução
- **Hoje:**
  - O app quebra ao abrir o Modo Bancada.
  - O estoque é descontado em dobro.
  - Uma foto pode deixar a tela branca.
  - O CPF aparece completo e as permissões existem só na interface.
  - O servidor de demonstração fica exposto na rede.
  - CTAs têm contraste abaixo de 4,5:1 e alvos de toque de 28-40px.
  - Há um contexto monolítico de 938 linhas.
- **Depois:**
  - Fluxos estáveis, com regras de domínio centralizadas.
  - Dados protegidos e servidor mock endurecido.
  - Componentes de interface compartilhados e acessíveis (alvos ≥ 48/64px, contraste AA).
  - Contexto dividido, código morto removido, testes cobrindo as regras de domínio.

## Metadados
- **Complexidade:** XL. São três fases independentes, e cada uma pode virar um PR.
- **PRD de origem:** N/A (os relatórios em `.claude/PRPs/reports/` fazem esse papel).
- **Arquivos estimados:** ~45 alterados e ~15 criados.
- **Estado inicial verificado em 2026-11-08:**
  - `npx tsc --noEmit` passa sem erros.
  - `vite build` passa em 0,9 s: JS 121,7 kB gz, CSS 10,6 kB gz.
  - `git status` está limpo, exceto `.claude/PRPs/`.

### Como usar
- Execute **uma fase por branch/PR**, na ordem 1 → 2 → 3.
- Dentro de cada fase, siga a ordem das tarefas: as dependências estão indicadas em **DEPENDE**.
- Faça um commit por tarefa (`fix:`, `feat:`, `refactor:`, `perf:`), seguindo `.claude/rules/ecc/common/git-workflow.md`.
- A tarefa 3.1 (Vitest) pode ser **antecipada** para o início da Fase 1. Isso é recomendado, porque permite escrever os testes das regras de domínio (1.7-1.9) antes de mexer nelas.

---

## UX Design

### Antes
```
┌ Header (alvos 28px, menu de persona até para cliente) ┐
│ Cartão OS: [Ver Detalhes 28px][WA 28px][Avançar 28px] │ ← toque errado avança status
│ CTA branco sobre âmbar (3,19:1)                       │
│ Modo Bancada → tela branca (crash)                    │
│ Salvar dados sensíveis → reauth escondido atrás       │
│ Foto 12 MP → localStorage cheio → tela branca         │
└ Tab bar 64px (único elemento ok)                      ┘
```

### Depois
```
┌ Header (alvos 48px, persona só em DEV/equipe)         ┐
│ Cartão OS: [Detalhes 48][WhatsApp 48]   [Avançar 48]  │ ← espaçado, confirmação
│ CTA texto escuro sobre âmbar (6,19:1)                 │
│ Modo Bancada abre; alvos 64px; ações fixas no rodapé  │
│ Reauth em <dialog> (top layer), Escape, foco          │
│ Foto reduzida (~1600px) e erro de cota tratado        │
└ Tab bar 64px com aria-current                         ┘
```

### Mudanças de interação
| Ponto de contato | Antes | Depois | Tarefa |
|---|---|---|---|
| Abrir Modo Bancada | crash | abre | 1.1 |
| Avançar status / stepper | qualquer salto, sem confirmação | só transições válidas; confirmação ao voltar ou pular | 1.7, 2.8 |
| Aprovar orçamento | qualquer status e papel, 1 toque | só em `aguardando_aprovacao`, papel permitido, confirmação | 1.8, 2.15 |
| Campo e-mail/CPF | teclado numérico | teclado de texto; máscara só com dígitos | 1.3 |
| Foto | base64 em resolução cheia | reduzida; categoria respeitada | 1.6, 1.17 |
| Modais | sem foco/Escape | `<dialog>` com foco, Escape e top layer | 2.3 |
| Recusar orçamento (portal) | inexistente | botão "Recusar" com motivo | 2.15 |

---

## Leitura obrigatória

| Prioridade | Arquivo | Linhas | Por quê |
|---|---|---|---|
| P0 | `src/context/AppContext.tsx` | 1-938 | Todas as ações de domínio, persistência e toasts |
| P0 | `src/context/AuthContext.tsx` | 1-266 | Sessão, storage, reauth |
| P0 | `server.ts` | 1-608 | Mock de auth (Fase 1, segurança) |
| P0 | `CLAUDE.md` | todas | Convenções (sem router, modais em `App.tsx`, imutabilidade, reauth) |
| P1 | `src/App.tsx` | 1-82 | Montagem dos modais e ordem do DOM |
| P1 | `src/types/index.ts` | 1-182 | Tipos de domínio (valores de enum em pt-BR) |
| P1 | `src/utils/permissions.ts` | 1-139 | `ROLE_PERMISSIONS` (hoje sem uso) |
| P1 | `src/utils/cpfValidator.ts` | 1-63 | `formatCpf`, `isValidCpf`, `maskCpf` |
| P1 | `src/services/authApi.ts` | 1-192 | Único módulo com `fetch` |
| P2 | `.claude/PRPs/reports/*.md` | todas | Detalhes e linhas de cada achado |

## Documentação externa

| Tópico | Fonte | Conclusão |
|---|---|---|
| `<dialog>` e `showModal()` | MDN `HTMLDialogElement` | Top layer, `inert` no resto da página e Escape nativos. Resolve o empilhamento do reauth |
| Tailwind v4: dark mode por classe | tailwindcss.com/docs/dark-mode | Exige `@custom-variant dark (&:where(.dark, .dark *));` no CSS; sem isso, `dark:` segue `prefers-color-scheme` |
| Tailwind v4: `@theme` | tailwindcss.com/docs/theme | Tokens como `--spacing-*` viram utilitários |
| `createImageBitmap` + `OffscreenCanvas` | MDN | Redimensiona a foto fora do DOM. Faltam no Safari < 16.4, então ter fallback com `<canvas>` |
| Vitest + Vite 8 | vitest.dev | `vitest` lê o `vite.config.ts`; para testar utils puros basta `environment: 'node'` |
| eslint-plugin-react-hooks / jsx-a11y | npm | Flat config (`eslint.config.js`) |

---

## Padrões a seguir (extraídos do código)

### NAMING_CONVENTION
```tsx
// SOURCE: src/components/stock/StockModule.tsx:17
export const StockModule: React.FC = () => {
// SOURCE: src/context/AppContext.tsx:932
export const useApp = () => {
```
- **Componentes:** `export const Nome: React.FC` nomeado, em PascalCase, um por arquivo, em `src/components/<feature>/`.
- **Utils:** funções `camelCase` em `src/utils/*.ts`.
- **Imports:** relativos (o alias `@/` aponta para a raiz e não é usado).
- **Ícones:** `lucide-react`.

### ERROR_HANDLING (front)
```ts
// SOURCE: src/services/authApi.ts:48-55
const data = await res.json();
if (!res.ok) {
  const err = new Error(data.error || 'Erro ao realizar login.');
  ...
  throw err;
}
// SOURCE: src/components/auth/LoginPage.tsx:126-139
try { ... } catch (err: any) { setGeneralError(err.message || '...'); } finally { setIsLoading(false); }
```
Mensagens em pt-BR. Feedback por `showToast` ou por estado de erro local. Em código novo, use `catch (err: unknown)` com narrowing.

### FEEDBACK_PATTERN (toast)
```ts
// SOURCE: src/context/AppContext.tsx:726-730
showToast({ title: `OS #${nextNumber} aberta com sucesso!`, description: '...', type: 'success' });
```

### STATE_UPDATE (imutável)
```ts
// SOURCE: src/context/AppContext.tsx:450-454
setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
```

### MODAL_PATTERN (atual, a ser substituído na 2.3)
```tsx
// SOURCE: src/components/orders/OrderDetailSheet.tsx:67,173
if (!activeOrderId) return null;
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 ...">
```
Os modais são abertos por estado do contexto e renderizados uma única vez em `App.tsx:58-67`.

### REAUTH_PATTERN (para ações sensíveis)
```ts
// SOURCE: src/components/common/Header.tsx:193-202
try {
  await requestReauthentication({ actionType: 'SWITCH_PROFILE', targetRole: role, title: '...', description: '...' });
} catch {
  // Canceled by user
}
```

### LOGGING_PATTERN
Não há logger. O único log é `console.log` em `server.ts:604`. No front, não adicione logs: o feedback ao usuário é por toast.

### SERVER_ROUTE
```ts
// SOURCE: server.ts:479-490
app.get('/api/auth/me', (req: Request, res: Response) => {
  const session = getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'Não autenticado' });
  ...
  return res.json({ user: sanitizeUser(user) });
});
```
Erros respondem com `{ error: string }` em pt-BR.

### TEST_STRUCTURE
Não há testes nem runner. A tarefa 3.1 cria o Vitest. Siga o padrão AAA de `.claude/rules/ecc/common/testing.md`.

---

## Arquivos a alterar (visão geral)

| Arquivo | Ação | Fases |
|---|---|---|
| `server.ts` | UPDATE | 1, 3 (divisão em `server/`) |
| `src/context/AppContext.tsx` | UPDATE | 1, 3 (dividido) |
| `src/context/AuthContext.tsx` | UPDATE | 1 |
| `src/App.tsx`, `src/main.tsx`, `index.html`, `src/index.css` | UPDATE | 1, 2, 3 |
| `src/components/**` (18 arquivos) | UPDATE | 1, 2, 3 |
| `src/types/index.ts`, `src/data/seedData.ts`, `src/utils/permissions.ts` | UPDATE | 1 |
| `src/utils/{storage,ids,dates,format,identifier,image,whatsapp}.ts` | CREATE | 1, 2 |
| `src/domain/{orderStatus,orderRules,totals}.ts` | CREATE | 1, 2 |
| `src/hooks/usePermissions.ts` | CREATE | 1 |
| `src/config/workshop.ts` | CREATE | 2 |
| `src/components/common/ErrorBoundary.tsx` | CREATE | 1 |
| `src/components/ui/{Button,IconButton,Modal,Field,StatusBadge,ConfirmDialog}.tsx` | CREATE | 2 |
| `vitest.config.ts`, `src/**/*.test.ts`, `eslint.config.js`, `tsconfig.server.json` | CREATE | 3 |
| `package.json`, `tsconfig.json`, `.env.example`, `CLAUDE.md`, `README.md` | UPDATE | 3 |

## Fora do escopo
- Integração com o backend real `srv-lutheria` (JWT, tenant, RFC 9457). Os itens marcados "na integração" nos relatórios ficam para um plano próprio.
- Migrar as fotos para IndexedDB além do mínimo necessário: a tarefa 3.8 é opcional.
- Adicionar router, i18n ou design system externo (Radix, shadcn).
- Implementar o leitor real de código de barras (hoje é simulado).
- Testes E2E (Playwright).

## Decisões pendentes (padrão adotado entre parênteses; confirme antes da tarefa)
1. **Tema claro/escuro** (padrão: **remover** o toggle, porque o app é sempre escuro): tarefa 2.17.
2. **Credenciais demo** (padrão: visíveis só com `import.meta.env.DEV`, e o servidor recusa subir em produção com usuários demo, salvo `ENABLE_DEMO_AUTH=true`): tarefa 1.21.
3. **Troca de perfil com reauth** (padrão: **mantida** no mock, endurecida; cai na integração): tarefa 1.21.
4. **Novas dependências** (padrão: **nenhuma na Fase 1**; validação e cabeçalhos feitos à mão. Fase 3 adiciona só devDeps: `vitest`, `eslint` e plugins).
5. **Desfazer ao avançar status** (padrão: só oferecido quando a transição **não** baixou estoque): tarefa 1.9.
6. **`metadata.json` e `bun.lock`** (padrão: **manter** até o usuário confirmar que o AI Studio e o bun não são mais usados): tarefa 3.2.

---

# FASE 1: Bugs e segurança

> Objetivo: nada quebra, nada corrompe dados, nada vaza além do necessário. Só correções e endurecimento, sem redesenho.

### Tarefa 1.1: Modo Bancada não pode quebrar ao abrir
- **ORIGEM:** RR-C1, CR-C1 e design C (tela 10).
- **ARQUIVOS:** `src/components/workbench/WorkbenchModeModal.tsx`
- **AÇÃO:** separar o componente em casca + conteúdo.
- **IMPLEMENTAR:**
  - `WorkbenchModeModal` lê só `isWorkbenchModeOpen` e `currentRole`, e retorna `null` ou `<WorkbenchContent />`.
  - Todos os hooks (`useState`, `useEffect`, `benchOrders`) vão para dentro de `WorkbenchContent`. Isso também zera o timer a cada abertura.
  - Remover o guard duplicado (linha 70).
- **ARMADILHA:** nenhum hook pode ficar depois de um `return` condicional.
- **VALIDAR:** como luthier, abrir e fechar a bancada 3 vezes, pelo Header e pela Home, sem erro no console.

### Tarefa 1.2: Reauth visível acima da Conta (correção rápida)
- **ORIGEM:** RR-H7 e design C (tela 13).
- **ARQUIVOS:** `src/components/auth/ReauthBottomSheet.tsx:138`
- **IMPLEMENTAR:** trocar `z-50` por `z-[60]` no container. A correção definitiva vem com o `<dialog>` na 2.3.
- **VALIDAR:** Minha Conta → mudar telefone → Salvar. O sheet de reauth aparece por cima e conclui o fluxo.

### Tarefa 1.3: Campo "E-mail ou CPF" usável no celular
- **ORIGEM:** RR-H11, design C (tela 1) e duplicação D1.
- **ARQUIVOS:**
  - CREATE `src/utils/identifier.ts`
  - UPDATE `LoginPage.tsx:56-73,228`, `ReauthBottomSheet.tsx:61-74,204` e `ForgotPasswordModal.tsx:16-29`
- **IMPLEMENTAR:**
  ```ts
  import { cleanCpf, formatCpf } from './cpfValidator';
  export function formatIdentifierInput(raw: string): string {
    if (/^[\d.\-\s]*$/.test(raw)) { const d = cleanCpf(raw); return d ? formatCpf(d) : raw; }
    return raw.trim();
  }
  ```
  Nos três inputs, usar `inputMode="email"`, `type="text"`, `autoCapitalize="none"` e `autoCorrect="off"`. Remover o handler duplicado de cada arquivo.
- **VALIDAR:** digitar `lucas2@x.com` mantém o texto. Digitar `12345678909` vira `123.456.789-09`.

### Tarefa 1.4: CPFs semeados válidos
- **ORIGEM:** CR (MEDIUM) e RR (servidor): o login por CPF falha para Mariana e Lucas.
- **ARQUIVOS:** `server.ts:73,86`, `src/data/seedData.ts:9,20,42,53` e `CLAUDE.md` (tabela de demo, se citar CPF).
- **IMPLEMENTAR:** valores já calculados com os dígitos verificadores corretos.

  | Onde | Antes | Depois |
  |---|---|---|
  | Mariana (`server.ts:73`) | `23456789011` | `23456789092` |
  | Lucas (`server.ts:86`) | `32165498712` | `32165498791` |
  | cli-1 Lucas (`seedData.ts:9`) | `321.654.987-12` | `321.654.987-91` |
  | cli-2 (`seedData.ts:20`) | `452.128.900-55` | `452.128.900-20` |
  | cli-3 (`seedData.ts:31`) | `189.776.340-91` | já válido, manter |
  | cli-4 (`seedData.ts:42`) | `234.981.444-01` | `234.981.444-05` |
  | cli-5 (`seedData.ts:53`) | `776.112.554-89` | `776.112.554-60` |
- **VALIDAR:** login com CPF `234.567.890-92` / `Balcao@2026` entra como Mariana. `isValidCpf` aceita todos os CPFs das seeds.

### Tarefa 1.5: Storage seguro e Error Boundary
- **ORIGEM:** RR-H5/H6, CR-H13, SEG C-03 e PERF 3.1 (parte de robustez).
- **ARQUIVOS:**
  - CREATE `src/utils/storage.ts` e `src/components/common/ErrorBoundary.tsx`
  - UPDATE `AppContext.tsx:109-137,169-191`, `AuthContext.tsx:51-58` e `src/main.tsx`
- **IMPLEMENTAR:**
  ```ts
  export function readJson<T>(key: string, fallback: T, isValid: (v: unknown) => v is T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v: unknown = JSON.parse(raw);
      if (isValid(v)) return v;
    } catch { /* corrompido */ }
    try { localStorage.removeItem(key); } catch { /* storage bloqueado */ }
    return fallback;
  }
  export function writeJson(key: string, value: unknown): boolean {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  export const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
  ```
  - Nos efeitos de persistência, se `writeJson` retornar `false`, mostrar um toast de erro uma única vez ("Armazenamento do aparelho cheio. Remova fotos ou exporte dados."), usando uma ref para não repetir.
  - O `ErrorBoundary` é um class component com fallback em pt-BR e um botão "Recarregar", e envolve `<App />` em `main.tsx`.
- **ARMADILHA:** o Error Boundary precisa ser class component (o React 19 não tem equivalente funcional). Ele é a única exceção à regra de "sem class components".
- **VALIDAR:** no DevTools, rodar `localStorage.luthier_orders='{x'` e recarregar: o app abre com as seeds, sem tela branca.

### Tarefa 1.6: Fotos reduzidas e sem duplicação
- **ORIGEM:** PERF 3.1 (CRITICAL), CR-H7 e design (Câmera).
- **ARQUIVOS:**
  - CREATE `src/utils/image.ts`
  - UPDATE `src/components/common/CameraModal.tsx:97-127` e `NewOrderWizardModal.tsx:212-223`
- **IMPLEMENTAR:**
  - `downscaleToDataUrl(source: Blob | HTMLVideoElement, max = 1600, quality = 0.7): Promise<string>`, usando `createImageBitmap` quando houver e fallback com `<canvas>` (`toDataURL('image/jpeg', quality)`).
  - Aplicar no `handleFileUpload` e no `captureWebcamFrame`.
  - No wizard, chamar `createInstrument(..., [])` sem as fotos: elas ficam só na OS.
- **ARMADILHA:** respeitar a orientação EXIF (`imageOrientation: 'from-image'`). O Safari antigo não tem `OffscreenCanvas`.
- **VALIDAR:** enviar um JPEG grande. O `data:` resultante deve ter menos de ~400 KB, e a OS fica salva depois de recarregar.

### Tarefa 1.7: Regras de transição de status centralizadas
- **ORIGEM:** CR-H1/H2, RR-H1/H2 e PERF 1.7.
- **ARQUIVOS:**
  - CREATE `src/domain/orderRules.ts`
  - UPDATE `src/types/index.ts` (adicionar `partsDeducted?: boolean` em `Order`) e `AppContext.tsx:322-448`
- **IMPLEMENTAR:**
  ```ts
  export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
    recebido: 'diagnostico', diagnostico: 'orcamento', orcamento: 'aguardando_aprovacao',
    aguardando_aprovacao: 'em_execucao', em_execucao: 'pronto', pronto: 'entregue',
  };
  export function canTransition(order: Order, to: OrderStatus): { ok: true } | { ok: false; reason: string } { /* regras abaixo */ }
  ```
  Regras do `canTransition`:
  - Para `em_execucao`, exigir `quote?.status === 'aprovado'` (sem orçamento também bloqueia).
  - `entregue` só a partir de `pronto`.
  - `cancelado` a partir de qualquer status, exceto `entregue`.
  - Voltar um passo é permitido para o luthier (com confirmação na UI, tarefa 2.8). Saltar para frente mais de um passo não é permitido.

  Mudanças no `advanceOrderStatus`:
  - **Sem efeitos colaterais dentro de `setOrders`.** Ler a OS atual por `ordersRef.current`, um `useRef` sincronizado com `orders` num efeito, validar com `canTransition`, calcular a OS nova e só então chamar `setOrders`, `showToast`, `deductParts` e `confetti`.
  - Baixar as peças **somente** se `!order.partsDeducted`, marcando `partsDeducted: true`.
- **ARMADILHA:** manter a assinatura pública `advanceOrderStatus(orderId, specificStatus?, note?)`, porque 6 telas chamam a função.
- **VALIDAR:**
  - Clicar duas vezes em "Em Execução" no stepper desconta o estoque **uma** vez (conferir em Estoque → Histórico).
  - Numa OS sem orçamento, avançar para execução mostra um toast de bloqueio.

### Tarefa 1.8: Aprovar orçamento só quando faz sentido
- **ORIGEM:** CR-H1 e RR-H2.
- **ARQUIVOS:** `AppContext.tsx:550-620`, `OrderDetailSheet.tsx:551-560` e `ClientPortalView.tsx:222`.
- **IMPLEMENTAR:**
  - `approveQuote` só age se `order.status === 'aguardando_aprovacao'` e `quote.status !== 'aprovado'`, e reaproveita `deductParts`/`partsDeducted` da 1.7.
  - O botão "Aprovar" só aparece nessas condições.
  - Os efeitos saem do updater, como na 1.7.
- **DEPENDE:** 1.7.
- **VALIDAR:** numa OS entregue, o botão "Aprovar" não aparece, e chamar a ação não muda nada.

### Tarefa 1.9: Estoque coerente (saldo, ids e desfazer)
- **ORIGEM:** CR-H1, RR-H2 e PERF 1.6/1.7.
- **ARQUIVOS:**
  - CREATE `src/utils/ids.ts` (`export const newId = (prefix: string) => \`${prefix}-${crypto.randomUUID()}\`;`)
  - UPDATE `AppContext.tsx:291-319,412-428` e todos os `'xxx-' + Date.now()` (`AppContext.tsx:306,373,460,516,528,592,600,642,706,742,760,780,796`), `NewOrderWizardModal.tsx:174,241,251`
- **IMPLEMENTAR:**
  - `updateStockQuantity` lê o saldo dentro do updater e registra o movimento com a quantidade **efetivamente** aplicada. Se o saldo for insuficiente, avisa com um toast `warning` ("Estoque insuficiente: X").
  - Remover a dependência `[stock]`.
  - No `advanceOrderStatus`, não oferecer `undoAction` quando a transição baixou peças.
- **DEPENDE:** 1.7.
- **VALIDAR:** baixar 3 peças no mesmo clique gera 3 movimentos com ids diferentes, sem warning de `key` duplicada no console.

### Tarefa 1.10: Sessão e dados locais coerentes no login, logout e troca de perfil
- **ORIGEM:** RR-H13/H14, SEG S-07, C-02 e PERF 3.3.
- **ARQUIVOS:** `AuthContext.tsx:51-58,128-158,204-222`, `src/utils/storage.ts` e `src/App.tsx:72-82`.
- **IMPLEMENTAR:**
  - **Funções em `AuthContext`:**
    - `persistSession(token, user, remember)`: limpa as duas storages e grava só em uma.
    - `clearStoredSession()`.
    - `clearBusinessData()`: remove `luthier_clients|instruments|orders|stock|payments|movements|os_wizard_draft`.
  - **Onde usar:**
    - `login` usa `persistSession`.
    - `switchProfileWithTicket` usa `persistSession` com o mesmo storage em que a sessão estava (`remember = !!localStorage.getItem('luthier_auth_token')`).
    - `logout` e o catch de expiração chamam `clearStoredSession()` e `clearBusinessData()`.
  - **Remontagem do contexto:** em `App.tsx`, criar `AppProviderKeyed`, que lê `useAuth().user` e renderiza `<AppProvider key={user?.id ?? 'anon'} initialRole={user?.role ?? 'luthier'}>`. O contexto de dados é remontado a cada troca de usuário.
- **ARMADILHA:**
  - `clearBusinessData` faz o app voltar às seeds no próximo login. Isso é intencional no mock; documente no CLAUDE.md na 3.13.
  - Não apagar `luthier_dark_mode`.
- **VALIDAR:**
  1. Entrar com "manter conectado", trocar de perfil e recarregar: continua no perfil novo.
  2. Sair: no DevTools, as chaves `luthier_*` de negócio sumiram.

### Tarefa 1.11: Papel derivado do usuário, sem flash nem toast duplicado
- **ORIGEM:** SEG S-18, RR (MEDIUM) e CR (MEDIUM).
- **ARQUIVOS:** `AppContext.tsx:140,260-276`, `AuthGuard.tsx:11-16`, `LoginPage.tsx:20,128` e `ReauthBottomSheet.tsx:120`.
- **IMPLEMENTAR:**
  - `AppProvider` recebe a prop `initialRole` (da 1.10) e inicia `currentRole` com ela.
  - Remover o efeito de sincronização do `AuthGuard` e as chamadas `setRole(...)` de `LoginPage` e `ReauthBottomSheet`; a remontagem por `key` já resolve.
  - O `setRole` deixa de mostrar toast; a troca de perfil já mostra o seu.
- **DEPENDE:** 1.10.
- **VALIDAR:** entrar como Lucas não mostra nenhum frame da tela do luthier, e aparece um único toast.

### Tarefa 1.12: Permissões aplicadas a partir de `ROLE_PERMISSIONS`
- **ORIGEM:** CR-H9, SEG S-09 e código morto (permissions sem uso).
- **ARQUIVOS:**
  - CREATE `src/hooks/usePermissions.ts`
  - UPDATE `src/utils/permissions.ts`, `OrderDetailSheet.tsx` (botão Aprovar e aba Orçamento), `MoreModule.tsx:63,378`, `AppContext.tsx` (guardas em `approveQuote`, `recordPayment`, `updateStockQuantity`, `resetToDefaults`, `addServiceItem`), `Header.tsx:243` e `server.ts:538-584`
- **IMPLEMENTAR:**
  ```ts
  import { useApp } from '../context/AppContext';
  import { getRolePermissions } from '../utils/permissions';
  export function usePermissions() { const { currentRole } = useApp(); return getRolePermissions(currentRole); }
  ```
  - **Nas telas:**
    - Trocar as checagens soltas de `currentRole` pelas flags (`canApproveClientQuote`, `canViewFinancialTotals`, `canAccessConfig`, `canResetDemoData`).
    - Corrigir `MoreModule.tsx:378` para `activeSubSection === 'config'`.
    - Esconder o total do template de WhatsApp quando `!canViewFinancialTotals`.
  - **No contexto:** usar `getRolePermissions(currentRole)` nas ações e retornar com um toast `warning` quando o papel não puder.
  - **No servidor:**
    - Renomear as flags de `/permissions` para os mesmos nomes do cliente (`canExecuteBenchLabor`, `canRegisterEntryPhoto`).
    - Fazer o `validate-action` negar por padrão: `const POLICY: Record<string, Role[]>`, e ação desconhecida responde 403.
- **ARMADILHA:**
  - A regra do CLAUDE.md "manter as permissões em sincronia nos dois lados" passa a valer de fato.
  - O luthier continua podendo aprovar orçamento (`canApproveClientQuote: true`). O atendente perde esse botão.
- **VALIDAR:**
  - Como Mariana, a aba Orçamento não mostra valores e não há botão Aprovar.
  - O `curl` de `validate-action` com `{"action":"x"}` responde 403.

### Tarefa 1.13: Portal do cliente fechado por padrão
- **ORIGEM:** RR-H15, CR-H10 e SEG C-04/S-05.
- **ARQUIVOS:** `ClientPortalView.tsx:33-58`
- **IMPLEMENTAR:**
  - Remover o fallback `cli-1`/`clients[0]`.
  - Sem correspondência, mostrar "Sua conta ainda não está vinculada a um cadastro de cliente. Fale com a oficina." e não renderizar nenhuma OS.
- **VALIDAR:** mudar o e-mail do Lucas no `luthier_auth_user`: o portal mostra a mensagem, não a OS de outra pessoa.

### Tarefa 1.14: CPF de clientes mascarado e validado
- **ORIGEM:** CR-H8, SEG S-02 e regra do CLAUDE.md.
- **ARQUIVOS:** `ClientsModule.tsx:77-85,98,306-309` e `GlobalSearchModal.tsx:54`
- **IMPLEMENTAR:**
  - Exibir `maskCpf(selectedClient.cpf)`.
  - No cadastro, usar `formatCpf` no lugar do formatador local e validar com `isValidCpf` quando preenchido, com toast de erro.
  - Na busca, comparar só os dígitos (`cleanCpf`).
- **VALIDAR:** a ficha mostra `***.654.987-**`, e um CPF inválido não é salvo.

### Tarefa 1.15: Wizard de OS sem dados misturados nem registros órfãos
- **ORIGEM:** CR-H7, RR-H3 e design (tela 6).
- **ARQUIVOS:** `NewOrderWizardModal.tsx`
- **IMPLEMENTAR:**
  - **Casca e conteúdo**, como na 1.1: o estado é zerado a cada abertura. O rascunho só restaura `reportedIssue` e `selectedClientId`.
  - **Ao trocar de cliente:** `setSelectedInstrumentId('')`.
  - **Só no "Abrir OS":** `createClient`/`createInstrument` saem do `handleNextStep` e passam a rodar só no `handleFinishOrder`. Nos passos 1 e 2, só validar e guardar os dados num estado de rascunho.
  - **No `handleFinishOrder`:** validar `instrument.clientId === clientId`.
  - **Sem dados inventados:**
    - telefone vazio fica vazio, sem `(11) 99999-0000`;
    - e-mail vazio (`email: ''`, que o tipo já permite por ser string);
    - os valores iniciais de marca e modelo passam a ser `''`.
  - **Clientes:** o mesmo vale para `ClientsModule.tsx:96-97`.
- **ARMADILHA:** o `ClientPortalView` casa o cliente pelo e-mail. Com e-mail vazio, nunca casa, o que é o comportamento correto (fechado por padrão, 1.13).
- **VALIDAR:**
  1. Abrir o wizard, avançar até o passo 3 e fechar. Ao reabrir, ele começa no passo 1.
  2. Abandonar no passo 2 não cria nenhum cliente nem instrumento.

### Tarefa 1.16: Modais que guardavam estado de outro usuário ou OS
- **ORIGEM:** RR-H3 e CR-H14.
- **ARQUIVOS:** `src/App.tsx:58,66` e `AccountSettingsModal.tsx:29-41`.
- **IMPLEMENTAR:**
  - Em `App.tsx`, `<OrderDetailSheet key={activeOrderId ?? 'none'} />`, com `activeOrderId` vindo do `useApp`.
  - `<AccountSettingsModal key={user?.id} />`.
  - Na Conta, a aba de logs só é renderizada se `user.role === 'luthier'`.
- **VALIDAR:** trocar de perfil e abrir Conta mostra o e-mail do usuário atual. Abrir outra OS volta à aba "Serviços".

### Tarefa 1.17: Câmera ao vivo funcionando e categoria da foto respeitada
- **ORIGEM:** RR-H4 e CR-H4.
- **ARQUIVOS:** `CameraModal.tsx:62-95,164-171`, `AppContext.tsx:49,87,164,830-833` (assinatura do callback) e os 4 chamadores (`OrderDetailSheet.tsx:103`, `HomeModule.tsx:55`, `WorkbenchModeModal.tsx:84`, `NewOrderWizardModal.tsx:172`).
- **IMPLEMENTAR:**
  - **Vídeo:** `useEffect(() => { if (isWebcamActive && videoRef.current && streamRef.current) { videoRef.current.srcObject = streamRef.current; void videoRef.current.play(); } }, [isWebcamActive]);`.
  - **Cleanup:** parar as tracks no unmount e quando o `getUserMedia` resolver depois do fechamento (`if (!isOpenRef.current) stream.getTracks().forEach(t => t.stop())`).
  - **Categoria:** o callback passa a ser `(url, caption, tag) => void`. Cada chamador usa a `tag` recebida como padrão, no lugar do valor fixo.
  - **Galeria:** remover `capture="environment"` do input "Galeria / Arquivo" e criar um botão "Câmera nativa" separado, com `capture`.
- **VALIDAR:** "Abrir Câmera ao Vivo" mostra o vídeo (precisa de localhost ou HTTPS). Escolher "Diagnóstico" salva a foto com essa tag.

### Tarefa 1.18: Pagamento e entrega num fluxo único
- **ORIGEM:** CR-H5 e duplicação D20.
- **ARQUIVOS:** `AppContext.tsx` (nova ação `deliverOrder`), `OrderDetailSheet.tsx:119-131,149-168,583-634,693-712`, `HomeModule.tsx:392-403` e `OrdersModule.tsx:290-302`.
- **IMPLEMENTAR:**
  - `deliverOrder(orderId)` chama `advanceOrderStatus(orderId, 'entregue', 'Entregue ao cliente no balcão')` e retorna o saldo.
  - Na Home e na lista, se o saldo for maior que zero, "Entregar" abre a OS (`setActiveOrderId`) com o pagamento à mostra.
  - No sheet, abrir o pagamento troca para a aba `orcamento` (`setActiveTab('orcamento')`).
  - O `handleSavePayment` limita o valor a `remainingBalance`, com toast caso passe.
- **VALIDAR:** entregar uma OS com saldo a partir da Home leva ao formulário de pagamento visível. Pagar mais do que o saldo é bloqueado.

### Tarefa 1.19: Busca global mostra instrumentos e abre o cliente
- **ORIGEM:** CR-H6 e o parâmetro morto `clientId`.
- **ARQUIVOS:** `GlobalSearchModal.tsx:98-103,194-285`, `AppContext.tsx` (novo `activeClientId` e `setActiveClientId`) e `ClientsModule.tsx:35`.
- **IMPLEMENTAR:**
  - Renderizar o grupo "Instrumentos": o clique abre o cliente dono.
  - `ClientsModule` passa a usar o `activeClientId` do contexto no lugar do `useState` local.
  - `handleSelectClient(clientId)` faz `setActiveClientId(clientId)` e `setActiveTab('clientes')`.
- **VALIDAR:** buscar "US2109841" mostra o instrumento, e o clique abre a ficha do Lucas.

### Tarefa 1.20: "Foto da Bancada" não anexa à OS errada
- **ORIGEM:** CR-H3.
- **ARQUIVOS:** `HomeModule.tsx:48-62`
- **IMPLEMENTAR:** o botão passa a abrir o Modo Bancada (`setIsWorkbenchModeOpen(true)`), que tem seletor de OS e botão de foto. Remover o `handleQuickPhoto`.
- **DEPENDE:** 1.1.
- **VALIDAR:** o botão abre a bancada, e a foto vai para a OS selecionada lá.

### Tarefa 1.21: Endurecer o servidor mock
- **ORIGEM:** SEG S-01, S-03, S-04, S-05, S-06, S-08, S-10, S-11, S-12, S-13, S-14 e S-17.
- **ARQUIVOS:** `server.ts`, `package.json` (script `start`), `LoginPage.tsx:337-371` e `ReauthBottomSheet.tsx:36-57,244-250`.
- **IMPLEMENTAR:** sem novas dependências, em subcommits.
  1. **Bind e demo:**
     - `HOST = process.env.HOST ?? '127.0.0.1'` e `PORT = Number(process.env.PORT ?? 3000)`.
     - Se `isProd` e `process.env.ENABLE_DEMO_AUTH !== 'true'`, `throw new Error('Usuários demo não podem subir em produção')`.
     - No front, envolver os botões, as dicas de senha e os e-mails pré-preenchidos em `import.meta.env.DEV`.
  2. **Cabeçalhos e erros:**
     - `app.disable('x-powered-by')` e `express.json({ limit: '10kb' })`.
     - Middleware que define `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`.
     - CSP só quando `isProd`, com as diretivas de SEG S-08.
     - `app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada' }))` antes do SPA, e um error handler final que responde `{ error: 'Erro interno' }`.
     - Script `start` com `NODE_ENV=production`. No Windows, usar `cross-env` (devDep) ou documentar.
  3. **sensitive-update:**
     - Validar tipos antes de alterar: `typeof email === 'string'` com `isValidEmail` e até 254 caracteres; `phone` string com até 20; `newPassword` string entre 8 e 128.
     - Recusar e-mail já usado por outro usuário (409).
     - Calcular o hash antes de atribuir o salt; aplicar as mudanças numa cópia e depois gravar.
     - Revogar as outras sessões do usuário ao trocar a senha.
  4. **switch-profile:** exigir sessão (401) e guardar `sessionId` no ticket, conferindo-o na troca.
  5. **Rate limit e audit:**
     - Chave canônica `user:${id}` quando o usuário existe, mais um contador por IP: `ip:${req.ip}`, com no máximo 20 falhas em 15 min.
     - `app.set('trust proxy', process.env.TRUST_PROXY ?? false)` e IP vindo de `req.ip`.
     - Rate limit também no `forgot-password`.
     - `actionType` vira allow-list (`SWITCH_PROFILE` | `SENSITIVE_UPDATE`), e `details` é truncado em 200 caracteres.
     - Não gravar audit a cada tentativa já bloqueada.
  6. **Timing e hash:**
     - Hash fictício quando o usuário não existe.
     - Trocar `pbkdf2Sync` por `crypto.pbkdf2` assíncrono, com as rotas `async`.
  7. **Limpeza:**
     - `setInterval(sweep, 60_000).unref()` para sessões, tickets e tentativas expiradas.
     - Limitar o identificador a 254 caracteres.
     - Remover o `mockToken` (S-17) e as variáveis `rawDigits`/`targetUserId` mortas.
  8. Rodar `npm audit fix` (body-parser) e conferir `npm audit`.
- **MIRROR:** SERVER_ROUTE (`{ error }` em pt-BR).
- **ARMADILHA:**
  - Com handlers `async` no Express 4, envolver em `try/catch` ou num wrapper `asyncHandler`. O Express 4 não captura promise rejeitada.
  - Manter as mensagens de erro em pt-BR e o formato `{ error }`, que o `authApi` espera.
- **VALIDAR:**
  - `npm run dev` sobe em `127.0.0.1:3000`.
  - O login demo funciona em dev.
  - `curl -X POST /api/auth/sensitive-update` com `newPassword` em array responde 400, e o login continua funcionando.
  - `curl /api/nao-existe` responde JSON 404.
  - `npm audit` sem vulnerabilidades high.

### Tarefa 1.22: Datas no fuso local
- **ORIGEM:** CR (MEDIUM, UTC) e duplicações D5/D6.
- **ARQUIVOS:**
  - CREATE `src/utils/dates.ts`
  - UPDATE `AppContext.tsx` (14 ocorrências), `OrderDetailSheet.tsx:163` e `NewOrderWizardModal.tsx:178,259-263`
- **IMPLEMENTAR:**
  ```ts
  const pad = (n: number) => String(n).padStart(2, '0');
  export const todayDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  export const nowTimestamp = (d = new Date()) => `${todayDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  export const addDays = (days: number, d = new Date()) => todayDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
  ```
  Esse formato é o mesmo das seeds (`'2026-10-08 09:30'`).
- **VALIDAR:** com o relógio às 22h (ou `TZ=America/Sao_Paulo`), a OS criada fica com a data de hoje.

### Tarefa 1.23: Totais da OS consistentes
- **ORIGEM:** CR (MEDIUM, desconto) e duplicação D10.
- **ARQUIVOS:**
  - CREATE `src/domain/totals.ts`
  - UPDATE `AppContext.tsx:456-491,663-677`, `OrderDetailSheet.tsx:493-537` e `ClientPortalView.tsx:234-246`
- **IMPLEMENTAR:** `computeOrderTotals(services, discount = 0) => { laborTotal, partsTotal, discount, grandTotal }`. O `totalAmount` passa a ser **sempre** igual a `grandTotal`, já com o desconto. No portal, listar mão de obra mais peças por serviço.
- **VALIDAR:** na OS 1042, adicionar um serviço de R$100 faz o total ir de 820 para 920 (antes ia para 955).

### Tarefa 1.24: Autor da timeline é o usuário real
- **ORIGEM:** CR (MEDIUM, trilha de auditoria falsa) e duplicação D13.
- **ARQUIVOS:** `AppContext.tsx:354-359,533,597,646,711,801` e `App.tsx` (passar `currentUserName`).
- **IMPLEMENTAR:** `AppProvider` recebe a prop `currentUserName` (de `user.name`, junto com a 1.10). Um helper `actorLabel()` monta `${name} (${roleLabel})`.
- **DEPENDE:** 1.10.
- **VALIDAR:** quando o luthier aprova, a timeline mostra "Armando Luthier (Luthier / Dono)", e não "Mariana".

### Tarefa 1.25: Links externos seguros
- **ORIGEM:** SEG S-16, RR (MEDIUM) e duplicação D12.
- **ARQUIVOS:**
  - CREATE `src/utils/whatsapp.ts`
  - UPDATE os 6 `window.open` (`ClientPortalView:80`, `ClientsModule:215,267`, `MoreModule:72`, `OrderDetailSheet:146`, `OrdersModule:271`)
- **IMPLEMENTAR:**
  ```ts
  export function openWhatsApp(phone: string, text?: string): boolean {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return false;
    const url = `https://wa.me/55${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  ```
  Se a função retornar `false`, mostrar o toast "Cliente sem telefone".
- **ARMADILHA:** dois chamadores já aplicam `encodeURIComponent` antes de passar o texto (`OrderDetailSheet:143`, `ClientPortalView:77`). Passe o texto puro para não codificar duas vezes.
- **VALIDAR:** o WhatsApp abre com a mensagem legível.

### Tarefa 1.26: Ações destrutivas exigem confirmação
- **ORIGEM:** CR (MEDIUM), design (padrão 10) e o CLAUDE.md (ações sensíveis com reauth).
- **ARQUIVOS:** `Header.tsx:245-255` e `MoreModule.tsx:403-410`.
- **IMPLEMENTAR:** "Restaurar dados" passa a exigir `requestReauthentication({ actionType: 'SENSITIVE_UPDATE', title: 'Restaurar dados de demonstração' })` antes de `resetToDefaults()`.
- **MIRROR:** REAUTH_PATTERN.
- **VALIDAR:** "Restaurar" pede a senha, e cancelar não apaga nada.

**Checklist de saída da Fase 1:**
- `npm run lint` e `npm run build` verdes.
- `npm audit` sem high.
- Roteiro manual feito com Armando, Mariana e Lucas: login por e-mail e por CPF, abrir OS, avançar até entregar com pagamento, bancada, foto, portal aprovando e conta salvando telefone.

---

# FASE 2: Design e UX das telas

> Objetivo: componentes compartilhados acessíveis e telas consistentes. Cumprir os requisitos de ergonomia do README/CLAUDE.md: alvos ≥ 48px (64px na bancada), zona do polegar e contraste AA.

### Tarefa 2.1: Tokens e base de CSS
- **ORIGEM:** design (Recomendações e padrões 12, 16 e 19).
- **ARQUIVOS:** `src/index.css` e `index.html`.
- **IMPLEMENTAR:**
  - **`@theme`:** `--spacing-target: 3rem` e `--spacing-target-bench: 4rem`.
  - **CSS base:**
    - `html { scroll-padding-block: 5rem; }`;
    - remover `user-select: none` do `body`, que deve ficar só nos botões, via `button { user-select: none }`;
    - `:focus-visible { outline: 2px solid var(--color-amber-400); outline-offset: 2px; }`;
    - `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }`.
  - **`index.html`:**
    - viewport sem `maximum-scale` nem `user-scalable=no`;
    - `<body class="bg-stone-950 text-stone-100 ...">`;
    - remover a família Space Grotesk da URL do Google Fonts.
- **VALIDAR:** o zoom com pinça funciona no celular, e o Tab mostra o contorno âmbar.

### Tarefa 2.2: Componente `Button`
- **ARQUIVOS:** CREATE `src/components/ui/Button.tsx`
- **IMPLEMENTAR:**
  - **Tamanhos:** `sm`=`min-h-10`, só para ações secundárias; `md`=`min-h-12`, o padrão; `lg`=`min-h-14`; `bench`=`min-h-16 text-lg`.
  - **Tons:**
    - `primary`=`bg-amber-600 text-stone-950 hover:bg-amber-500` (6,19:1 e 9,21:1);
    - `success`=`bg-emerald-700 text-white hover:bg-emerald-800` (5,37:1);
    - `danger`=`bg-rose-700 text-white`;
    - `ghost`=`bg-stone-800 text-stone-100`.
  - **Props:** `type='button'` por padrão, `disabled` com `aria-disabled`.
- **MIRROR:** NAMING_CONVENTION (`export const Button: React.FC<ButtonProps>`).
- **VALIDAR:** lint e build. Usado na 2.9.

### Tarefa 2.3: `Modal`/`BottomSheet` com `<dialog>` e migração dos 10 modais
- **ORIGEM:** RR-H8 e design C (telas 5, 6 e 13) e padrão 1.
- **ARQUIVOS:** CREATE `src/components/ui/Modal.tsx`. Migrar em **um commit por modal**, nesta ordem:
  1. `OrderDetailSheet`
  2. `NewOrderWizardModal`
  3. `ReauthBottomSheet` (remove o `z-[60]` da 1.2)
  4. `AccountSettingsModal`
  5. `CameraModal`
  6. `BarcodeScannerModal`
  7. `GlobalSearchModal` (variante tela cheia)
  8. `WorkbenchModeModal` (variante tela cheia)
  9. `ForgotPasswordModal`
  10. os 2 modais de `ClientsModule`
- **IMPLEMENTAR:**
  - Props: `open`, `onClose`, `title`, `variant: 'sheet'|'center'|'full'` e `children`.
  - Comportamento:
    - `showModal()`/`close()` num efeito;
    - `onCancel` (Escape) chama `onClose`;
    - clique no backdrop (alvo === dialog) fecha, exceto quando `dismissible={false}` (wizard e reauth com dados digitados);
    - `aria-labelledby` com `useId`;
    - o foco volta ao elemento que abriu, guardado em `document.activeElement` ao abrir.
  - Altura `max-h-[90dvh]` e rodapé fixo opcional (`footer` prop).
  - Botão fechar via `IconButton` (2.4), com `aria-label="Fechar"`.
- **ARMADILHA:**
  - Estado aberto/fechado: os modais continuam montados em `App.tsx` e controlados pelo contexto. Passar `open={isXOpen}` e remover os `return null`, ou manter a montagem condicional da 3.7. Os dois caminhos funcionam com `<dialog>`.
  - Empilhamento: com `showModal()`, o reauth aberto por cima da Conta fica no top layer, acima dela.
  - Estilo: `dialog::backdrop` aceita `backdrop:bg-black/80` no Tailwind v4.
- **VALIDAR:**
  - Em cada modal: Escape fecha, o Tab não sai do modal e o foco volta ao botão de origem.
  - O VoiceOver/TalkBack anuncia "diálogo, <título>".

### Tarefa 2.4: `IconButton` com nome obrigatório
- **ARQUIVOS:** CREATE `src/components/ui/IconButton.tsx`. Migrar os botões só com ícone listados em design (padrão 3):
  - os X de fechar;
  - chevron, WhatsApp e Ligar em `ClientsModule`;
  - −/+ em `StockModule`, com `aria-label={\`Dar baixa em 1 ${item.name}\`}`;
  - o disparador da câmera;
  - reset do timer, câmera do sheet, remover foto do wizard e limpar busca.
- **IMPLEMENTAR:** `label: string` obrigatório, que vira `aria-label` e `title`. Tamanho `size-12` (ou `size-16` na bancada). Ícone com `aria-hidden`.
- **VALIDAR:** o axe não aponta "button has no discernible text".

### Tarefa 2.5: `Field` (label, erro e 16px)
- **ARQUIVOS:** CREATE `src/components/ui/Field.tsx`. Migrar os formulários de:
  - `ClientsModule` (2 modais);
  - `NewOrderWizardModal`;
  - `AccountSettingsModal`;
  - `ForgotPasswordModal`;
  - o pagamento e o serviço em `OrderDetailSheet`;
  - a legenda em `CameraModal`;
  - o select em `MoreModule`;
  - as buscas, com `aria-label`.
- **IMPLEMENTAR:**
  - `useId` liga label e input; `aria-invalid` e `aria-describedby`; erro com `role="alert"`.
  - Visual: `text-base` (sem zoom no iOS), `min-h-12`, `border-stone-500` (≥ 3:1) e placeholder `stone-400`.
  - Formulários com `<form onSubmit>`, para Enter enviar (inclui o input manual do leitor de código).
- **VALIDAR:** clicar no label foca o campo. Erro de validação aparece no campo, não só em toast (wizard, 3.3.1).

### Tarefa 2.6: Status (mapa, lista única e `StatusBadge`)
- **ORIGEM:** duplicações D7/D8/D9 e design (padrão 13).
- **ARQUIVOS:**
  - CREATE `src/domain/orderStatus.ts` e `src/components/ui/StatusBadge.tsx`
  - UPDATE os 13 `replace('_',' ')` e os badges de Home, Orders, Portal, Mais, Bancada e Clientes
- **IMPLEMENTAR:**
  - `STATUS_FLOW` (lista ordenada) e `STATUS_META: Record<OrderStatus, { label: string; tone: string; icon: LucideIcon }>`, com rótulos acentuados: "Diagnóstico", "Orçamento", "Aguardando aprovação", "Em execução" etc.
  - `STATUS_STEPS` do sheet, `statusOptions`/colunas do Kanban e `steps` do portal derivam de `STATUS_FLOW`.
  - Tipos de instrumento (`INSTRUMENT_TYPE_LABEL`) e tags de foto (`PHOTO_TAG_LABEL`) seguem o mesmo padrão.
- **VALIDAR:** nenhum rótulo sem acento em nenhuma tela (`grep "replace('_'"` sem resultados).

### Tarefa 2.7: Formatação de moeda e data
- **ARQUIVOS:**
  - CREATE `src/utils/format.ts`
  - UPDATE as 21 ocorrências de `toFixed(`, mais as datas `substring(5)`/`substring(8)` e o "OUT" fixo (`MoreModule.tsx:188`)
- **IMPLEMENTAR:**
  - `formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)`
  - `formatShortDate('2026-10-14') => '14 out'`
  - `formatDateTime`
  - O mês do tile da agenda vem de `formatShortDate`.
- **VALIDAR:** "R$ 820,00" com vírgula. A agenda mostra o mês correto.

### Tarefa 2.8: Controles com semântica e estado
- **ORIGEM:** RR-H9 e design (padrões 4 e 9).
- **ARQUIVOS:** os 14 `div onClick` (Home 7, Orders 2, Sheet 1, Clients 2, More 1, Wizard 1). Mais:
  - chips (Orders, Stock, Wizard, Câmera, Mais);
  - abas (Sheet, Stock, Mais);
  - BottomTabBar;
  - menu do Header.
- **IMPLEMENTAR:**
  - Trocar os `div onClick` por `<button type="button">`.
  - No checklist, `role="checkbox" aria-checked`.
  - Atributos de estado:
    - chips e presets com `aria-pressed`;
    - abas com `role="tablist"/"tab"` e `aria-selected`;
    - tab bar com `aria-current="page"`;
    - stepper com `aria-current="step"`;
    - menu de persona com `aria-expanded`/`aria-haspopup` e fechamento por Escape.
  - Stepper: voltar ou pular passo abre o `ConfirmDialog` (CREATE `src/components/ui/ConfirmDialog.tsx`, sobre o `Modal`).
- **DEPENDE:** 2.3.
- **VALIDAR:** todas as ações chegam pelo Tab, e o leitor de tela anuncia o estado.

### Tarefa 2.9: Alvos de toque e zona do polegar, tela por tela
- **ORIGEM:** design (todas as telas) e README.
- **ARQUIVOS e o que muda:**
  - **Header:** botões `min-h-12`; busca e sync com texto visível ou `aria-label`; `pt-safe`.
  - **Hoje:** ações do cartão `min-h-12`, com Avançar afastado de Detalhes; "Ver Todas" vira `Button sm`.
  - **OrdersModule:** ações do cartão `min-h-12` com `gap-3`, chips `min-h-11`, toggle `min-h-11`.
  - **OrderDetailSheet:**
    - CTA do rodapé `min-h-14`;
    - stepper `min-h-11`;
    - abas `min-h-12`;
    - pagamento, "Adicionar serviço" e "Nova foto" `min-h-12`;
    - telefone como link `tel:`.
  - **Wizard:**
    - rodapé `min-h-12`;
    - "Fotografar" e "Falar" `min-h-12`;
    - chips `min-h-12`.
  - **ClientsModule:** ações da linha `size-12` com `gap-2`; "Voltar" e "Adicionar" `min-h-12`; modais com `max-h-[90dvh] overflow-y-auto`.
  - **StockModule:** −/+ com `size-12`, `gap-3` e o nome do item no `aria-label`; "Escanear" `min-h-12`.
  - **CameraModal, Reauth, Conta e Forgot:** botões `min-h-12`.
  - **Portal:** CTA de aprovação fixo no rodapé (`sticky bottom-0`); "Voltar p/ Luthier" `min-h-12`.
- **MIRROR:** `Button`/`IconButton` (2.2 e 2.4).
- **VALIDAR:** no DevTools (Device 360×800), inspecionar os botões: altura ≥ 48px.

### Tarefa 2.10: Modo Bancada com 64px e ações fixas
- **ORIGEM:** design (tela 10) e CLAUDE.md.
- **ARQUIVOS:** `WorkbenchModeModal.tsx`
- **IMPLEMENTAR:**
  - **Alvos de 64px** (`min-h-16`): checklist, timer, reset, presets, "Sair" e seletor de OS.
  - **Rodapé fixo:** Foto e Avançar em `sticky bottom-0`.
  - **Seletor de OS:** usar `benchOrders` (não `orders.slice(0,5)`).
  - **Timer:**
    - preset ativo com `aria-pressed`, e o reset volta ao preset;
    - ao acabar, `navigator.vibrate([200,100,200])` e beep;
    - Wake Lock (`navigator.wakeLock?.request('screen')`) enquanto estiver rodando.
  - **Avançar:** pede confirmação.
- **DEPENDE:** 1.1 e 2.2.
- **VALIDAR:** todos os controles da tela com ≥ 64px.

### Tarefa 2.11: Contraste
- **ORIGEM:** design (contrastes calculados).
- **ARQUIVOS:** busca e troca em `src/components/**`.
- **IMPLEMENTAR:**
  - `bg-amber-600 … text-white` → `text-stone-950` (31×)
  - `bg-emerald-600 … text-white` → `bg-emerald-700` (14×)
  - texto `text-stone-500` → `text-stone-400` (32×) e `text-stone-600` → `text-stone-400` (3×)
  - `placeholder-stone-500` → `placeholder-stone-400`
  - bordas de campo `border-stone-800/700` → `border-stone-500` (componente)
  - contador do tab bar: `text-stone-950`
- **ARMADILHA:**
  - Conferir os degradês do tile "NOVA OS" e as opacidades (`opacity-75`, `/60`) com o axe.
  - Prefira migrar para `Button` (2.2) em vez de trocar a classe à mão.
- **VALIDAR:** axe DevTools sem "color-contrast" nas 5 abas e nos modais.

### Tarefa 2.12: Toasts acessíveis
- **ORIGEM:** RR (MEDIUM) e design (shell).
- **ARQUIVOS:** `ToastContainer.tsx` e `AppContext.tsx:212-221`.
- **IMPLEMENTAR:**
  - Container sempre montado com `aria-live="polite"`, e toasts de `error` com `role="alert"`.
  - Sem `truncate`; usar `line-clamp-3`.
  - Duração padrão de 6 s, e 10 s com `undoAction`. Pausar ao passar o mouse ou focar.
  - Botões "Desfazer" e X com `min-h-11`.
- **VALIDAR:** o leitor de tela anuncia o toast. "Desfazer" é alcançável a tempo.

### Tarefa 2.13: Movimento reduzido e animações
- **ARQUIVOS:** os 13 `animate-pulse/bounce/spin` e os 3 `confetti(` em `AppContext`.
- **IMPLEMENTAR:**
  - `motion-safe:animate-pulse`, mantendo pulso só no indicador offline e no "ouvindo".
  - `confetti({ ..., disableForReducedMotion: true })`.
  - Remover o pulso dos badges de lista (`OrdersModule:222`, `ClientPortalView:161,198`).
- **VALIDAR:** com "Reduzir movimento" ligado no sistema, nada pisca.

### Tarefa 2.14: Wizard rápido (meta de < 60 s)
- **ORIGEM:** design (tela 6).
- **ARQUIVOS:** `NewOrderWizardModal.tsx`, `AppContext.tsx` (`openNewOrderWizard(prefillClientId?)`) e `ClientsModule.tsx:383-385`.
- **IMPLEMENTAR:**
  - **Passo 1:** campo de busca e 3 clientes recentes.
  - **Passo 2:** foto no topo; botão "Abrir OS agora", que usa o serviço padrão e pula o passo 3.
  - **Passo 3:** resumo com o total (`formatBRL`).
  - **Atalho:** "Abrir Nova OS" na ficha do cliente pré-seleciona o cliente e começa no passo 2.
  - Remover os textos "< 60 segundos" do cabeçalho.
- **DEPENDE:** 1.15 e 2.5.
- **VALIDAR:** cronometrar o cliente novo com foto em menos de 60 s.

### Tarefa 2.15: Portal do cliente
- **ORIGEM:** design (tela 12) e código morto (`rejectQuote` sem uso).
- **ARQUIVOS:** `ClientPortalView.tsx`, `Header.tsx` (esconder seletor de persona e controles da equipe para `cliente`) e CREATE `src/config/workshop.ts` (telefone da oficina e domínio do portal).
- **IMPLEMENTAR:**
  - **Passos:** de `STATUS_FLOW` (2.6), com `<ol>`, `aria-current="step"` e o texto "concluído".
  - **Orçamento:**
    - "Aprovar" pede confirmação (`ConfirmDialog`) com o total;
    - novo "Recusar", com um campo de motivo, chama `rejectQuote`.
  - **Interface:**
    - CTA fixo no rodapé;
    - banner "Voltar p/ Luthier" só em `import.meta.env.DEV`;
    - telefone da oficina e domínio `luthieria.app` (usado em `OrderDetailSheet:144` e `MoreModule:61,63`) numa constante em `src/config/workshop.ts`.
- **VALIDAR:** como Lucas, é possível aprovar com confirmação e recusar. Nenhum controle da equipe fica visível.

### Tarefa 2.16: Listas, agenda e métricas verdadeiras
- **ORIGEM:** CR (MEDIUM) e design (telas 3, 4 e 9).
- **ARQUIVOS:** `OrdersModule.tsx:313-321`, `MoreModule.tsx:43,155-253,393`, `HomeModule.tsx:44-46,319` e `StockModule.tsx:141-149,320`.
- **IMPLEMENTAR:**
  - **OrdersModule:** o Kanban mostra todos os status de `STATUS_FLOW`.
  - **MoreModule:**
    - o filtro da agenda funciona (hoje, 7 dias, todos), ordenado por prazo, sem OS entregue;
    - as métricas são calculadas (ticket médio = soma ÷ nº de pagamentos; forma mais usada pela contagem), e "+18%" sai;
    - "Mês atual" filtra pelo mês corrente;
    - o texto "IndexedDB" é corrigido.
  - **HomeModule:** "Prioridades" ordena por prioridade e prazo.
  - **StockModule:** "Ver Itens" filtra o estoque baixo, e o histórico usa `item.unit`.
- **VALIDAR:** os números batem com os dados. Uma OS em `orcamento` aparece no Kanban.

### Tarefa 2.17: Tema (decisão 1) e textos de protótipo
- **ARQUIVOS:** `Header.tsx:138-146`, `AppContext.tsx:44,63,157-160,193-200,227-230`, `HomeModule.tsx:71,168,185,345`, `OrdersModule.tsx:187`, `BarcodeScannerModal.tsx:86-106` e `CameraModal.tsx:15-46,131-137`.
- **IMPLEMENTAR:**
  - **Tema:** remover o toggle, o estado `isDarkMode` e o `luthier_dark_mode` (padrão). A alternativa é implementar `@custom-variant dark`.
  - **Emojis:** trocar por ícones `lucide-react` com `aria-hidden`.
  - **Recursos de simulação, só com `import.meta.env.DEV`:**
    - "Simular Leitura";
    - as fotos de exemplo da câmera;
    - o ditado simulado (que insere texto falso).
  - **Textos:** remover "(Zona do Polegar)".
- **VALIDAR:** o build de produção não contém "Simular Leitura" (grep no bundle gerado).

**Checklist de saída da Fase 2:**
- `npm run lint` e `npm run build` verdes.
- axe DevTools sem violações sérias nas 5 abas e nos 10 modais.
- Teste com TalkBack ou VoiceOver: login, abrir OS, checklist e aprovação no portal.
- Medir os alvos em 360px.

---

# FASE 3: Refatoração e desempenho

> Objetivo: base saudável para a integração com o backend. Testes, lint de verdade, código morto removido, contexto dividido e carregamento sob demanda.

### Tarefa 3.1: Vitest e testes do domínio (pode ser antecipada)
- **ARQUIVOS:**
  - CREATE `vitest.config.ts` e `src/**/*.test.ts`
  - UPDATE `package.json` (devDep `vitest`; scripts `"test": "vitest run"` e `"test:watch": "vitest"`)
- **IMPLEMENTAR:** testes AAA de:
  - `cpfValidator` (válidos e inválidos, incluindo os CPFs das seeds);
  - `identifier`;
  - `dates` (com `vi.setSystemTime` às 22h);
  - `totals` (desconto);
  - `orderRules` (cada transição, `partsDeducted`, orçamento ausente);
  - `storage` (JSON corrompido, cota cheia via mock de `setItem` que lança).
- **ARMADILHA:** os testes de utils puros rodam em `environment: 'node'`. Os de `storage` precisam de `jsdom` (devDep) ou de um mock de `localStorage`.
- **VALIDAR:** `npm test` verde. "Pronto" passa a incluir `npm test`.

### Tarefa 3.2: Remover código morto e dependências sem uso
- **ORIGEM:** `codigo-morto.md` (seções 1-5).
- **ARQUIVOS:** os 83 itens do `tsc --noUnusedLocals`, `package.json`, `.env.example`, `index.html`, `src/index.css:4-9,43-45`, `AppContext.tsx` (`searchQuery`, `setSearchQuery`, `updateOrder`), `ClientsModule.tsx` (`instNotes`), `authApi.ts` (`getPermissions`/`validateAction`, se a 1.12 não passou a usá-los) e `CLAUDE.md`.
- **IMPLEMENTAR:**
  - Ligar `"noUnusedLocals": true, "noUnusedParameters": true` no `tsconfig` e remover tudo o que o compilador apontar.
  - `npm uninstall @google/genai motion dotenv autoprefixer`; tirar `esbuild` da lista direta (vem via `tsx`/`vite`).
  - Remover `GEMINI_API_KEY`/`APP_URL` do `.env.example`.
  - Ajustar o script `clean`.
  - Atualizar o CLAUDE.md: `motion` não é usado; não há mais `@google/genai`.
- **ARMADILHA:** não remover `DISABLE_HMR` de `vite.config.ts` (o CLAUDE.md pede para manter). Para `metadata.json` e `bun.lock`, ver a decisão 6.
- **VALIDAR:** `npx tsc --noEmit` com as flags novas sem erro; build verde; `npm ls` sem os pacotes removidos.

### Tarefa 3.3: ESLint (`react-hooks` + `jsx-a11y`)
- **ARQUIVOS:** CREATE `eslint.config.js`; UPDATE `package.json` (devDeps `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`; `"lint": "tsc --noEmit && eslint ."`).
- **IMPLEMENTAR:** flat config com `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: warn` e `jsx-a11y/recommended`. Corrigir o que aparecer, ou justificar com comentário.
- **DEPENDE:** 3.2.
- **VALIDAR:** `npm run lint` verde. O critério de pronto passa a incluir o ESLint.

### Tarefa 3.4: `tsconfig` estrito e separado para o servidor
- **ARQUIVOS:** `tsconfig.json`; CREATE `tsconfig.server.json`.
- **IMPLEMENTAR:**
  - Ligar `"strict": true` e remover `experimentalDecorators`, `useDefineForClassFields` e `allowJs`.
  - Corrigir os `any` (lista em CR/MEDIUM "Tipagem"):
    - `catch (err: unknown)`;
    - classe `ApiError` em `authApi`;
    - `AuditLogItem[]`;
    - `ReturnType<typeof setInterval>`.
  - `tsconfig.server.json` com `types: ["node"]` só para `server.ts`; o `lint` roda os dois.
  - Trocar `__dirname` em `vite.config.ts` por `fileURLToPath(new URL('.', import.meta.url))`.
- **ARMADILHA:** pode gerar dezenas de erros. Faça em commits por pasta, ou use `// @ts-expect-error` temporário com TODO.
- **VALIDAR:** `npm run lint` verde em modo estrito.

### Tarefa 3.5: Dividir o `AppContext`
- **ORIGEM:** PERF 1.1/1.6, CR-H15 e RR (MEDIUM).
- **ARQUIVOS:**
  - CREATE `src/context/{DataContext,UiContext,ToastContext,CameraContext}.tsx`
  - UPDATE `AppContext.tsx` (vira um agregador `useApp()` temporário, para compatibilidade) e os 20 consumidores, aos poucos
- **IMPLEMENTAR:**
  - Cada provider com `useMemo` no valor.
  - Ações lendo o estado por updater ou `ref`, para ter `useCallback` estáveis.
  - Ordem: Toast → Camera → Ui → Data.
  - Os consumidores migram para `useToast()`/`useUi()`/`useData()`. No fim, remover o `useApp`.
- **ARMADILHA:** manter o comportamento idêntico. Rodar `npm test` (3.1) a cada passo. O arquivo final de cada contexto deve ficar abaixo de 400 linhas.
- **VALIDAR:** o React DevTools Profiler mostra que um toast não re-renderiza a lista de OS.

### Tarefa 3.6: Índices e derivados memoizados
- **ORIGEM:** PERF 1.5.
- **ARQUIVOS:** `DataContext` (expõe `clientById` e `instrumentById` como `Map`), `OrdersModule`, `ClientsModule`, `HomeModule`, `MoreModule`, `BottomTabBar` e `GlobalSearchModal`.
- **IMPLEMENTAR:**
  - Trocar `clients.find(...)` dentro de `.map` por `clientById.get(...)`.
  - `useMemo` nos KPIs e nas contagens por status.
  - Debounce de 200 ms na busca global.
- **VALIDAR:** comportamento idêntico, sem `.find` dentro de `.map` (grep).

### Tarefa 3.7: Montagem condicional e `React.lazy`
- **ORIGEM:** PERF 1.2/2.3.
- **ARQUIVOS:** `src/App.tsx` e `AppContext`/`DataContext` (confete dinâmico).
- **IMPLEMENTAR:**
  - `const OrderDetailSheet = lazy(() => import('./components/orders/OrderDetailSheet').then(m => ({ default: m.OrderDetailSheet })))`. O mesmo para Wizard, Bancada, Câmera, Leitor, Busca, Clientes, Estoque, Mais e Portal.
  - Montar só quando aberto: `{isOpen && <Suspense fallback={null}>…</Suspense>}`.
  - `const fireConfetti = async (o) => (await import('canvas-confetti')).default(o)`.
- **ARMADILHA:** com a 2.3 usando `<dialog>`, abrir depois do lazy load ainda precisa chamar `showModal()` no efeito (já previsto no `Modal`).
- **VALIDAR:** o build gera vários chunks, e o chunk inicial cai uns 20-30 kB gz em relação aos 121,7 kB atuais.

### Tarefa 3.8: Persistência sem travar a thread principal
- **ORIGEM:** PERF 3.2 (e 3.1 parte estrutural).
- **ARQUIVOS:** `DataContext` (efeitos de persistência) e, opcionalmente, CREATE `src/utils/photoStore.ts` (IndexedDB).
- **IMPLEMENTAR:**
  - Debounce de 500 ms por coleção, com flush em `pagehide` e `visibilitychange`.
  - **Opcional:** fotos novas como Blob no IndexedDB, com só a referência (`idb:<id>`) na OS e um hook `usePhotoUrl` para exibir.
- **VALIDAR:** marcar 10 itens do checklist rapidamente gera 1 escrita.

### Tarefa 3.9: Quebrar componentes grandes
- **ORIGEM:** CR-H15 e RR (componentes > 200 linhas).
- **ARQUIVOS:**
  - `OrderDetailSheet.tsx` → `orders/detail/{ServicesTab,PhotosTab,QuoteTab,TimelineTab,ActionBar}.tsx`
  - `NewOrderWizardModal.tsx` → `orders/wizard/{StepClient,StepInstrument,StepServices}.tsx`
  - `ClientsModule.tsx` → `clients/{ClientList,ClientDetail,NewClientForm,NewInstrumentForm}.tsx`
  - extrair os cards de OS em `orders/OrderCard.tsx` com `React.memo` (depois da 3.5)
- **VALIDAR:** nenhum arquivo de `src/` acima de 400 linhas (`wc -l`); comportamento idêntico.

### Tarefa 3.10: Organizar o servidor
- **ORIGEM:** CR-H15 e duplicações D17/D18.
- **ARQUIVOS:** `server.ts` → `server/{index,users,sessions,rateLimit,audit,routes/auth}.ts`, mantendo `server.ts` como entrada (`npm run dev` não muda).
- **IMPLEMENTAR:** helpers `verifyPassword(user, pwd)`, `findUserByIdentifier(input)` e `normalizeIdentifier()`; rotas num `express.Router()`.
- **DEPENDE:** 1.21 e 3.4.
- **VALIDAR:** os mesmos `curl` da 1.21 passam.

### Tarefa 3.11: Ajustes finos de desempenho
- **ORIGEM:** PERF 1.4, 2.4 e 4.4.
- **ARQUIVOS:** `WorkbenchModeModal`, `LoginPage`, `NewOrderWizardModal` (debounce do rascunho), `AuthContext` (listeners `{ passive: true }`), os 10 overlays com `backdrop-blur` e os 8 `<img>` de lista.
- **IMPLEMENTAR:**
  - **Timers:** intervals com deps estáveis (updater funcional; timestamp-alvo para não acumular atraso).
  - **Overlays:** remover `backdrop-blur` (usar `bg-black/90`), mantendo só no tab bar se ainda houver.
  - **Imagens:** `loading="lazy" decoding="async"`.
- **VALIDAR:** o timer da bancada não acumula atraso em 5 min com a aba em segundo plano.

### Tarefa 3.12: Listas com limite
- **ORIGEM:** PERF 4.3.
- **ARQUIVOS:** `StockModule.tsx:295`, `OrdersModule.tsx:157`, `MoreModule.tsx:173,261` e `OrderDetailSheet` (timeline).
- **IMPLEMENTAR:** mostrar 50 itens e um botão "Ver mais". `react-window` só se as medições justificarem.
- **VALIDAR:** com 500 movimentos gerados no console, a aba Estoque abre sem travar.

### Tarefa 3.13: Documentação
- **ARQUIVOS:** `CLAUDE.md` e `README.md`.
- **IMPLEMENTAR:**
  - **Comandos:** `npm test` e o novo `lint`.
  - **Estrutura:** o que foi criado em `src/components/ui`, `src/domain`, `src/utils`, `src/config` e `src/context`.
  - **Regras:** permissões via `usePermissions` e "sincronizar com o servidor"; logout limpa os dados locais.
  - **Mock:** variáveis do servidor (`HOST`, `PORT`, `ENABLE_DEMO_AUTH`, `TRUST_PROXY`) e CPFs demo válidos.
  - **Dívidas:** remover do "Known debt" o que foi resolvido.
- **VALIDAR:** um novo desenvolvedor consegue rodar o app e os testes seguindo só o README.

**Checklist de saída da Fase 3:**
- `npm run lint` (tsc estrito + ESLint), `npm test` e `npm run build` verdes.
- Nenhum arquivo acima de 800 linhas (meta: 400).
- Bundle inicial menor que o de hoje.
- Zero dependências sem uso.

---

## Estratégia de testes

### Testes unitários (Vitest, a partir da 3.1)
| Teste | Entrada | Saída esperada | Caso de borda? |
|---|---|---|---|
| `isValidCpf` | `23456789092` / `23456789011` | `true` / `false` | sim (seeds antigas) |
| `formatIdentifierInput` | `lucas2` / `12345678909` | `lucas2` / `123.456.789-09` | sim |
| `nowTimestamp` | 2026-11-08 22:30 local | `'2026-11-08 22:30'` | sim (UTC) |
| `computeOrderTotals` | serviços de 690 + 165, desconto 35 | `grandTotal = 820` | não |
| `canTransition` | `aguardando_aprovacao` → `em_execucao` sem quote aprovado | `ok: false` | sim |
| `canTransition` | `recebido` → `pronto` | `ok: false` (salto) | sim |
| Baixa de peças | avançar duas vezes para `em_execucao` | 1 movimento | sim |
| `readJson` | `'{x'` | fallback + chave removida | sim |
| `writeJson` | `setItem` lança `QuotaExceededError` | `false` | sim |

### Casos de borda
- [ ] Entrada vazia: e-mail/telefone do cliente vazios, busca vazia.
- [ ] Entrada muito grande: foto de 10 MB, identificador de 100 KB no servidor.
- [ ] Tipos inválidos: `newPassword` em array, `phone` numérico.
- [ ] Concorrência: baixar várias peças no mesmo ms (ids), clique duplo em Avançar.
- [ ] Falha de rede: logout offline, `res.json()` de uma resposta HTML.
- [ ] Permissão negada: atendente tentando aprovar ou ver financeiro; `validate-action` desconhecida.

---

## Comandos de validação

### Análise estática
```bash
npm run lint
```
ESPERADO: zero erros (Fases 1 e 2: só `tsc`; Fase 3: `tsc` estrito + ESLint).

### Build
```bash
npm run build
```
ESPERADO: build sem erros. Compare o tamanho com o estado inicial (JS 121,7 kB gz).

### Testes unitários (a partir da 3.1)
```bash
npm test
```
ESPERADO: todos passam.

### Dependências
```bash
npm audit
```
ESPERADO: nenhuma vulnerabilidade high ou critical (depois da 1.21).

### Validação no navegador
```bash
npm run dev   # http://localhost:3000 (127.0.0.1 após a 1.21)
```
ESPERADO: o roteiro manual abaixo funciona.

### Validação manual (ao fim de cada fase)
- [ ] Login de Armando por e-mail, Mariana por CPF `234.567.890-92` e Lucas por e-mail, tudo no celular (teclado de texto).
- [ ] Nova OS de um cliente novo com foto, em menos de 60 s (Fase 2).
- [ ] Avançar uma OS até "entregue", com pagamento; o estoque é baixado uma única vez.
- [ ] Modo Bancada abre, marca serviço, tira foto e usa o timer.
- [ ] Conta → mudar telefone → reauth → salvo.
- [ ] Portal do Lucas: aprovar com confirmação e recusar com motivo.
- [ ] Logout: as chaves `luthier_*` de negócio somem.
- [ ] axe DevTools nas 5 abas e nos modais (Fase 2).

---

## Critérios de aceite
- [ ] Todas as tarefas das 3 fases concluídas, ou com decisão registrada.
- [ ] `npm run lint` e `npm run build` verdes ao fim de **cada tarefa**.
- [ ] `npm test` verde a partir da 3.1.
- [ ] Os 6 relatórios revisitados: os CRITICAL e HIGH resolvidos, ou com justificativa.
- [ ] As telas cumprem 48/64px e o contraste AA (Fase 2).

## Checklist de conclusão
- [ ] O código segue os padrões encontrados (export nomeado, imports relativos, `showToast`, updates imutáveis).
- [ ] O tratamento de erros segue o projeto (mensagens em pt-BR, `{ error }` no servidor).
- [ ] Nenhum log novo no front.
- [ ] Testes no padrão AAA.
- [ ] Sem valores fixos novos: o telefone da oficina e o domínio do portal vão para `src/config/workshop.ts`.
- [ ] CLAUDE.md e README atualizados (3.13).
- [ ] Nada fora do escopo (ver "Fora do escopo").

## Riscos
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| A 1.7 (máquina de estados) mudar um comportamento de que alguma tela dependia | Média | Alto | Antecipar a 3.1 e cobrir `canTransition`; manter a assinatura de `advanceOrderStatus` |
| A 1.10 (limpar dados no logout) surpreender quem testa o demo | Alta | Baixo | Documentar no CLAUDE.md; o mock volta às seeds no próximo login |
| A migração dos 10 modais para `<dialog>` (2.3) quebrar o layout | Média | Médio | Um commit por modal; testar em Chrome Android e Safari iOS |
| A troca de cores (2.11) mudar a identidade visual | Média | Baixo | Usar `Button` com tokens; validar com o usuário numa tela antes de aplicar em todas |
| O `strict: true` (3.4) gerar muitos erros | Alta | Médio | Commits por pasta; `@ts-expect-error` temporário com TODO |
| O endurecimento do servidor (1.21) quebrar o fluxo do mock | Baixa | Médio | Roteiro de `curl` e roteiro manual de login/reauth ao fim |
| O IndexedDB (3.8) ser grande demais | Média | Médio | Marcado como opcional; o debounce sozinho já resolve a trava |

## Notas
- Os itens "na integração" do `seguranca.md` (JWT em memória, refresh em cookie `HttpOnly`, tenant, RFC 9457, portal por token de OS) **não** fazem parte deste plano. Eles mudam o modelo de auth inteiro e merecem um PRD próprio (`/prp-prd integração com srv-lutheria`).
- Os CPFs novos da 1.4 foram calculados com o mesmo algoritmo de `isValidCpf`. O do cli-3 já era válido.
- Confiança na implementação de uma só vez: **6/10 para o plano todo** (escopo XL). Por fase: Fase 1 **8/10**, Fase 2 **7/10** e Fase 3 **6/10**.
