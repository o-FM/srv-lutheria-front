# Relatório de Performance: srv-lutheria-front

**Data:** 2026-11-07
**Modo:** somente leitura. Nenhum arquivo do repositório foi editado ou criado. O build rodou numa pasta temporária, depois removida.
- O `git status` final mostra só `?? .claude/PRPs/`, a pasta destes relatórios.
- Não há `dist/` no repositório.

**Autor:** agente `performance-optimizer`. A ausência de artefatos de build no repositório foi reconferida pela sessão principal.

## 1. Escopo

React 19 + TypeScript + Vite 8.3.4 + Tailwind v4, mobile-first, pensado para celular de oficina (aparelho possivelmente modesto). A análise cobre quatro áreas:
1. re-renders do `AppContext` e do `AuthContext`;
2. bundle e carregamento;
3. volume e custo do `localStorage`;
4. memoização, listas, animações e timers.

**O que é medido e o que é estimado:**
- **Não houve medição em runtime:** nenhum servidor foi iniciado e o Profiler não foi usado. Tudo sobre re-render ou tempo de CPU é **estimativa por análise estática**, marcada como tal.
- **Medido de verdade:** os tamanhos de build e os bytes das seeds no `localStorage`.

## 2. Metodologia (comandos e resultados reais)

| # | Comando ou ação | Resultado |
|---|---|---|
| 1 | `npx vite build --outDir <scratchpad>/dist-perf --emptyOutDir --sourcemap` (a partir da raiz) | Concluiu em 1,11 s, com 1686 módulos. Único aviso: o `configLoader: 'native'` reclama de `__dirname` em `vite.config.ts:11`. Nenhum aviso de chunk grande. |
| 2 | Script Node próprio lendo o `.js.map` | 98 fontes. **`@google/genai` e `motion` não aparecem**, ou seja, não entram no bundle. |
| 3 | `npx tsx` importando `src/data/seedData.ts` e medindo o `JSON.stringify` de cada coleção | Ver a tabela de métricas. |
| 4 | Grep de `useApp()`/`useAuth()`, `useMemo\|memo\|useCallback\|lazy`, `setInterval`, `animate-pulse`, `backdrop-blur`, `<img` e `localStorage` | Citados nos achados. |
| 5 | Leitura de `AppContext.tsx` (completo), `App.tsx`, `CameraModal`, `NewOrderWizardModal`, `GlobalSearchModal`, `WorkbenchModeModal`, `LoginPage`, `AuthContext` e trechos dos módulos de lista | Citados nos achados. |
| 6 | Limpeza | A pasta `dist-perf` do scratchpad foi removida. |

**Limitação da atribuição por módulo:** os tamanhos por módulo somam o código-fonte (`sourcesContent`) antes da minificação. Servem para comparar proporções, não como bytes finais. O `--sourcemap` foi usado só nesta análise; o build padrão do projeto não gera map.

## 3. Métricas medidas

### Bundle (build de produção)

| Artefato | Raw | Gzip | Orçamento (app page) | Status |
|---|---|---|---|---|
| `index-*.js` (chunk único) | 456,24 kB | **121,78 kB** | JS < 300 kB gz | OK (41% do orçamento) |
| `index-*.css` | 62,26 kB | **10,33 kB** | CSS < 50 kB | OK em gzip. O orçamento da regra é em gzip. |
| `index.html` | 1,70 kB | 0,73 kB | n/a | OK |
| Nº de chunks JS | **1** | n/a | n/a | Sem code splitting |

### Maiores módulos no bundle (código-fonte antes de minificar)

| Módulo | KB de fonte |
|---|---|
| react-dom | 635 |
| lucide-react (só os ícones usados) | 37,7 |
| OrderDetailSheet | 34,9 |
| AppContext | 30,8 |
| NewOrderWizardModal | 30,7 |
| ClientsModule | 27,5 |
| seedData.ts | 26,8 |
| canvas-confetti | 24,9 |
| HomeModule | 19,5 |
| react | 19,4 |
| OrdersModule | 17,6 |
| MoreModule | 17,6 |
| CameraModal | 16,4 |
| LoginPage | 15,0 |
| WorkbenchModeModal | 13,8 |
| StockModule | 13,0 |
| ClientPortalView | 12,8 |

### Seeds no `localStorage` (medido)

| Coleção | Itens | Bytes (UTF-8) |
|---|---|---|
| `luthier_clients` | 5 | 1.867 |
| `luthier_instruments` | 5 | 3.815 |
| `luthier_orders` | 5 | 10.108 |
| `luthier_stock` | 12 | 3.413 |
| `luthier_payments` | 3 | 808 |
| `luthier_movements` | 3 | 617 |
| **Total** | n/a | **20.628 B (20,1 KB)** |

Em UTF-16 (~2 B por caractere) são ~41 KB, ou **0,79% de uma cota de 5 MB**. Uma OS semeada tem ~2.000 caracteres. As 7 fotos semeadas são URLs do Unsplash, não base64.

---

## 4. Achados

### Área 1: re-renders e contexto

**1.1 [HIGH, estimado] O valor do `AppContext` é um objeto novo a cada render, sem `useMemo`.**
- **Onde:** `AppContext.tsx:870-925`.
- **Problema:** o provider tem ~50 campos, com 6 coleções de domínio e estado de UI. Qualquer `setState` (toast, `isSearchOpen`, `activeTab`, marcar checklist) re-renderiza todos os consumidores.
- **Consumidores:**
  - `useApp()`: 20 arquivos.
  - `useAuth()`: 7 arquivos.
  - Com usuário logado, ~14 consumidores de `useApp` ficam montados ao mesmo tempo: MainLayout, AuthGuard, Header, BottomTabBar, 1 módulo de aba e 9 modais/sheets que estão sempre montados.
- **Impacto hoje:** baixo, porque há só 5 OS. O custo cresce com o volume de dados e de DOM.

**1.2 [MEDIUM] Os filhos do MainLayout re-renderizam sempre, e os modais fechados executam hooks à toa.**
- **Onde:** `App.tsx:25-77`.
- **Problema:** o `MainLayout` chama `useApp()` e recria `<Header/>`, `<BottomTabBar/>` e os 9 modais, nenhum com `React.memo`. Inclusive o `ForgotPasswordModal`, que só usa `useAuth`.
- **Modais fechados:**
  - Retornam `null` cedo, mas os hooks antes do `return` rodam em todo render: `CameraModal:62-74`, `NewOrderWizardModal:90-112` e `AccountSettingsModal`.
  - O pior caso é o `WorkbenchModeModal`: o `orders.filter(...)` da linha 38 roda antes do `return null` da linha 70, mesmo com o modal fechado. (Esse mesmo trecho é o que derruba o app ao abrir a bancada, por causa dos hooks depois do `return`; ver o code review.)
- **Correção** (serve também para code splitting, ver 2.3):
  ```tsx
  {isWorkbenchModeOpen && <Suspense fallback={null}><WorkbenchModeModal /></Suspense>}
  {activeOrderId && <Suspense fallback={null}><OrderDetailSheet /></Suspense>}
  ```

**1.3 [MEDIUM] Toasts, `isSearchOpen` e `triggerHaptic`.**
- **Toasts:** cada `showToast` gera 2 renders do provider, um ao adicionar e outro 4,5 s depois ao remover (`AppContext.tsx:212-221`). Cada um re-renderiza ~14 consumidores, inclusive a lista da aba ativa. Quase toda ação de domínio chama `showToast`, então uma ação vira 3 renders.
- **`isSearchOpen`:** só re-renderiza ao abrir ou fechar a busca. Custo baixo.
- **`triggerHaptic`:** não toca em estado (`:202-210`), então não causa re-render.
- **`searchQuery`/`setSearchQuery`:** estado morto no contexto (nenhum uso fora do `AppContext`).

**1.4 [LOW] Timers e digitação em inputs.**
- **Bancada:**
  - O contador fica em estado local do `WorkbenchModeModal`, então não passa pelo contexto.
  - Porém `timerSeconds` está nas deps do `useEffect` (`:53-70`), e o `setInterval` é recriado a cada segundo e acumula atraso.
  - Correção: deps `[isTimerRunning]`, updater funcional para decrementar e tratar o fim da contagem num efeito separado.
- **LoginPage:** o mesmo padrão com `lockedInfo` (`:41-54`). O estado é local.
- **Inputs:** o texto digitado fica em estado local em `ClientsModule`, no wizard, no `GlobalSearchModal` e no `LoginPage`. Digitar **não** re-renderiza o contexto.
- **Rascunho do wizard (`:104-112`):** faz `setItem` síncrono a cada tecla. Um debounce de ~400 ms resolve.
- **AuthContext:** o valor também é um objeto literal, mas o provider muda pouco. Os listeners de inatividade são baratos; registrá-los com `{ passive: true }` é boa prática.

**1.5 [MEDIUM, estimado] Listas com `.find`/`.filter` dentro de `.map` (O(n·m)), recalculadas a cada render.**

| Arquivo:linha | Padrão | Custo |
|---|---|---|
| `OrdersModule.tsx:46-51` | `filter` das OS com `clients.find` e `instruments.find` dentro | O(OS × (clientes + instrumentos)) |
| `OrdersModule.tsx:125` | `orders.filter` para cada opção de status | ~8 × n por render |
| `OrdersModule.tsx:157-160` | 2 `find` + `services.filter` por card | n × (c + i) |
| `OrdersModule.tsx:322,339-340` | Kanban: `filter` por coluna e 2 `find` por card | idem |
| `ClientsModule.tsx:170-172` | `instruments.filter` + `orders.filter` por cliente | O(c × (i + o)) |
| `HomeModule.tsx:38-46` | 5 passadas sobre `orders` e 1 sobre `stock` | 6 × n |
| `MoreModule.tsx:173-175, 307-309` | `orders.map` com `find` de cliente e instrumento | O(n × (c + i)) |
| `BottomTabBar.tsx:29-33` | `orders.filter` + `stock.filter` em **todo** render do app (está sempre montado) | O(n + s) |
| `GlobalSearchModal.tsx:31` | **o único `useMemo` do projeto**, mas o filtro faz `find` por OS a cada tecla, sem debounce | O(n × (c + i)) por tecla |

- **Ordem de grandeza (estimada):** 500 OS, 500 clientes e 800 instrumentos dão ~650 mil comparações por render de lista. São poucos ms no desktop e talvez 4 a 6× isso num aparelho modesto. O custo dominante tende a ser reconciliar 500 cards sem virtualização.
- **Correção:**
  ```tsx
  const clientById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const instById   = useMemo(() => new Map(instruments.map(i => [i.id, i])), [instruments]);
  // uso: clientById.get(o.clientId)  // O(1)
  ```
  Melhor ainda: expor esses mapas prontos no contexto de dados.

**1.6 [MEDIUM] O `useCallback` das ações perde efeito por dependências instáveis.**

| Ação | Linha | Dependências instáveis |
|---|---|---|
| `updateStockQuantity` | 318 | `[stock]` |
| `advanceOrderStatus` | 447 | `currentRole`, `syncStatus` e `updateStockQuantity`, que herda a instabilidade de `stock` |
| `approveQuote` | 619 | `updateStockQuantity`, `currentRole` |
| `createOrder` | 734 | `[orders, clients, …]`; usa `orders` só para calcular o próximo número |
| `recordPayment` | 827 | `payments.length` |
| `addOrderPhoto`, `rejectQuote` | n/a | `currentRole` |

- **Custo hoje:** nenhum extra. Não há `React.memo` em consumidor nenhum e o valor do provider já muda sempre, então esses `useCallback` são inertes.
- **Quando passa a importar:** depois que houver memoização nos filhos.
- **Correção:** ler o estado dentro do updater (`setOrders(prev => …)`) ou guardá-lo em `useRef`.

**1.7 [MEDIUM, correção de comportamento] Efeitos colaterais dentro dos updaters de `setOrders`.**
- **Onde:** `AppContext.tsx:326-445, 563-611`.
- **Problema:** `showToast`, `updateStockQuantity`, `confetti` e `setOfflineQueueCount` rodam dentro de `setOrders(prev => …)`. Como não há `<StrictMode>`, hoje nada é duplicado. Com StrictMode, React Compiler ou uma store, a baixa de estoque e os toasts podem rodar duas vezes.
- **Ids repetidos:** `'mov-' + Date.now()` (`:306`) repete o id no mesmo milissegundo, gerando keys duplicadas em `StockModule.tsx:295-297`.

### Área 2: bundle e carregamento

**2.1 [OK] Orçamento atendido.** O JS tem 121,78 kB gz (limite 300) e o CSS, 10,33 kB gz (limite 50).

**2.2 [OK] Dependências não importadas ficam fora do bundle.**
- `@google/genai` e `motion` não aparecem em nenhuma das 98 fontes. Tirá-los do `package.json` limpa o `npm ci` sem mudar o que é entregue.
- O tree-shaking do `lucide-react` funciona: ~37,7 kB de fonte, só os ícones usados.
- O `canvas-confetti` (~25 kB de fonte) entra no chunk único por um import estático em `AppContext.tsx:2`.

**2.3 [LOW, MEDIUM em aparelho modesto] Sem code splitting: o app inteiro é baixado e interpretado antes do login.**
- **Candidatos a `React.lazy`/`import()`** (KB de fonte):
  - OrderDetailSheet (34,9)
  - NewOrderWizardModal (30,7)
  - ClientsModule (27,5)
  - canvas-confetti (24,9)
  - MoreModule (17,6)
  - CameraModal (16,4)
  - WorkbenchModeModal (13,8)
  - StockModule (13,0)
  - ClientPortalView (12,8)
- **Economia estimada:** ~20-30 kB gz. O ganho principal é menos tempo de parse e execução no aparelho, não menos rede.
- **Correção:**
  ```tsx
  const OrderDetailSheet = lazy(() =>
    import('./components/orders/OrderDetailSheet').then(m => ({ default: m.OrderDetailSheet })));
  const fireConfetti = async (opts: confetti.Options) => (await import('canvas-confetti')).default(opts);
  ```
  O `.then(m => ({ default: … }))` é necessário porque os componentes usam export nomeado. Combinado com a montagem condicional (1.2), os modais fechados deixam de renderizar.

**2.4 [LOW] `index.html`: fontes e imagens.**
- **Fontes:**
  - `index.html:17` carrega duas famílias, mas só a Plus Jakarta Sans é usada (`index.css:12`). Remover `&family=Space+Grotesk…` tira CSS que bloqueia a renderização.
  - O `preconnect` já existe.
  - Vale considerar hospedar a fonte localmente: o app tem modo offline, e fontes externas falham sem rede.
- **Imagens:**
  - Nenhum `<img>` tem `loading="lazy"`: `OrdersModule:181`, `ClientsModule:188,294`, `HomeModule:339`, `OrderDetailSheet:447`, `ClientPortalView:274`, `NewOrderWizardModal:540` e `CameraModal:198`.
  - Adicionar `loading="lazy" decoding="async"` não custa quase nada.
  - As URLs do Unsplash já pedem `?w=600`.

### Área 3: `localStorage` e fotos

**3.1 [CRITICAL] Fotos em base64 sem redimensionar estouram a cota e derrubam o app.**
- **Origem:**
  - `CameraModal.tsx:275-277` usa `<input type="file" accept="image/*" capture="environment">`. No celular, isso abre a câmera nativa e devolve o JPEG em resolução cheia (tipicamente 12 MP).
  - `readAsDataURL` (`:125`) grava esse arquivo sem reduzir.
  - A webcam (`:79`, `ideal: 1280`; `toDataURL('image/jpeg', 0.85)` em `:106`) gera frames menores.

| Foto (estimativa por tamanho típico) | Base64 (caracteres, ×1,37) | 1 cópia vs. cota (~5 M caracteres) |
|---|---|---|
| 2 MB (12 MP leve) | ~2,67 M | 53% |
| 3 MB (12 MP típico) | ~4,0 M | 80% |
| 4 MB | ~5,3 M | 107%: estoura sozinha |
| Frame de webcam ~200 KB | ~0,27 M | cabem ~9 fotos, já contando a cópia dupla |

- **Duplicação:** no `NewOrderWizardModal`, as mesmas fotos vão para `createInstrument(…, photos)` (`:212-222`, quando o instrumento é novo) e para `createOrder` (`:272`). Com cópia dupla, **uma única foto de 2 MB já passa de ~5 M caracteres**.
- **Consequência:**
  - O `setItem` em `AppContext.tsx:169-191` não tem `try/catch`. O `QuotaExceededError` é lançado dentro do `useEffect` e, sem Error Boundary, **a tela fica branca**.
  - O dado chega à memória mas não é salvo. Ao recarregar, a OS e a foto somem.
  - A leitura inicial (`JSON.parse` em `:109-137`) também não tem `try/catch`.
- **Correção em duas camadas:**
  1. Reduzir a foto antes de guardar (~1600 px, JPEG 0,7, ≈150-300 KB):
     ```ts
     async function downscale(file: Blob, max = 1600, q = 0.7): Promise<Blob> {
       const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
       const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
       const c = new OffscreenCanvas(Math.round(bmp.width * r), Math.round(bmp.height * r));
       c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
       return c.convertToBlob({ type: 'image/jpeg', quality: q });
     }
     ```
  2. Guardar as fotos como blobs no **IndexedDB** e deixar no estado só uma referência. Até lá, `try/catch` em todo `setItem`, com toast avisando o usuário, e um Error Boundary no topo. Com o backend, a foto vai por upload multipart ou URL pré-assinada, e o estado guarda só a URL.

**3.2 [HIGH, estimado] `JSON.stringify` + `setItem` síncronos na thread principal.**
- **Onde:** `AppContext.tsx:177-179`.
- **Problema:** cada mudança em `orders` (marcar checklist, avançar status, adicionar foto) serializa o array inteiro, **com todas as fotos em base64**.
- **Custo estimado:** com 4 MB de dados, dezenas de ms por interação, e algumas vezes isso num aparelho modesto.
- **Atenuante:** os 6 efeitos são separados, então só a coleção alterada é regravada. O problema é que `orders` carrega o peso das fotos.
- **Correção:**
  - Separar as fotos das OS.
  - Debounce de ~500 ms, salvando também em `visibilitychange`/`pagehide`.
  - Migrar para IndexedDB (assíncrono).

**3.3 [MEDIUM] Limpeza de dados.**
- `resetToDefaults` (`:850-867`) remove as 6 chaves de domínio.
- `logout` (`AuthContext.tsx:151-154`) remove só o token e o usuário: **os dados de domínio ficam**. Num aparelho compartilhado, o próximo usuário vê as OS, os clientes e os CPFs do anterior. Ver o `seguranca.md`, C-02.

### Área 4: memoização, listas e animações

**4.1 [MEDIUM] Onde a memoização faria diferença.**
- **Valor dos providers:** `AppContext` e `AuthContext` não usam `useMemo`. Só ajuda junto com a divisão do contexto; sozinho não resolve, porque as coleções mudam.
- **Valores derivados:** mapas por id, `activeOrders`, contagens de status e KPIs da Home. É aqui que `useMemo` com deps `[orders]` compensa.
- **Itens de lista:** cards de OS e linhas de cliente são JSX inline no `.map`. Extraí-los com `React.memo` só vale depois de dividir o contexto.

**4.2 [LOW] Onde a memoização seria inútil.**
- Os `useCallback` de `setX`, `triggerHaptic` e `showToast` já são estáveis.
- Memoizar JSX estático, classes do Tailwind ou arrays constantes pequenos não traz ganho.
- Funções inline em botões isolados não pesam.
- A regra do projeto (`react/hooks.md`) diz "não memoizar por padrão". A prioridade é a estrutura do contexto e os índices.

**4.3 [MEDIUM] Listas sem virtualização que crescem sem limite.**
- `StockModule.tsx:295` renderiza todos os `stockMovements`, e essa lista só cresce.
- `OrdersModule.tsx:157,338`, `MoreModule.tsx:173,261,307` e `ClientsModule.tsx:170` renderizam todas as OS, pagamentos e clientes.
- A timeline do `OrderDetailSheet` também cresce a cada ação.
- Com o backend, paginação no servidor resolve. Até lá: `slice(0, 50)` com "ver mais", ou `react-window`.

**4.4 [LOW] Animações e GPU no celular.**
- **`backdrop-blur` em overlays de tela cheia:**
  - Telas: `OrderDetailSheet:173`, `NewOrderWizardModal:286`, `CameraModal:174`, `GlobalSearchModal:113`, `BarcodeScannerModal:52`, `ReauthBottomSheet:138`, `AccountSettingsModal:110`, `ForgotPasswordModal:51` e `ClientsModule:427,546`.
  - Há ainda blur permanente no `BottomTabBar:38`, com a lista rolando por baixo, e no `ToastContainer:27`.
  - É uma das operações mais caras para a GPU de um aparelho fraco, e o fundo já é `bg-black/80`.
  - Correção: remover o blur dos overlays e usar `bg-black/90`.
- **`animate-pulse` em vários badges:** `Header:108`, `OrdersModule:222`, `ClientPortalView:161,198`, `NewOrderWizardModal:579`, `CameraModal:360`, `WorkbenchModeModal:100` e `AuthGuard:21`.
  - A animação é só de opacidade, então barata por elemento, mas várias pulsando juntas gastam bateria.
  - Correção: limitar a 1 ou 2 e usar `motion-safe:animate-pulse`.

---

## 5. Tabela-resumo

| # | Achado | Severidade | Arquivo:linha | Esforço |
|---|---|---|---|---|
| 3.1 | Fotos em base64 em resolução cheia, duplicadas, sem `try/catch`: QuotaExceeded deixa a tela branca | **CRITICAL** | `CameraModal.tsx:106,125,277`; `NewOrderWizardModal.tsx:212-222,272`; `AppContext.tsx:169-191` | Médio |
| 1.1 | Valor do contexto novo a cada render; ~50 campos; tudo re-renderiza | HIGH (estimado) | `AppContext.tsx:870-925` | Estrutural |
| 3.2 | `JSON.stringify` + `setItem` síncronos do `orders` inteiro a cada mudança | HIGH (estimado) | `AppContext.tsx:177-179` | Pequeno a médio |
| 1.2 | Filhos do MainLayout e modais fechados re-renderizam; O(n) no Workbench antes do `return null` | MEDIUM | `App.tsx:25-77`; `WorkbenchModeModal.tsx:38,70` | Pequeno |
| 1.3 | Cada toast gera 2 renders do provider; `searchQuery` é estado morto | MEDIUM | `AppContext.tsx:212-221,144` | Pequeno |
| 1.5 | `.find`/`.filter` dentro de `.map`, recalculados a cada render | MEDIUM (estimado) | `OrdersModule`, `ClientsModule`, `HomeModule`, `MoreModule`, `BottomTabBar` | Pequeno |
| 1.6 | `useCallback` inertes por dependências instáveis | MEDIUM | `AppContext.tsx:318,447,619,734,827` | Pequeno |
| 1.7 | Efeitos colaterais dentro de updaters; ids `mov-Date.now()` repetidos | MEDIUM | `AppContext.tsx:326-445,563-611,306` | Pequeno |
| 3.3 | Logout não limpa os dados de domínio | MEDIUM | `AuthContext.tsx:151-154` | Pequeno |
| 4.3 | Listas sem virtualização nem paginação | MEDIUM | `StockModule:295`; `OrdersModule`; `MoreModule` | Médio |
| 2.3 | Sem code splitting; confetti importado estaticamente | LOW (MEDIUM em aparelho fraco) | `App.tsx:3-20`; `AppContext.tsx:2` | Pequeno |
| 2.4 | Fonte Space Grotesk sem uso; imagens sem `loading="lazy"` | LOW | `index.html:17`; `<img>` listados | Trivial |
| 1.4 | Intervals recriados a cada segundo; rascunho salvo a cada tecla | LOW | `WorkbenchModeModal:53-70`; `LoginPage:41-54`; `NewOrderWizardModal:104-112` | Trivial |
| 4.4 | `backdrop-blur` em tela cheia; `animate-pulse` em excesso | LOW | ver 4.4 | Trivial |
| 2.1/2.2 | Bundle dentro do orçamento; `motion` e `@google/genai` fora do bundle | OK | n/a | n/a |

## 6. Recomendações priorizadas

### Quick wins (horas)
1. **Proteger a persistência:**
   - `try/catch` em todo `setItem` e `JSON.parse`, mais um Error Boundary.
   - Redimensionar as fotos (~1600 px, JPEG 0,7).
   - Não gravar a mesma foto no instrumento e na OS.
2. Debounce da persistência (~500 ms), salvando também em `pagehide`.
3. Montagem condicional e `React.lazy` dos modais, e `import()` dinâmico do `canvas-confetti`.
4. Mapas por id (`clientById`, `instrumentById`) e `useMemo` nos KPIs da Home, de Orders e do BottomTabBar.
5. Remover a Space Grotesk do `index.html` e colocar `loading="lazy" decoding="async"` nas imagens de lista.
6. Remover o `backdrop-blur` dos overlays de tela cheia e usar `motion-safe:animate-pulse`.
7. Corrigir os intervals do Workbench e da LoginPage.
8. Remover:
   - o `searchQuery` morto;
   - `motion` e `@google/genai` do `package.json`.

   E limpar os dados de domínio no logout.

### Estruturais
1. **Dividir o `AppContext`** por domínio e frequência de atualização: `DataContext`, `UiContext`, `ToastContext` e `CameraContext`, cada um com `useMemo` no valor. Alternativas: uma store com seletores (Zustand ou `useSyncExternalStore`) ou o React Compiler, este só depois de tornar os updaters puros.
2. Extrair os itens de lista em componentes `React.memo`, depois de dividir o contexto.
3. Paginação e virtualização de `stockMovements`, OS e timeline.
4. Code splitting por aba, com o login separado do app autenticado.
5. Ações de domínio puras antes de ligar `StrictMode` ou o Compiler.

### O que perde sentido com a integração ao backend Spring Boot
- **Deixa de valer:**
  - Persistência das 6 coleções em `localStorage`, junto com o debounce, a cota e o custo do `JSON.stringify`.
  - O `AppContext` como dono dos dados. O estado de servidor passa para um cache de queries (TanStack Query ou SWR), com paginação no servidor.
- **Muda de forma:**
  - A divisão de contexto passa a valer só para o estado de UI.
  - As fotos viram upload, e o front guarda apenas a URL. Redimensionar no cliente continua útil para economizar rede.
- **Continua valendo:**
  - Code splitting e `lazy` dos modais.
  - Mapas por id.
  - Ajustes de blur e pulse.
  - Remoção da fonte sem uso e `loading="lazy"`.
- **Vira requisito:** limpar o cache no logout e na troca de tenant (`tid` do JWT).

## 7. Arquivos relevantes
- `src/context/AppContext.tsx`
- `src/context/AuthContext.tsx`
- `src/App.tsx`
- `src/components/common/CameraModal.tsx`
- `src/components/orders/NewOrderWizardModal.tsx`
- `src/components/workbench/WorkbenchModeModal.tsx`
- `src/components/auth/LoginPage.tsx`
- `index.html`
