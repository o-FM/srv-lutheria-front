# Code Review: srv-lutheria-front (projeto inteiro)

**Data:** 2026-11-07
**Modo:** revisão local completa. Não havia alterações pendentes, então revisei o código inteiro, sem diff. Li cada arquivo por completo.
**Escopo:** `server.ts` e todos os 30 arquivos de `src/` (~10,2 mil linhas), além de `vite.config.ts`, `tsconfig.json` e `package.json`.
**Decisão:** **BLOQUEIA**. Há 1 CRITICAL e vários HIGH, inclusive de segurança/LGPD.

> Complementa o `.claude/PRPs/reports/react-review.md`, que detalha hooks, acessibilidade, alvos de toque e o servidor. Aqui o foco está em **correção de regras de negócio, segurança, qualidade e manutenção**. Itens já descritos lá aparecem só resumidos, com referência (ex.: "→ RR-H7").

---

## Validação

| Checagem | Resultado |
|---|---|
| Typecheck (`npm run lint` = `tsc --noEmit`) | **Pulado**: não há `node_modules`, e a revisão é só de análise, então não instalei |
| Lint (ESLint) | **Inexistente**: o projeto não tem ESLint |
| Testes | **Inexistentes**: não há runner nem testes. Cobertura 0% contra a meta de 80% das regras |
| Build (`npm run build`) | **Pulado** (mesmo motivo do typecheck) |
| `npm audit` | **1 HIGH**: `body-parser <1.20.9` (DoS), via `express`. Corrige com `npm audit fix` |

---

## CRITICAL

### C1. Abrir o Modo Bancada derruba o app
- **Onde:** `src/components/workbench/WorkbenchModeModal.tsx:35`.
- **Problema:** há um `return null` antes de `useState`/`useEffect` (linhas 42-68). O componente fica sempre montado (`App.tsx:60`), então ao abrir a bancada a quantidade de hooks muda, o React lança erro e, sem Error Boundary, a tela fica branca. → RR-C1
- **Correção:** subir os hooks para antes do `return`, ou extrair o conteúdo para um componente que só monta quando o modal está aberto.

---

## HIGH

### Correção de regras de negócio

**H1. Estoque pode ser descontado várias vezes e fica inconsistente com o histórico**
- `AppContext.tsx:386-397`: entrar em `em_execucao` desconta as peças sem verificar se já foram descontadas. Isso acontece de três formas:
  - O stepper do luthier (`OrderDetailSheet.tsx:112-116`) aceita clicar de novo no mesmo status.
  - Qualquer salto de status repete o desconto.
  - `approveQuote` (`AppContext.tsx:569-578`) desconta de novo a partir de qualquer status. O botão "Aprovar" aparece até em OS `entregue` (`OrderDetailSheet.tsx:551`).
- `AppContext.tsx:296`: `Math.max(0, …)` zera a quantidade em silêncio, mas o movimento gravado (`:311`) registra a quantidade cheia. Não há aviso de estoque insuficiente.
- `AppContext.tsx:418-427`: o "Desfazer" restaura só a OS. O estoque e os movimentos ficam descontados, e o snapshot antigo sobrescreve qualquer alteração feita depois na OS.
- **Correção:** concentrar as transições numa função de domínio pura (reducer) com:
  - tabela de transições permitidas;
  - flag `partsDeducted` na OS;
  - validação de saldo antes de descontar;
  - undo que reverta estoque e movimentos.

**H2. Transições de status sem regra: dá para pular a aprovação**
- `AppContext.tsx:333-351`: com `specificStatus`, qualquer destino é aceito, inclusive voltar de `entregue` para `recebido` ou ir direto de `recebido` para `pronto`.
- A única trava (`:344`) exige `order.quote && …`. OS sem orçamento passam direto para execução e descontam peças. É o caso das seeds 1045 e 1046 (`seedData.ts:524-623`).
- **Correção:** uma máquina de estados explícita, alinhada com `docs/api.md` do backend, onde orçamento ausente bloqueia a entrada em `em_execucao`.

**H3. "Foto rápida da bancada" vai para a OS errada**
- **Onde:** `HomeModule.tsx:48-62`.
- **Problema:** a foto é anexada a `activeOrders[0]`, que é simplesmente a primeira OS do array, sem ordem nem confirmação. O luthier fotografa um instrumento e a foto vai para outra OS (e aparece no portal do cliente errado).
- **Correção:** pedir para escolher a OS ou usar a OS selecionada na bancada.

**H4. A categoria escolhida para a foto é descartada**
- **Onde:** `CameraModal.tsx:53` e `:321-347` (seletor de etapa); `:168` (callback).
- **Problema:** o callback tem a assinatura `(url, caption)` e não recebe a `tag`. Quem chama fixa a tag por conta própria (`OrderDetailSheet.tsx:98`, `HomeModule.tsx:58`, `WorkbenchModeModal.tsx:88`, `NewOrderWizardModal.tsx:176`), então o seletor "Etapa / Categoria" não faz nada.
- **Correção:** `cameraCallback(url, caption, tag)`.

**H5. Fluxo de pagamento quebrado ou ausente**
- **Formulário invisível:** `OrderDetailSheet.tsx:127-129` e `:704-706` chamam `setIsPaymentModalOpen(true)` ao entregar com saldo, mas o formulário só é renderizado na aba `orcamento` (`:472`, `:583`). Em outra aba ele não aparece.
- **Entrega sem pedir pagamento:** "Entregar" em `HomeModule.tsx:395-398` e `OrdersModule.tsx:293-296` entrega sem pedir pagamento nem avisar do saldo.
- **Valor sem validação:** `handleSavePayment` (`OrderDetailSheet.tsx:149-168`) aceita valor acima do saldo, e `paidAmount` pode passar do total.
- **Correção:** pedir o pagamento num passo próprio que aparece em qualquer aba, limitar o valor ao saldo e unificar a ação "entregar" num só lugar.

**H6. A busca global encontra instrumentos, mas não mostra**
- **Onde:** `GlobalSearchModal.tsx:57-62` e `:80-84`.
- **Problema:** `matchedInstruments` entra no `totalCount`, mas não há bloco que renderize essa lista. Buscar por nº de série mostra uma tela vazia, sem nem a mensagem "nenhum resultado".
- **Agravante:** o clique em cliente (`:98-103`) ignora `clientId` e não abre o cliente.

**H7. O wizard de OS mistura dados e cria registros órfãos**
- `NewOrderWizardModal.tsx:193-198` e `:212-226`: cliente e instrumento são gravados ao avançar de passo, antes de validar o restante. Abandonar o wizard deixa os registros.
- `:377-380`: trocar o cliente não limpa `selectedInstrumentId`, então a OS pode sair com o instrumento de outro cliente. → RR-H3
- `:222` e `:272`: as mesmas fotos em base64 são gravadas no instrumento e na OS, dobrando o uso do `localStorage`.
- `:195-196` e `ClientsModule.tsx:96-97`: o cadastro rápido inventa telefone e e-mail (`(11) 99999-0000`, `nome@email.com`). Dois clientes com o mesmo nome ficam com o mesmo e-mail, e o portal (`ClientPortalView.tsx:34`) identifica o cliente pelo e-mail.
- **Correção:**
  - Gravar tudo só no "Abrir OS".
  - Deixar e-mail e telefone vazios em vez de inventá-los.
  - Validar que o instrumento pertence ao cliente.

### Segurança, LGPD e permissões

**H8. CPF de clientes em texto claro, sem máscara e sem validação**
- `ClientsModule.tsx:306-309` exibe `CPF: {selectedClient.cpf}` completo, contrariando a regra do projeto ("CPF is masked in output", CLAUDE.md).
- `maskCpf` existe em `utils/cpfValidator.ts:59` mas **não é usado em lugar nenhum**.
- `ClientsModule.tsx:77-85, 98` grava o CPF sem `isValidCpf`, e as seeds têm CPFs com dígito verificador inválido.
- Os CPFs ficam em `localStorage` (`luthier_clients`), que não é limpo no logout nem na troca de perfil. → RR-H14
- **Correção:** `maskCpf` na exibição, `isValidCpf` no cadastro, limpar o storage no logout e, na integração, guardar o CPF só no backend.

**H9. Permissões inconsistentes e não aplicadas**
- `ROLE_PERMISSIONS` e `getRolePermissions` (`utils/permissions.ts`) não são importados por nenhum componente. A UI faz ~40 checagens soltas de `currentRole`, e elas contradizem a tabela:
  - **Aprovar orçamento:** o atendente vê e usa o botão (`OrderDetailSheet.tsx:551`), mas `canApproveClientQuote: false`.
  - **Totais financeiros:** o atendente vê a aba Orçamento com totais, pagos e saldo (`OrderDetailSheet.tsx:472-562`) e o template de WhatsApp com o total (`MoreModule.tsx:63`), mas `canViewFinancialTotals: false`.
  - **Config e Restaurar Dados:** `MoreModule.tsx:378` usa `subSection` em vez de `activeSubSection`. Um atendente que herde `subSection === 'config'` vê a Agenda e a Config com "Restaurar Dados Iniciais" ao mesmo tempo.
- **Ações sem verificação de papel:** as ações de domínio do `AppContext` (`approveQuote`, `recordPayment`, `updateStockQuantity`, `resetToDefaults`) não verificam papel nenhum.
- **Servidor dessincronizado:** as permissões do servidor (`server.ts:538-554`) têm outros nomes, faltam 9 flags e o fallback libera por padrão (`:576-584`). → RR "Servidor e contrato"
- **Correção:**
  - Um hook `usePermission(flag)` baseado em `ROLE_PERMISSIONS`, usado em todos os componentes.
  - Guardas também nas ações do contexto.
  - Uma tabela compartilhada entre cliente e servidor, ou um teste que compare as duas.

**H10. O portal do cliente pode mostrar dados de outra pessoa**
- **Onde:** `ClientPortalView.tsx:33-36`.
- **Problema:** sem correspondência de e-mail, o código cai em `cli-1` ou em `clients[0]`. Somado ao H7 (e-mails sintéticos duplicados), um cliente pode ver as OS, fotos e valores de outro. → RR-H15

**H11. Sessão e storage**
- **Token em storage:** o token de sessão fica em `localStorage`/`sessionStorage`. → RR-H12
- **Token antigo vence:** o token antigo prevalece depois de trocar de perfil. → RR-H13
- **Senhas na interface:** as senhas demo aparecem na UI e vão para o bundle (`LoginPage.tsx:343-370`, `ReauthBottomSheet.tsx:245-250`). → RR-H16

**H12. Servidor: validação de entrada**
- `server.ts:457-466`: `sensitive-update` altera o usuário antes de validar. Isso permite:
  - estado parcial e resposta 500 quando um campo não é string;
  - e-mail duplicado entre usuários. → RR-H17
- `server.ts:299`: `actionType` sem allow-list. O `x-forwarded-for` é aceito sem checagem e pode ser forjado (`:136`).
- `server.ts:389-410`: `switch-profile` não exige sessão.
- `server.ts:211`: `express.json()` sem `limit` explícito. Não há error handler JSON, helmet nem rate limit por IP, e `forgot-password` não tem limite. → RR "Servidor e contrato"

### Robustez

**H13. Tela branca sem recuperação**
- **`JSON.parse` sem proteção:** `AppContext.tsx:111-136` (6×) e `AuthContext.tsx:57`.
- **`setItem` sem tratamento:** `AppContext.tsx:169-191` grava fotos em base64 sem `try/catch` e estoura a cota.
- **Sem Error Boundary.** → RR-H5, RR-H6

**H14. Formulários com estado de outro usuário ou de outra OS**
- **Conta:** `AccountSettingsModal.tsx:29-30` envia o e-mail do usuário anterior como alteração da conta atual depois de trocar de perfil.
- **Detalhe da OS:** `OrderDetailSheet.tsx:57-65` carrega a aba e o pagamento de uma OS para a outra. → RR-H3

### Qualidade e manutenção

**H15. Arquivos e funções acima dos limites das regras**
- **Arquivos >800 linhas:** `AppContext.tsx` (938). Estão perto do limite `OrderDetailSheet.tsx` (763), `NewOrderWizardModal.tsx` (739) e `ClientsModule.tsx` (658).
- **Funções >50 linhas:**

  | Arquivo:linha | Função | Linhas |
  |---|---|---|
  | `AppContext.tsx:322-448` | `advanceOrderStatus` | ~125 |
  | `AppContext.tsx:550-620` | `approveQuote` | ~70 |
  | `AppContext.tsx:663-735` | `createOrder` | ~72 |
  | `NewOrderWizardModal.tsx:184-234` | `handleNextStep` | ~50 |
  | `server.ts:209-606` | `startServer` (todas as rotas inline) | ~400 |
  | `server.ts:216-289` | handler de login | ~74 |
  | `server.ts:293-385` | handler de reauth | ~92 |

- **Componentes de tela grandes:** todos têm mais de 200 linhas de JSX num único `return`.
- **Correção:**
  - `AppContext` → `useOrders`, `useStock`, `usePayments`, `useToasts`, `useUi` (ou contextos separados).
  - `server.ts` → `routes/auth/*.ts` com `express.Router()`.
  - `OrderDetailSheet` → um componente por aba.
  - Wizard → um componente por passo.

**H16. Ferramental mínimo ausente**
- **Nenhum teste:** regras como transição de status, baixa de estoque, totais e CPF são as candidatas mais óbvias e não têm cobertura.
- **Nenhum ESLint**, e por isso o C1 passou.
- **`tsconfig.json` sem `strict`:** a checagem de null e de `any` implícito está desligada, e a config tem resquícios como `experimentalDecorators` e `allowJs`.
- **Dependência vulnerável:** `body-parser` (npm audit).

---

## MEDIUM

**Datas, fusos e formatação**
- **Datas em UTC:** `new Date().toISOString()` é usado como data e hora *local* em ~12 lugares:
  - `AppContext.tsx:309, 374, 382-383, 517, 566, 628, 688, 691, 707, 743, 762`
  - `OrderDetailSheet.tsx:163`
  - `NewOrderWizardModal.tsx:178, 259-263`

  No Brasil (UTC−3), toda OS aberta depois das 21h fica com a data de amanhã, e os horários da timeline saem 3h adiantados. Usar formatação local (`Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })`) ou um helper `nowLocal()`.
- **Moeda fora do padrão pt-BR:** `R$ ${x.toFixed(2)}` aparece em ~25 lugares e gera "R$ 120.00", com ponto decimal. Já `MoreModule.tsx:246` usa "R$ 483,00" fixo. Criar `formatBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- **Agenda:**
  - `MoreModule.tsx:188` fixa o rótulo "OUT" (outubro) para qualquer data.
  - `agendaFilter` (`:43`) não filtra nada.
  - A lista não é ordenada por prazo e inclui OS entregues.
- **Início (`HomeModule.tsx:319`):** "Prioridades & Prazos da Semana" mostra as 4 primeiras OS do array, sem ordenar por prazo nem prioridade.

**Totais inconsistentes**
- **Desconto:** `createOrder` (`AppContext.tsx:672-677`) e `addServiceItem` (`:467-485`) calculam `totalAmount` *sem* o desconto, enquanto `quote.grandTotal` o aplica. O valor cobrado (`totalAmount`) e o orçamento divergem. A seed 1042 tem `totalAmount 820 = grandTotal`, mas qualquer serviço adicionado faz o total voltar para 855.
- **Portal:** `ClientPortalView.tsx:235-245` lista só a mão de obra de cada serviço, mas mostra um total que inclui as peças. O cliente não consegue conferir a soma.
- **Regra repetida:** a mesma regra de totais está copiada em 3 lugares, também em `OrderDetailSheet.tsx:497-511`. Extrair `computeOrderTotals(services, discount)`.

**Trilha de auditoria falsa**
- `AppContext.tsx:354-359, 533, 597, 646, 711, 801`: o autor dos eventos da timeline é derivado do *papel* com nomes fixos ("Armando (Luthier)", "Mariana (Balcão)"), e não do usuário autenticado.
- `approveQuote` registra "Mariana (Balcão)" mesmo quando é o luthier quem aprova.
- Usar `user.name` do `AuthContext`.

**Ids e identificadores**
- Ids gerados com `prefixo + Date.now()` colidem em operações em lote: movimentos de estoque, timeline, serviços (`AppContext.tsx:306, 373, 460, 516, 592, 742, 760, 780`). Usar `crypto.randomUUID()`.
- `clientTrackingToken` é adivinhável: iniciais + número da OS + 2 dígitos (`AppContext.tsx:668-669`).
- `recordPayment` monta o recibo como `'REC-2026-' + (payments.length + 100)` (`:777`): ano fixo, e o número repete depois de um reset ou de uma remoção.

**Código duplicado (DRY)**
- **Máscara de telefone:** `NewOrderWizardModal.tsx:123-133` e `ClientsModule.tsx:69-75`.
- **Máscara de CPF:** reimplementada em `ClientsModule.tsx:77-85`, embora `formatCpf` já exista em `utils/cpfValidator.ts`.
- **Máscara "e-mail ou CPF":** copiada em `LoginPage`, `ReauthBottomSheet` e `ForgotPasswordModal`.
- **Rótulo de status:** `status.replace('_', ' ')` em ~12 lugares. Falta um mapa de rótulos, e `replace` só troca a primeira ocorrência.
- **Classes dos badges de status:** repetidas em Home, Orders, Portal e Workbench.
- **Timestamp:** `new Date().toISOString().replace('T', ' ').substring(0, 16)` repetido 8 vezes.
- **`maskIdentifier`/`sanitizeUser` do servidor:** reimplementam a máscara de CPF (`server.ts:108-118, 181-186`).

**Dados fictícios e textos enganosos**
- `MoreModule.tsx:239, 246, 250`: "+18% vs mês anterior", "Ticket Médio R$ 483,00" e "Pix (72%)" são textos fixos.
- `MoreModule.tsx:232` e `HomeModule.tsx:44-46, 127`: "Mês atual"/"mês vigente" somam *todos* os pagamentos de sempre.
- `MoreModule.tsx:393`: o texto diz "Offline First (IndexedDB + LocalStorage ativo)", mas não há IndexedDB.
- `BarcodeScannerModal.tsx:81`: diz "Aponte a câmera", mas o leitor é simulado (`stock.slice(0,4)`).
- Seeds: `seedData.ts:826` tem um pagamento da `ord-1041`, que não existe. Os CPFs semeados, tanto os de clientes quanto os do servidor, não passam em `isValidCpf`.

**Ações destrutivas sem confirmação**
- "Restaurar Dados Demo" (`Header.tsx:245-255`, `MoreModule.tsx:403-410`) apaga clientes, OS, estoque e pagamentos com um toque, sem confirmação nem reauth, embora o CLAUDE.md exija reauth para ações sensíveis.

**Valores fixos no código**
- Telefone da oficina fixo no portal: `ClientPortalView.tsx:80` (`5511987654321`).
- Domínio do portal fixo: `https://luthieria.app/os/` em `OrderDetailSheet.tsx:144` e `MoreModule.tsx:61, 63`.
- Dados da oficina fixos (`MoreModule.tsx:384-390`) e nomes de persona no Header (`Header.tsx:37-56`), que não refletem o `user` logado.
- Mover tudo isso para uma configuração da oficina (tenant).

**Outros bugs funcionais**
- `ClientsModule.tsx:383-385`: "Abrir Nova OS" na ficha do cliente não pré-seleciona o cliente no wizard.
- `ClientsModule.tsx:52-53` e `:130-131`: `instNotes` tem estado e é limpo, mas nenhum campo o edita (código morto).
- `WorkbenchModeModal.tsx`:
  - a lista de instrumentos (`:129`) mostra `orders.slice(0,5)` e ignora `benchOrders`;
  - `timerPreset` (`:49`) não é usado;
  - o reset do timer (`:304`) ignora o preset escolhido.
- `StockModule.tsx:141-149`: "Ver Itens" limpa os filtros em vez de mostrar o estoque baixo.
- `StockModule.tsx:320`: o histórico mostra sempre "un", ignorando `item.unit` (jogo, m, ml).
- `CameraModal.tsx:273-279`: o input de arquivo não é resetado (escolher o mesmo arquivo de novo não dispara `onChange`) e não há limite de tamanho; fotos de 5-10 MB entram em base64.
- `MoreModule.tsx:77`: `clipboard.writeText` não tem `await`/`catch`, e o toast "copiado" aparece mesmo quando a cópia falha.
- `AuthGuard.tsx:12-16` e `LoginPage.tsx:128`: os dois chamam `setRole` no login, o que gera toasts duplicados de "Perfil alterado".

**Tipagem**
- `any` explícito (veja também `tsconfig` sem `strict`):
  - `catch (err: any)` em `AccountSettingsModal:88`, `ForgotPasswordModal:43`, `LoginPage:129` e `ReauthBottomSheet:129`
  - `as any` em `ClientsModule:568`, `OrderDetailSheet:265`, `NewOrderWizardModal:708` e `authApi.ts:51-53, 78-79`
  - `useState<any[]>` em `AccountSettingsModal:39`
  - `let interval: any` em `WorkbenchModeModal:52`
  - `Promise<any>` em `authApi.ts:167`
  - `(window as any)` para SpeechRecognition e AudioContext
- **Correção:** usar `unknown` com narrowing, uma classe `ApiError` e os tipos `AuditLogItem`/`ReturnType<typeof setInterval>`.
- **Papel do usuário definido duas vezes:** `AuthUser.role` em `authApi.ts:11` e `UserRole` em `types/index.ts:1`.

**Regras de estilo do projeto**
- **Emojis no código:** `Header.tsx:41, 47, 53`, `HomeModule.tsx:71, 345` e `OrdersModule.tsx:187`. Usar ícones `lucide-react`.
- **`console.log`:** `server.ts:604`. É aceitável como log de inicialização, mas a regra pede logger.
- **Falta de JSDoc** nas APIs públicas: ações do `AppContext`/`AuthContext` e métodos de `authApi`.

---

## LOW
- **Imports não usados:**
  - `Sparkles` em ~8 arquivos
  - `Tag`, `FlipHorizontal`, `ImageIcon` e `Order` em `CameraModal`/`WorkbenchModeModal`
  - `Calendar`, `Phone` e `User` no wizard e no sheet
- **`server.ts:510`:** `rawDigits` não é usado no `forgot-password`, e o `mockToken` devolvido nunca é guardado.
- **`@google/genai`** está no `package.json` mas não é usado (já registrado no CLAUDE.md).
- **`authApi.getPermissions` e `validateAction`** nunca são chamados.
- **Tailwind:** a classe `hover:bg-stone-850` (`NewOrderWizardModal.tsx:626`, `WorkbenchModeModal.tsx:143`) não existe, e o breakpoint `xs:` (`Header.tsx:72`) não existe por padrão no v4.
- **Classes de animação inertes:** `animate-in`, `fade-in` e `zoom-in-95` precisam de um plugin que não está instalado.
- **`active:scale-98`** não é uma classe padrão.
- **`py-0.2`** (`OrdersModule.tsx:189`) não é uma classe válida.
- **`vite.config.ts:11`:** usa `__dirname` em ESM; funciona pelo shim do Vite, mas é frágil.
- **`remainingBalance`** é usado em `handleStepClick` (`OrderDetailSheet.tsx:127`) antes da sua declaração (`:170`). Funciona porque o handler só roda depois do render, mas é frágil.

---

## Pontos positivos
- Atualizações de estado imutáveis de forma consistente (`prev.map`, spread), como pede o CLAUDE.md.
- Nada de `dangerouslySetInnerHTML`, `eval` ou `innerHTML`. As URLs externas usam dígitos limpos e `encodeURIComponent`.
- Servidor:
  - `crypto.randomBytes` nos tokens;
  - `timingSafeEqual` na comparação do hash;
  - tickets de reauth de uso único;
  - mensagens de login uniformes;
  - `sanitizeUser` sem hash nem salt.
- `cpfValidator.ts` tem a validação de dígito verificador correta e testável.
- `LoginPage` e `ReauthBottomSheet` são boas referências de formulário acessível.
- Ações primárias ficam na zona do polegar (barras fixas no rodapé, FAB central).

---

## Arquivos revisados (leitura completa)

| Área | Arquivos |
|---|---|
| Entrada e layout | `src/main.tsx`, `src/App.tsx`, `src/index.css` |
| Contextos e serviços | `src/context/AppContext.tsx`, `src/context/AuthContext.tsx`, `src/services/authApi.ts` |
| Utils, tipos e dados | `src/utils/permissions.ts`, `src/utils/cpfValidator.ts`, `src/types/index.ts`, `src/data/seedData.ts` |
| Auth | `AuthGuard`, `LoginPage`, `ReauthBottomSheet`, `AccountSettingsModal`, `ForgotPasswordModal` |
| Comum | `Header`, `BottomTabBar`, `ToastContainer`, `CameraModal`, `BarcodeScannerModal`, `GlobalSearchModal` |
| Telas | `HomeModule`, `OrdersModule`, `OrderDetailSheet`, `NewOrderWizardModal`, `ClientsModule`, `StockModule`, `MoreModule`, `WorkbenchModeModal`, `ClientPortalView` |
| Servidor e config | `server.ts`, `vite.config.ts`, `tsconfig.json`, `package.json` |

---

## Resumo

| Severidade | Qtde |
|---|---|
| CRITICAL | 1 |
| HIGH | 16 |
| MEDIUM | ~40 |
| LOW | ~10 |

**Ordem sugerida de correção:**
1. **C1:** a bancada derruba o app.
2. **H1/H2:** estoque e máquina de estados. São o coração do domínio; escrever testes Vitest primeiro.
3. **H8/H9/H10:** LGPD e permissões. Mascarar CPF, aplicar `ROLE_PERMISSIONS` e remover o fallback do portal.
4. **H3/H4/H5/H6:** foto na OS errada, categoria descartada, pagamento e busca.
5. **H13/H14:** robustez do storage e reset dos formulários.
6. **H16:** ESLint (`react-hooks`, `jsx-a11y`), `strict: true`, Vitest e `npm audit fix`.
7. **H15:** quebrar `AppContext` e `server.ts`. Fazer isso de preferência junto com a integração ao backend, que vai substituir boa parte desse código.
