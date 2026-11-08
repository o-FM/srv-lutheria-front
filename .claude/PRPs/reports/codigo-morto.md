# Código morto, duplicado e dependências sem uso: srv-lutheria-front

**Data:** 2026-11-07
**Modo:** **só listagem, nada foi removido.** Nenhum arquivo do projeto foi alterado.
**Escopo:** `src/`, `server.ts`, `vite.config.ts`, `package.json`, `index.html`, `.env.example` e `metadata.json`.

## Como foi levantado

| Fonte | Resultado |
|---|---|
| `npx tsc --noEmit` (o `npm run lint` do projeto) | **Passa**, sem erros. O `node_modules` já estava instalado. |
| `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | **83 ocorrências** de import, variável ou parâmetro sem uso (lista na seção 2). |
| `knip`, `depcheck`, `ts-prune` | **Não executados:** não estão no projeto, e o `npx` baixaria pacotes. Fiz o equivalente com grep e com o `package-lock.json` (quem depende de quem). |
| Grep de exports × imports | Exports e membros de contexto sem consumidor (seções 3 e 4). |
| Duplicação | Leitura completa dos arquivos (feita no code review) mais grep dos padrões repetidos (seção 6). |

Níveis de segurança para uma eventual remoção, seguindo o `/refactor-clean`:
- **SEGURO:** pode remover sem risco.
- **CAUTELA:** confirmar antes.
- **PERIGO:** investigar antes de mexer.

---

## 1. Dependências do `package.json`

| Pacote | Tipo | Situação | Evidência | Nível |
|---|---|---|---|---|
| `@google/genai` | dep | **Sem uso**: nenhum import | grep vazio; ninguém depende dele no lock; ~12 MB em `node_modules/@google` | SEGURO |
| `motion` | dep | **Sem uso**: nenhum import (o CLAUDE.md diz que é usado para animações, mas não é) | grep vazio; traz `framer-motion` (~6 MB) | SEGURO. Atualizar o CLAUDE.md junto |
| `dotenv` | dep | **Sem uso**: `server.ts` não chama `dotenv/config` | grep vazio. Consequência: nenhum `.env` é carregado hoje | SEGURO (ou passar a usar, se o servidor precisar de env) |
| `autoprefixer` | devDep | **Sem uso**: não há `postcss.config`, e o Tailwind v4 com `@tailwindcss/vite` não precisa dele | não há config de PostCSS no repo | SEGURO |
| `esbuild` | devDep | **Redundante como dependência direta**: nenhum import, mas `tsx` e `vite` dependem dele | `package-lock.json`: `esbuild <- tsx, vite` | CAUTELA (sai da lista direta, mas continua instalado via `tsx`) |
| `tsx`, `typescript`, `@types/*`, `tailwindcss` | dev | Usados por scripts, compilador ou tipos (falso positivo de grep) | `npm run dev` usa `tsx`; `lint` usa `tsc` | Manter |

**Arquivos ligados a essas dependências:**
- `.env.example`: `GEMINI_API_KEY` e `APP_URL` não são lidos em lugar nenhum (só existe `process.env.NODE_ENV`/`DISABLE_HMR`). **SEGURO** junto com a remoção do `@google/genai`.
- `metadata.json`: `"majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]` sobrou do AI Studio. **CAUTELA**: só importa se o projeto ainda for publicado pelo AI Studio.
- `bun.lock` duplica o `package-lock.json` (o CLAUDE.md diz que o `package-lock` é a fonte da verdade). **CAUTELA**: confirmar que ninguém usa bun.
- Script `"clean": "rm -rf dist server.js"`: o `server.js` nunca é gerado (o servidor roda com `tsx server.ts`). Além disso, `rm -rf` não funciona no Windows fora do Git Bash. **SEGURO** (ajustar).

> **Não remover:** `DISABLE_HMR` em `vite.config.ts`. Parece sobra do AI Studio, mas o CLAUDE.md manda manter.

---

## 2. Imports, variáveis e parâmetros sem uso (saída do `tsc --noUnusedLocals`)

Todos são **SEGURO**: o compilador garante que o símbolo não é lido.

### 2.1 Ícones `lucide-react` importados e não usados (61)

| Arquivo | Ícones |
|---|---|
| `components/auth/ForgotPasswordModal.tsx:5` | `Mail` |
| `components/auth/LoginPage.tsx:8-14` | `Lock`, `User`, `Sparkles`, `ChevronRight` |
| `components/auth/ReauthBottomSheet.tsx:13` | `CheckCircle2` |
| `components/client-portal/ClientPortalView.tsx:5-15` | `Guitar`, `Camera`, `AlertCircle`, `ChevronRight`, `ArrowLeft` |
| `components/clients/ClientsModule.tsx:4-16` | `Users`, `Guitar`, `ClipboardList`, `ExternalLink`, `CheckCircle2`, `Calendar`, `Sparkles` |
| `components/common/BarcodeScannerModal.tsx:3` | `Sparkles`, `Volume2` |
| `components/common/CameraModal.tsx:6-12` | `FlipHorizontal`, `Sparkles`, `Tag`, `ImageIcon` |
| `components/common/GlobalSearchModal.tsx:9` | `Guitar` |
| `components/common/Header.tsx:15` | `Sparkles` |
| `components/home/HomeModule.tsx:4-15` | `ClipboardList`, `ArrowRight`, `TrendingUp`, `DollarSign` |
| `components/more/MoreModule.tsx:8-15` | `Share2`, `Clock`, `CheckCircle2`, `Phone`, `FileText`, `Sparkles`, `ChevronRight` |
| `components/orders/NewOrderWizardModal.tsx:5-17` | `User`, `Guitar`, `Calendar`, `Sparkles`, `Phone`, `Tag` |
| `components/orders/OrderDetailSheet.tsx:5-23` | `Phone`, `Calendar`, `Share2`, `DollarSign`, `User`, `Guitar`, `AlertCircle`, `FileText`, `ExternalLink`, `Sparkles`, `Layers`, `ShieldAlert` |
| `components/orders/OrdersModule.tsx:6-15` | `Filter`, `AlertTriangle`, `Camera` |
| `components/stock/StockModule.tsx:10-11` | `Layers`, `History` |
| `components/workbench/WorkbenchModeModal.tsx:6-15` | `Mic`, `Sparkles`, `Volume2`, `Guitar` |

O padrão (`Sparkles` em 8 arquivos, `Guitar` em 6) indica imports copiados entre telas geradas pelo protótipo.

### 2.2 Imports de tipos e funções sem uso

| Local | Símbolo |
|---|---|
| `components/auth/ReauthBottomSheet.tsx:5` | `isValidCpf`, `isValidEmail` (importados mas nunca chamados: o reauth não valida o identificador) |
| `components/clients/ClientsModule.tsx:18` | tipos `Client`, `Instrument` |
| `components/orders/OrderDetailSheet.tsx:25` | tipo `ServiceItem` |
| `components/stock/StockModule.tsx:15` | `StockCategory`, `StockItem` (a declaração inteira está sem uso, TS6192) |
| `components/workbench/WorkbenchModeModal.tsx:17` | tipo `Order` |
| `server.ts:1` | `NextFunction` |

### 2.3 Valores desestruturados de `useApp()`/`useAuth()` e nunca usados

| Local | Símbolo |
|---|---|
| `components/client-portal/ClientPortalView.tsx:26-29` | `rejectQuote`, `setRole`, `showToast` |
| `components/clients/ClientsModule.tsx:28` | `setActiveTab` |
| `components/common/Header.tsx:21, 24` | `user`, `setRole` |
| `components/orders/OrderDetailSheet.tsx:44` | `stock` |

### 2.4 Variáveis e parâmetros mortos

| Local | Símbolo | Observação |
|---|---|---|
| `server.ts:299` | `targetUserId` | lido do body e nunca usado |
| `server.ts:510` | `rawDigits` | calculado no `forgot-password` e descartado |
| `components/common/GlobalSearchModal.tsx:98` | parâmetro `clientId` de `handleSelectClient` | **revela um bug**: o clique em cliente não abre o cliente |
| `components/workbench/WorkbenchModeModal.tsx:49` | `[timerPreset, setTimerPreset]` | estado declarado e nunca usado (TS6198) |

### 2.5 Estado morto que o `tsc` não detecta

| Local | Símbolo | Observação |
|---|---|---|
| `components/clients/ClientsModule.tsx:53, 127, 132` | `instNotes`/`setInstNotes` | é lido no submit e limpo, mas **nenhum input o edita**, então vai sempre `''`. SEGURO remover, ou CAUTELA se a ideia era adicionar o campo |

---

## 3. Exports sem consumidor

| Símbolo | Arquivo | Situação | Nível |
|---|---|---|---|
| `ROLE_PERMISSIONS`, `getRolePermissions`, `RolePermissions` | `utils/permissions.ts` | **O módulo inteiro é morto (139 linhas)**: nenhum arquivo o importa. A UI usa ~40 checagens soltas de `currentRole` | **PERIGO**: não remover. É código morto que **deveria estar em uso** (o CLAUDE.md o cita como fonte das permissões da UI). Ver o code review, H9 |
| `maskCpf` | `utils/cpfValidator.ts:59` | Nunca chamado, e por isso o CPF aparece completo em `ClientsModule.tsx:308` | **PERIGO**: o certo é passar a usar, não remover (LGPD) |
| `LoginResponse`, `ReauthResponse`, `AuditLogItem` | `services/authApi.ts` | Exportados mas só usados dentro do próprio arquivo. `AuditLogItem` deveria tipar o `useState<any[]>` em `AccountSettingsModal.tsx:39` | SEGURO tirar o `export` (ou usar `AuditLogItem` onde hoje há `any`) |
| `PartUsage`, `TimelineEvent` | `types/index.ts` | Só usados dentro de `types/index.ts` (compõem `Order`/`ServiceItem`) | Manter (são tipos de domínio). Tirar o `export` não traz ganho |

---

## 4. Métodos de API e membros de contexto nunca chamados

| Símbolo | Local | Situação | Nível |
|---|---|---|---|
| `authApi.getPermissions` | `services/authApi.ts:167-174` | 0 chamadas | CAUTELA: só existe para a regra "permissões no servidor", que não está ligada |
| `authApi.validateAction` | `services/authApi.ts:176-190` | 0 chamadas | CAUTELA (mesmo motivo) |
| `AppContext.updateOrder` | `context/AppContext.tsx:73, 450-454, 909` | 0 consumidores | SEGURO |
| `AppContext.searchQuery`/`setSearchQuery` | `context/AppContext.tsx:38, 56, 144, 882, 896` | 0 consumidores; a busca global usa estado local (`GlobalSearchModal.tsx:31`) | SEGURO |
| `AppContext.rejectQuote` | `context/AppContext.tsx:79, 622-661, 915` | **0 chamadas.** Só é desestruturado (sem uso) no portal. Não há botão "Recusar orçamento" em lugar nenhum, então a recusa é **inalcançável** | CAUTELA: é funcionalidade faltando, não código a apagar |
| `AppContext.setRole` (uso externo) | Header e ClientPortalView | desestruturado sem uso. Continua usado em `AuthGuard`, `LoginPage` e `ReauthBottomSheet` | SEGURO remover só as desestruturações |
| Endpoints `GET /api/auth/permissions` e `POST /api/auth/validate-action` | `server.ts:531-585` | nenhum cliente os chama | CAUTELA (pares dos dois métodos acima) |
| Campo `mockToken` da resposta | `server.ts:517` | gerado e devolvido, mas nunca guardado nem lido no front | SEGURO |

---

## 5. Funcionalidades mortas ou de fachada (CSS, assets, UI)

| Item | Local | Situação | Nível |
|---|---|---|---|
| Fonte **Space Grotesk** | `index.html:17` | carregada do Google Fonts e nunca referenciada (só `Plus Jakarta Sans` é usada em `index.css:12`). Custa uma requisição de rede | SEGURO |
| Variáveis CSS `--sat`, `--sab`, `--sal`, `--sar` | `src/index.css:4-9` | nunca lidas | SEGURO |
| Classe `.pt-safe` | `src/index.css:43-45` | nunca usada (só a `.pb-safe` é) | SEGURO |
| **Modo claro/escuro** | `AppContext.tsx:158-200` e botão em `Header.tsx:138-146` | o toggle adiciona a classe `dark` no `<html>`, mas: (a) o Tailwind v4 usa `prefers-color-scheme` por padrão e não há `@custom-variant dark` em `index.css`; (b) a UI tem cores escuras fixas (`bg-stone-950` etc.); (c) só há 3 usos de `dark:`, todos com a mesma cor do estado claro. **O botão não muda nada na tela** | CAUTELA: decidir entre implementar o tema ou remover toggle, estado e persistência |
| Classes Tailwind inexistentes | `animate-in`, `fade-in`, `zoom-in-95`, `slide-in-from-bottom-3` (vários modais); `hover:bg-stone-850` (`NewOrderWizardModal.tsx:626`, `WorkbenchModeModal.tsx:143`); `active:scale-98`; `py-0.2` (`OrdersModule.tsx:189`); breakpoint `xs:` (`Header.tsx:72`) | não geram CSS (o plugin de animação não está instalado e esses valores não existem na escala padrão) | SEGURO remover, ou instalar `tw-animate-css` se as animações forem desejadas |
| `agendaFilter` | `MoreModule.tsx:43, 155-169` | os botões Hoje/Semana/Todos mudam o estado, mas a lista (`:173`) não filtra | CAUTELA: implementar ou remover os botões |
| `matchedInstruments` | `GlobalSearchModal.tsx:57-62` | calculado e somado ao total, mas nunca renderizado | CAUTELA: é bug, falta o bloco de UI |
| `tag` do `CameraModal` | `CameraModal.tsx:53, 321-347` | o seletor de categoria existe, mas o valor nunca sai do componente (o callback recebe só `url` e `caption`) | CAUTELA: é bug, falta passar a `tag` adiante |
| Payload do `ToastMessage.type 'error'` | `types/index.ts:178`, `ToastContainer.tsx:16` | o ícone de erro existe, mas nenhuma chamada usa `type: 'error'` | Manter (é API de toast; custa pouco) |

---

## 6. Código duplicado

| # | Padrão | Ocorrências | Sugestão de consolidação |
|---|---|---|---|
| D1 | **Máscara "e-mail ou CPF"** (`handleIdentifierChange`, ~14 linhas idênticas) | `LoginPage.tsx:56`, `ReauthBottomSheet.tsx:61`, `ForgotPasswordModal.tsx:16` | hook `useIdentifierInput()` em `utils/` ou `hooks/` |
| D2 | **Máscara de telefone** `(11) 98765-4321` | `NewOrderWizardModal.tsx:123-133`, `ClientsModule.tsx:69-75` | `formatPhone()` em `utils/` |
| D3 | **Máscara de CPF reimplementada** | `ClientsModule.tsx:77-85`, que duplica o `formatCpf` já existente em `utils/cpfValidator.ts:9` | usar `formatCpf` |
| D4 | **Máscara de CPF no servidor** | `server.ts:113-115` (`maskIdentifier`) e `server.ts:182-183` (`sanitizeUser`), que replicam o `maskCpf` do front | função única no servidor (ou módulo compartilhado) |
| D5 | **Timestamp local** `new Date().toISOString().replace('T',' ').substring(0,16)` | 8×: `AppContext.tsx:309, 374, 517, 566, 628, 707`, `OrderDetailSheet.tsx:163`, `NewOrderWizardModal.tsx:178` | `nowTimestamp()`, que também corrige o problema de UTC apontado no code review |
| D6 | **Data** `toISOString().substring(0,10)` | 6×: `AppContext.tsx:382, 383, 688, 691, 743, 762` | `todayDate()` / `addDays()` |
| D7 | **Rótulo de status** `.replace('_', ' ')` | 13×: `ClientPortalView:167`, `ClientsModule:352, 416`, `HomeModule:372`, `MoreModule:217, 284`, `NewOrderWizardModal:446`, `OrderDetailSheet:144, 612`, `OrdersModule:230, 330`, `WorkbenchModeModal:151, 180` | mapa `STATUS_LABEL: Record<OrderStatus, string>` |
| D8 | **Listas de status** (cada uma com uma variação diferente) | `AppContext.tsx:97` (`STATUS_FLOW`), `OrderDetailSheet.tsx:27` (`STATUS_STEPS`), `OrdersModule.tsx:35` (filtros) e `:313` (colunas do Kanban), `ClientPortalView.tsx:60` (passos). O Kanban e o portal omitem `orcamento`/`entregue` | constante única em `src/domain/orderStatus.ts` |
| D9 | **Classes de badge de status** (`em_execucao` âmbar, `pronto` verde…) | `HomeModule.tsx:363-371`, `OrdersModule.tsx:219-229`, `ClientPortalView.tsx:158-166`, `MoreModule.tsx:210-216` | componente `<StatusBadge status>` |
| D10 | **Soma de peças e totais da OS** (`unitPrice * p.quantity` em `reduce`) | `AppContext.tsx:467-472` (`addServiceItem`), `:672-677` (`createOrder`), `OrderDetailSheet.tsx:497-511` (e `:391`) | `computeOrderTotals(services, discount)`, que também corrige a divergência do desconto |
| D11 | **Moeda** `R$ ${x.toFixed(2)}` | 21 ocorrências de `toFixed(` em `src/` | `formatBRL()` com `Intl.NumberFormat('pt-BR')` |
| D12 | **Link de WhatsApp** `window.open('https://wa.me/55…', '_blank')` | 6×: `ClientPortalView:80`, `ClientsModule:215, 267`, `MoreModule:72`, `OrderDetailSheet:146`, `OrdersModule:271` | `openWhatsApp(phone, text?)` (e já com `noopener`) |
| D13 | **Nome do autor da timeline por papel** (`'Armando (Luthier)'`/`'Mariana (Balcão)'`) | `AppContext.tsx:354-359, 533, 597, 711, 801` | helper único, de preferência com `user.name` do `AuthContext` |
| D14 | **Rótulos de papel** em 3 lugares | `AppContext.tsx:264` (`roleLabels` do toast), `Header.tsx:37` (`roleLabels` do menu), `utils/permissions.ts` (`roleLabel`/`roleBadge`, sem uso) | usar `ROLE_PERMISSIONS[role].roleLabel` |
| D15 | **`confetti` com try/catch vazio** | `AppContext.tsx:401-410, 553-561, 809-817` | `celebrate(options)` |
| D16 | **Limpeza das chaves de auth** (4 `removeItem` em sequência) | `AuthContext.tsx:88-91` e `:151-154` | `clearStoredSession()` |
| D17 | **Servidor: verificação de senha** (hash + `timingSafeEqual`) | `server.ts:255-261` (login) e `:348-354` (reauth) | `verifyPassword(user, password)` |
| D18 | **Servidor: busca de usuário por e-mail/CPF e chave de rate limit** | `server.ts:223-225` e `:241-246` (login); `:304-306` e `:322-325` (reauth) | `normalizeIdentifier()` + `findUserByIdentifier()` |
| D19 | **Placeholders de dados inventados** no cadastro rápido | `NewOrderWizardModal.tsx:195-196` e `ClientsModule.tsx:96-97` (cada um com um formato diferente de e-mail e telefone) | remover os dois (ver code review, H7) |
| D20 | **Bloco "entregar no balcão"** (`advanceOrderStatus(id,'entregue',…)` + toast) | `OrderDetailSheet.tsx:119-131` e `:696-707`, `HomeModule.tsx:395-398`, `OrdersModule.tsx:293-296` (cada um com um comportamento de pagamento diferente) | ação de domínio única `deliverOrder(id)` |
| D21 | **Fotos duplicadas nos dados** | as mesmas fotos ficam no instrumento e na OS: `seedData.ts` (`ph-1` a `ph-7` repetidos em `INITIAL_INSTRUMENTS` e `INITIAL_ORDERS`) e `NewOrderWizardModal.tsx:222, 272` (em base64 nos dois) | guardar a foto uma vez e referenciar pelo id |

---

## 7. Dados de seed órfãos ou inconsistentes

| Item | Local | Situação |
|---|---|---|
| Pagamento da `ord-1041` | `seedData.ts:824-836` | aponta para uma OS que não existe nas seeds |
| `stockItemName` divergente | `seedData.ts:228` vs `:629`, e `:453` | o mesmo `stk-1` aparece com 3 nomes diferentes |
| CPFs inválidos | `seedData.ts` (clientes) e `server.ts:73, 86` | não passam em `isValidCpf` |

---

## Resumo

| Categoria | Qtde | Remoção segura? |
|---|---|---|
| Dependências sem uso | 4 (`@google/genai`, `motion`, `dotenv`, `autoprefixer`) + 1 redundante (`esbuild`) | Sim (`esbuild`: cautela). Somam ~18 MB em `node_modules` |
| Imports, variáveis e parâmetros sem uso (`tsc`) | 83 | Sim: o compilador garante |
| Módulos ou exports mortos | `utils/permissions.ts` inteiro, `maskCpf` e 3 tipos de `authApi` | **Não** para `permissions.ts` e `maskCpf`: o certo é passar a usá-los |
| Métodos de API e de contexto sem chamada | 6 (`getPermissions`, `validateAction`, `updateOrder`, `searchQuery`/`setSearchQuery`, `rejectQuote`) e 2 endpoints | Parcial: `rejectQuote` e as permissões são funcionalidades faltando |
| Funcionalidades de fachada | 7 (tema claro/escuro, filtro da agenda, instrumentos na busca, tag da câmera, fonte, variáveis CSS, classes inexistentes) | Decidir caso a caso: implementar ou remover |
| Padrões duplicados | 21 | Consolidar em helpers ou componentes |

**Ordem sugerida, se/quando for limpar:**
1. Remover os 83 itens do `tsc` e ligar `noUnusedLocals`/`noUnusedParameters` no `tsconfig.json` para não voltarem.
2. Tirar `@google/genai`, `motion`, `dotenv` e `autoprefixer` do `package.json`, as variáveis do `.env.example` e a fonte Space Grotesk. Corrigir o CLAUDE.md, que cita `motion` como usado.
3. Consolidar D5, D6, D7, D11 e D12 (helpers puros, fáceis de testar com Vitest).
4. Fazer o restante (D8, D10, D13, D20 e as permissões) junto com as correções de regra de negócio do code review, porque mexe em comportamento.
