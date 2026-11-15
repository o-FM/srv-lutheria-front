# Revisão React: srv-lutheria-front

**Data:** 2026-11-07
**Escopo:** todo o código em `src/` (24 `.tsx`, contextos, serviços, utils) e `server.ts`. Revisão completa, não de diff (não havia alterações pendentes).
**Método:** `react-reviewer` (lane React: hooks, JSX, a11y, segurança React, render) e `typescript-reviewer` (lane TS/Node: `server.ts`, `authApi`, contextos, tipos), em paralelo. Os achados CRITICAL e os principais HIGH foram reconferidos manualmente no código (marcados *verificado*).
**Decisão:** **BLOQUEIA** (1 CRITICAL e vários HIGH)

---

## Checagens automáticas

| Checagem | Resultado |
|---|---|
| `npm run lint` (`tsc --noEmit`) | **Não executado**: não há `node_modules` e, como a revisão é só de análise, não instalei |
| `npm run build` | **Não executado** (mesmo motivo) |
| ESLint + `react-hooks` + `jsx-a11y` | **Ausente**: não há config de ESLint. É um problema **HIGH** de configuração, porque esses plugins pegariam o C1 e boa parte dos itens de a11y |
| `npm audit` | **1 HIGH**: `body-parser <1.20.9` (DoS, GHSA-27r3-jxmh-p828), via `express`. Corrigível com `npm audit fix` |
| Testes | Não existem (sem runner configurado) |

---

## CRITICAL

### C1. Hooks depois de `return` condicional: abrir o Modo Bancada derruba o app
- **Onde:** `src/components/workbench/WorkbenchModeModal.tsx:35`, com hooks em `:42`, `:47-49` e `:51`. *(verificado)*
- **Problema:** `if (!isWorkbenchModeOpen || currentRole !== 'luthier') return null;` vem antes de `useState` e `useEffect`.
- **Por que importa:** o componente fica sempre montado em `App.tsx`. Ao abrir a bancada, a quantidade de hooks muda e o React lança "Rendered more hooks than during the previous render". Como não há Error Boundary, a tela fica branca. Acontece pelo botão "Bancada" do Header e pelo atalho da Home.
- **Correção:** subir todos os hooks para antes do `return`. Melhor ainda, extrair um `WorkbenchContent` que só monta quando aberto, o que também reseta o timer. O guard repetido em `:70` fica redundante.

---

## HIGH

### Hooks, estado e efeitos

**H1. Efeitos colaterais dentro de updaters de `setState`**
- **Onde:** `AppContext.tsx:326-445`, `:563-611` e `:234-257`.
- **Problema:** `advanceOrderStatus` chama `showToast`, `updateStockQuantity`, `confetti` e `setOfflineQueueCount` dentro de `setOrders(prev => …)`. `approveQuote` baixa estoque dentro do `map`. `toggleSyncStatus` chama `showToast` e agenda `setTimeout` dentro de `setSyncStatus`.
- **Por que importa:** updaters devem ser puros. Com `StrictMode` (hoje ausente em `main.tsx`) ou numa reexecução concorrente, a baixa de estoque, o toast e o timer rodam duas vezes.
- **Correção:** decidir fora do updater (com o estado atual ou um ref) e só então disparar os efeitos. Idealmente, usar `useReducer` com ações de domínio.

**H2. Regras de estoque e status inconsistentes**
- **Onde:** `AppContext.tsx`.
- **Problemas:**
  - `:386-397`: baixar peças ao entrar em `em_execucao` não tem guarda. Clicar de novo no passo "Em Execução" do stepper (`OrderDetailSheet.tsx:112-117`) desconta as peças outra vez.
  - `:550-611`: `approveQuote` força `em_execucao` a partir de qualquer status. O botão "Aprovar" (`OrderDetailSheet.tsx:551-560`) aparece sempre que `quote.status !== 'aprovado'`, inclusive em OS entregue: reabre a OS e desconta o estoque de novo.
  - `:418-427`: o "Desfazer" restaura só a ordem, não o estoque nem os `stockMovements`.
  - `:306` e outros: ids gerados com `'mov-' + Date.now()` colidem quando várias peças baixam no mesmo milissegundo, o que gera `key` duplicado em `StockModule.tsx`.
- **Correção:**
  - Guardas de transição (permitir a mudança só a partir de status específicos).
  - Uma função única de domínio para cada transição.
  - Ids gerados com `crypto.randomUUID()`.

**H3. Modais sempre montados não resetam o estado**
- **`AccountSettingsModal.tsx:29-30` e `:38-39`** *(verificado)*:
  - `useState(user?.email)` roda uma vez só. Depois de trocar de perfil, o form mantém o e-mail do usuário anterior, e o `handleSave` envia esse e-mail como alteração da conta nova.
  - Os logs de auditoria também persistem entre perfis.
- **`NewOrderWizardModal.tsx:63-88`:**
  - Depois de concluir ou fechar, a próxima abertura volta no passo 3 com as seleções antigas.
  - Trocar o cliente não limpa `selectedInstrumentId` (`:377-380`), então a OS pode ser criada com o instrumento de outro cliente.
- **`OrderDetailSheet.tsx:57-65`:** a aba ativa e o formulário de pagamento passam de uma OS para a outra.
- **Correção:** montar o conteúdo só quando o modal estiver aberto, ou usar `key={user.id}` / `key={activeOrderId}`. Além disso, limpar `selectedInstrumentId` ao trocar de cliente e validar que `instrument.clientId === clientId`.

**H4. A câmera ao vivo nunca exibe vídeo**
- **Onde:** `CameraModal.tsx:76-95`. *(verificado)*
- **Problema:** `videoRef.current.srcObject = stream` roda antes de `setIsWebcamActive(true)`, mas o `<video>` (`:204`) só é renderizado quando `isWebcamActive` é verdadeiro. O ref está `null`, então o LED da câmera acende e a tela fica preta.
- **Agravante:** o efeito de limpeza (`:62-72`) não cobre o unmount nem um `getUserMedia` que resolva depois de o modal fechar, e o stream vaza.
- **Correção:** um `useEffect` que, quando `isWebcamActive` for verdadeiro, liga `streamRef.current` ao `<video>` e chama `play()`. Somar a isso o cleanup no unmount.

**H5. `JSON.parse` sem proteção na inicialização e nenhum Error Boundary**
- **Onde:** `AuthContext.tsx:55-58` *(verificado)*; `AppContext.tsx:109-137` (6 ocorrências); `main.tsx`.
- **Por que importa:** um valor corrompido ou de versão antiga em `luthier_*` lança erro no `useState` inicial e a tela fica branca, sem recuperação a não ser limpando o storage.
- **Correção:** um helper `loadJson(key, fallback, guard)` com try/catch, que remove a chave inválida, mais um Error Boundary no topo (`react-error-boundary`).

**H6. Gravação em `localStorage` sem tratamento, com fotos em base64**
- **Onde:** `AppContext.tsx:169-191`.
- **Problema:** cada mudança serializa `orders` e `instruments` inteiros, incluindo data URLs das fotos.
- **Por que importa:** passando de ~5 MB, o `setItem` lança `QuotaExceededError` dentro do efeito e derruba a árvore. Também roda um `JSON.stringify` de MBs na thread principal a cada edição.
- **Correção:**
  - `try/catch` com toast avisando o usuário.
  - Comprimir e redimensionar as fotos via canvas.
  - Mover as fotos para o IndexedDB ou para o backend.

### Acessibilidade e ergonomia

**H7. O reauth abre por baixo do modal de Conta (fluxo trava)**
- **Onde:** `App.tsx:65-66`. *(verificado)*
- **Problema:** `ReauthBottomSheet` e `AccountSettingsModal` usam `fixed inset-0 z-50`, e o modal de Conta vem depois no DOM, então pinta por cima. "Salvar dados sensíveis" abre o reauth escondido e a promise nunca resolve.
- **Correção:** dar `z-[60]` ao reauth ou criar camadas padronizadas com `createPortal`.

**H8. Modais sem semântica de diálogo**
- **Onde:** `CameraModal`, `BarcodeScannerModal`, `GlobalSearchModal`, `NewOrderWizardModal`, `OrderDetailSheet`, `WorkbenchModeModal`, `AccountSettingsModal`, `ForgotPasswordModal` e os 2 modais de `ClientsModule`.
- **Problema:**
  - Só o `ReauthBottomSheet` tem `role="dialog"` e `aria-modal`.
  - Nenhum modal fecha com Escape, prende o foco, devolve o foco ao fechar ou trava o scroll do `body`.
- **Correção:** um componente `Modal` compartilhado (ou `<dialog>` nativo / Radix).

**H9. `div onClick` usado como controle interativo**
- **Onde:**
  - `OrderDetailSheet.tsx:359-378` (checklist de serviços)
  - `HomeModule.tsx:91, 100, 109, 119, 130, 147, 330`
  - `OrdersModule.tsx:170, 344`
  - `ClientsModule.tsx:179, 396`
  - `MoreModule.tsx:179`
  - `NewOrderWizardModal.tsx:556`
- **Problema:** não são alcançáveis por teclado nem anunciados por leitor de tela.
- **Correção:** trocar por `<button type="button">`. No checklist, usar `role="checkbox"` com `aria-checked`.

**H10. Inputs sem label associado e botões só com ícone sem nome acessível**
- **Inputs sem label:**
  - `AccountSettingsModal.tsx:169, 184, 199`
  - `ForgotPasswordModal.tsx:102`
  - `ClientsModule.tsx:444-521, 563-634`
  - `NewOrderWizardModal.tsx:340-361, 458-512, 571-593`
  - `OrderDetailSheet.tsx:328-345, 586-595`
  - `CameraModal.tsx:318, 352-374`
  - `BarcodeScannerModal.tsx:110`
  - `GlobalSearchModal.tsx:118`
  - Campos de busca de Orders, Clients e Stock
- **Botões só com ícone:** os de fechar de quase todos os modais, os botões +/- do estoque (`StockModule.tsx:265-286`) e a câmera (`OrderDetailSheet.tsx:673`).
- **Correção:** `htmlFor`/`id` (ou `useId`) nos inputs; `aria-label` nos botões e `aria-hidden` nos ícones.

**H11. Campo "E-mail ou CPF" ruim no celular**
- **Onde:** `LoginPage.tsx:56-73` e `:228`; `ReauthBottomSheet.tsx:61-74` e `:204`; `ForgotPasswordModal.tsx:16-29`.
- **Problemas:**
  - `inputMode` começa em `numeric` porque `isEmailMode` só fica verdadeiro depois de digitado um `@`. O teclado abre numérico, sem letras nem `@`. *(verificado)*
  - Enquanto não há `@` no valor, a máscara de CPF descarta as letras: digitar `lucas2` resulta em `2`.
- **Correção:** usar sempre `inputMode="text"` (ou `email`) e aplicar a máscara só quando o valor tiver apenas dígitos e pontuação de CPF (`/^[\d.\-\s]*$/`).

### Segurança (lane React/front)

**H12. Token de sessão e dados do usuário em `localStorage`/`sessionStorage`**
- **Onde:** `AuthContext.tsx:51-58`, `:134-140` e `:216-217`.
- **Problema:** a regra `react/security.md` classifica isso como CRITICAL. Aqui ficou em HIGH porque o servidor é mock, mas vira CRITICAL na integração com JWT.
- **Correção:** na integração, refresh token em cookie httpOnly e access token só em memória. Não persistir o objeto `user`; buscá-lo com `getMe`.

**H13. A troca de perfil e o login deixam o token antigo no outro storage**
- **Onde:** `AuthContext.tsx:51-53`, `:134-140` e `:214-218`. *(verificado)*
- **Problema:** `switchProfileWithTicket` grava o token novo só no `sessionStorage`. Se houver um token "lembrar-me" no `localStorage`, ele vence a leitura depois de um reload: o usuário volta ao perfil anterior ou cai numa sessão que o servidor já invalidou.
- **Correção:** uma função `persistSession(token, user, remember)` que grava num storage e limpa o outro, usada no login e na troca de perfil.

**H14. Logout e troca de perfil não limpam os dados de negócio (dados pessoais)**
- **Onde:** `AuthContext.tsx:147-158` e `:211-212`. *(verificado)*
- **Problema:** `luthier_clients`, `luthier_orders`, `luthier_payments` e as demais chaves (telefones, CPF, valores) continuam no aparelho. O comentário promete limpar, mas o código só remove o rascunho do wizard.
- **Correção:** limpar as chaves `luthier_*` e resetar o `AppContext` no logout e na troca de perfil.

**H15. O portal do cliente pode mostrar dados de outro cliente**
- **Onde:** `ClientPortalView.tsx:33-38`. *(verificado)*
- **Problema:** se o e-mail logado não bater com nenhum cliente, o código cai em `cli-1` ou em `clients[0]` e exibe as OS e fotos de outra pessoa. Com `clients` vazio, `currentClient.id` quebra.
- **Correção:** sem correspondência, mostrar o estado vazio. Na integração, o backend deve filtrar.

**H16. Credenciais de demonstração no bundle e na tela**
- **Onde:** `LoginPage.tsx:343-370`; `ReauthBottomSheet.tsx:43-49` e `:245-250`. *(verificado)*
- **Problema:** e-mails e senhas das três contas aparecem na interface, e o reauth ainda pré-preenche o e-mail da conta destino.
- **Correção:** só exibir sob `import.meta.env.DEV` ou uma flag de demo.

### Servidor (lane TypeScript, `server.ts`)

**H17. `sensitive-update` sem validação e com aplicação parcial**
- **Onde:** `server.ts:457-466`. *(verificado)*
- **Problemas:**
  - Se `phone` não for string, `phone.trim()` lança depois que o e-mail já foi alterado: resposta 500, estado aplicado pela metade e ticket não consumido.
  - O e-mail só é checado com `includes('@')`, sem verificar se já está em uso. Dois usuários podem ficar com o mesmo e-mail, e o login (`:241`) passa a encontrar o primeiro deles.
- **Correção:** validar tudo antes de alterar (zod), garantir e-mail único e aplicar as mudanças de uma vez.

**H18. `res.json()` sem tratamento no cliente HTTP**
- **Onde:** `authApi.ts:48, 75, 95, 116, 151, 163, 172`. *(verificado)*
- **Problema:** uma resposta não-JSON (502 de proxy, ou erro HTML do body-parser) vira `SyntaxError` em vez da mensagem amigável. Além disso, os dados chegam como `any` e não são validados.
- **Correção:** um helper `request<T>()` com `res.json().catch(() => ({}))`, uma classe `ApiError` tipada e validação da resposta.

---

## MEDIUM

**Hooks e efeitos**
- `AuthContext.tsx:105-126`: `logout` é usado mas falta nas deps. O timer de inatividade de 15 min também anula o "manter conectado".
- `AuthContext.tsx:161-192`:
  - Chamar `requestReauthentication` duas vezes deixa a primeira promise pendente para sempre.
  - O `reject()` rejeita com `undefined`, não com um `Error`.
- `ReauthBottomSheet.tsx:37-57`: o `setTimeout` de foco não é limpo, e o efeito depende de `user`, então reseta o formulário no meio da troca de perfil.
- `LoginPage.tsx:40-53` e `WorkbenchModeModal.tsx:51-68`: o intervalo é recriado a cada segundo (o valor que muda está nas deps) e a contagem desliza quando o app fica em segundo plano. Usar um timestamp-alvo.
- `WorkbenchModeModal.tsx`: o reset do timer fixa `1800` e ignora o preset escolhido.
- `LoginPage.tsx:117, 171`: `navigator.onLine` é lido no render sem assinatura. Usar `useSyncExternalStore`.
- `BarcodeScannerModal.tsx:19-35`: um `AudioContext` novo é criado a cada leitura e nunca fechado (os navegadores limitam a uns 6).
- `CameraModal.tsx:141-161` e `NewOrderWizardModal.tsx:150-167`: a instância de `SpeechRecognition` não é guardada, então não dá para chamar `abort()` ao fechar.
- `AppContext.tsx:218` e `:245`: os `setTimeout` de toast e de sync nunca são cancelados.
- `AppContext.tsx:666`: o próximo número de OS vem do `orders` do closure; chamadas rápidas podem gerar número duplicado.

**Estado duplicado e renderização**
- `AuthGuard.tsx:11-16`: o `currentRole` do `AppContext` nasce como `'luthier'` e só é sincronizado depois do primeiro render.
  - Um `cliente` vê um frame da interface de luthier.
  - Cada login dispara o toast "Perfil alterado".
  - Correção: derivar a role direto de `user.role`.
- `AppContext` monolítico (~50 campos, 938 linhas, valor do Provider sem `useMemo`): qualquer toast ou troca de aba re-renderiza todos os consumidores. Dividir em contextos (dados / UI / toasts / câmera) ou usar um store com seletores.
- `MoreModule.tsx:378`: `subSection === 'config'` ignora o perfil. Um atendente pode ver Config e "Restaurar Dados".
- `MoreModule.tsx`: `agendaFilter` nunca é aplicado à lista.
- `OrdersModule.tsx:313-321` (Kanban) e `ClientPortalView.tsx:60-68` (stepper) não têm os status `orcamento` e `entregue`.
  - No Kanban, essas OS somem.
  - No portal, `currentStepIdx` fica `-1`.
- `WorkbenchModeModal.tsx:129`: lista `orders.slice(0,5)` e ignora `benchOrders`.
- `NewOrderWizardModal.tsx:193-226`: cliente e instrumento são criados antes de validar o resto do wizard. Abandonar o fluxo deixa registros órfãos.
- "Restaurar Dados" apaga tudo sem confirmação: `Header.tsx:245-255` e `MoreModule.tsx:403`.
- Números fictícios exibidos como reais: `MoreModule.tsx:239, 246, 250`. `HomeModule.tsx:44-46` chama de "mês" a soma de todos os pagamentos.

**`key` e listas**
- `NewOrderWizardModal.tsx:537` e `:613`, `WorkbenchModeModal.tsx:320`: `key={idx}` em listas que mudam. Usar `ph.id` ou o id do item.

**Acessibilidade (outros)**
- `ToastContainer.tsx:22-28`:
  - Cada toast monta um `role="status"` novo, e leitores de tela costumam não anunciar regiões live recém-criadas.
  - O toast com "Desfazer" dura só 4,5 s.
- `AccountSettingsModal.tsx:145-160` e `ForgotPasswordModal.tsx:94-99`: as mensagens de erro e sucesso não têm `role="alert"`.
- `BottomTabBar.tsx`: as abas não têm `aria-current="page"`.
- `Header.tsx:150-260`: o menu de persona não tem `aria-expanded` nem `aria-haspopup`, não fecha com Escape, e o overlay clicável é um `div`.
- Hierarquia de títulos irregular. `LoginPage` não tem `<main>`.
- Emojis usados como ícone sem `aria-hidden`.
- `body { user-select: none }` (`index.css`) impede copiar o código da OS, o recibo e o CPF.
- Contraste provavelmente insuficiente em `text-stone-500` com `text-[9px]`/`text-[10px]` sobre `stone-900/950`. É estimativa, não medi.

**Alvos de toque (requisito do projeto: ≥ 48 px, ≥ 64 px na bancada)**
- `StockModule.tsx:263-282`: os botões +/- são `w-10 h-10` (40 px), embora o comentário diga 48.
- Botões de fechar com `p-1`/`p-1.5` (~28-32 px) em vários modais, além do botão de tema no Header.
- `OrderDetailSheet.tsx`:
  - stepper `py-1` (`:232`)
  - abas `py-1.5` (`:267`)
  - seletores de pagamento `py-1.5` (`:606`)
- Modo bancada:
  - serviços com `min-h-[58px]` (`:208`), abaixo dos 64 px
  - "Sair" com `py-2.5` (`:114`)
  - presets com `py-1.5` (`:327`)
- `LoginPage.tsx:299-305`: o checkbox "Manter conectado" tem 16 px.
- "Novo Cliente" (`ClientsModule.tsx:150`) e "Nova OS" (`OrdersModule.tsx:108`) ficam no topo da tela, fora da zona do polegar. A FAB atenua no caso da Nova OS.

**Segurança (React)**
- `window.open(..., '_blank')` sem `noopener,noreferrer` em:
  - `OrderDetailSheet.tsx:146`
  - `ClientsModule.tsx:215, 267`
  - `OrdersModule.tsx:271`
  - `MoreModule.tsx:72`
  - `ClientPortalView.tsx:80`
- `AppContext.tsx:668-669`: o `clientTrackingToken` é formado por iniciais + número da OS + 2 dígitos aleatórios (90 combinações). É adivinhável, e vai funcionar como credencial do portal sem senha. O backend deve gerar um token opaco.
- `ROLE_PERMISSIONS` não é usado por nenhum componente. A UI faz checagens avulsas de `currentRole`, o que abre espaço para divergências (o botão "Aprovar", o `MoreModule:378`).

**Servidor e contrato (lane TS)**
- `server.ts:576-584`: `validate-action` libera por padrão; qualquer ação fora da lista retorna `allowed: true`. *(verificado)*
- `server.ts:144-178`: o rate limit conta só por identificador.
  - E-mail e CPF têm orçamentos separados de tentativas, e o reauth tem um terceiro.
  - Não há limite por IP, então qualquer pessoa consegue bloquear a conta de outra.
  - O `Map` cresce sem limite.
- `server.ts:248-255`: o comentário diz "constant time", mas um usuário inexistente responde sem rodar o PBKDF2, e a diferença de tempo vaza se o usuário existe. Além disso:
  - `pbkdf2Sync` bloqueia o event loop.
  - 10 mil iterações está bem abaixo dos 210 mil que a OWASP recomenda.
- `server.ts:504-519`: `forgot-password` não tem rate limit e grava auditoria a cada chamada anônima. Como o log guarda 200 registros, o flood expulsa os registros reais.
- `server.ts:136`: o IP vem de `x-forwarded-for` bruto, que é forjável.
- `server.ts:389-410`: `switch-profile` não exige sessão, e o ticket não fica vinculado à sessão que o gerou.
- `server.ts`: falta hardening básico:
  - `x-powered-by` exposto e nada de helmet.
  - Sem error handler JSON nem 404 JSON para `/api/*`.
  - Caminhos de `dist` dependem do diretório atual.
- As permissões do cliente e do servidor divergem nos nomes:
  - `canPerformBenchLabor` × `canExecuteBenchLabor`
  - `canRegisterEntry` × `canRegisterEntryPhoto`
  - O servidor não tem 9 das flags do cliente.
  - `getPermissions` e `validateAction` nunca são chamados, então a regra "manter em sincronia" do CLAUDE.md não tem verificação.
- **Login por CPF falha para Mariana e Lucas:** os CPFs semeados `23456789011` e `32165498712` têm dígitos verificadores inválidos (`server.ts:73`, `:86`), e o `LoginPage.tsx:88` exige `isValidCpf`. Só o do Armando (`12345678909`) é válido. *(verificado rodando o algoritmo em Node)*
- `tsconfig.json`: não tem `strict`. Esse é o principal facilitador dos `any` e dos problemas de null.

**Componentes grandes (>200 linhas)**
- Tamanhos:
  - `AppContext` 938 (acima do teto de 800)
  - `OrderDetailSheet` 763
  - `NewOrderWizardModal` 739
  - `ClientsModule` 658
  - `HomeModule` 425
  - `MoreModule` 416
  - `CameraModal` 406
  - `OrdersModule` 383
  - `LoginPage` 383
  - `WorkbenchModeModal` 337
  - `StockModule` 328
  - `ClientPortalView` 309
  - `GlobalSearchModal` 291
  - `ReauthBottomSheet` 284
  - `AccountSettingsModal` 281
  - `Header` 267
- Extrações sugeridas:
  - `AppContext` → `useOrders`, `useStock`, `useToasts`
  - `OrderDetailSheet` → um componente por aba
  - Wizard → um componente por passo
  - Hook `useIdentifierInput` para a máscara de e-mail/CPF repetida em 3 arquivos

---

## LOW
- `Header.tsx:72` usa o breakpoint `xs:`, que não existe no Tailwind v4 por padrão.
- As classes `animate-in`, `fade-in` e `zoom-in-95` não têm efeito, porque o plugin não está no `package.json`.
- `Header.tsx:172-175`: o overlay do menu fica dentro do stacking context do header (z-30), então a tab bar (z-40) continua clicável com o menu aberto.
- `MoreModule.tsx:77`: `clipboard.writeText` não tem `await` nem `catch`, e o toast de "copiado" aparece mesmo quando a cópia falha.
- `GlobalSearchModal.tsx:98-103`: o resultado de cliente não abre o cliente.
- `StockModule.tsx:141-149`: "Ver Itens" limpa os filtros em vez de filtrar o estoque baixo.
- Imports não usados (`Sparkles`, `Tag`, `FlipHorizontal`, `ImageIcon`, `Order`…).
- `React.FC` em todo o código; a regra do projeto prefere funções simples.
- `NodeJS.Timeout` em código de browser (`AuthContext.tsx:108`, `LoginPage.tsx:41`). Usar `ReturnType<typeof setTimeout>`.
- `ClientsModule.tsx:97` e `NewOrderWizardModal.tsx:195-196`: o cadastro rápido grava e-mail e telefone inventados (`@gmail.com`, `(11) 99999-9999`).

---

## Pontos positivos
- Não há `dangerouslySetInnerHTML`, `innerHTML` nem `eval`. Os links `wa.me` e `tel:` usam só dígitos e `encodeURIComponent`.
- Atualizações de estado quase sempre imutáveis (`prev.map`, spread), sem mutação direta de state.
- `LoginPage` e `ReauthBottomSheet` são boas referências: `label htmlFor`, `aria-invalid`/`aria-describedby`, `role="alert"`, `autoComplete`, botão de mostrar senha com 48 px.
- `checkSession` usa a flag `isMounted`, e um token expirado limpa o storage.
- Servidor:
  - Tokens gerados com `crypto.randomBytes(32)`.
  - Hash comparado com `timingSafeEqual`.
  - Ticket de reauth de uso único e com expiração.
  - Mensagens de erro de login uniformes.
  - CPF sempre mascarado e `sanitizeUser` sem senha nem salt.
- Ações primárias no rodapé (OrderDetailSheet, Wizard, FAB), respeitando a zona do polegar.

---

## Recomendações de tooling (ordem sugerida)
1. `npm ci` e confirmar se `npm run lint` e `npm run build` passam (não verificado nesta revisão).
2. ESLint com `eslint-plugin-react-hooks` (`rules-of-hooks: error`, `exhaustive-deps: warn`) e `eslint-plugin-jsx-a11y`.
3. `StrictMode` em `main.tsx`, para expor os updaters impuros (H1).
4. Error Boundary global e `loadJson` seguro (H5).
5. Vitest com testes das regras de status e estoque, as candidatas naturais a reducer.
6. `"strict": true` no `tsconfig`, com um `tsconfig.server.json` separado para o servidor.
7. `npm audit fix` (body-parser).

## Resumo

| Severidade | Qtde |
|---|---|
| CRITICAL | 1 |
| HIGH | 18 (+1 de config: ESLint ausente) |
| MEDIUM | ~45 |
| LOW | ~10 |

**Prioridade de correção:**
1. **C1:** o app quebra ao abrir a bancada.
2. **H2:** baixa de estoque duplicada.
3. **H7:** o reauth fica inacessível.
4. **H4:** a câmera não funciona.
5. **H3:** formulários com estado velho.
6. **H5/H6:** tela branca por storage.
7. **H13/H14:** sessão e dados pessoais deixados no aparelho.
