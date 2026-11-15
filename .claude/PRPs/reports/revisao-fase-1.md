# Revisão da Fase 1 (bugs e segurança)

- **Data:** 2026-11-14
- **Branch revisada:** `fix/fase-1-bugs-seguranca`, com 28 commits sobre `chore/prp-auditoria-relatorios`.
- **Revisões feitas:** `security-reviewer` (com foco em `server.ts`, `AuthContext` e permissões) e `react-reviewer` (com foco em hooks, `AppContext`, domínio e utilitários). As duas foram somente leitura.
- **Estado na revisão:**
  - `npm run lint`, `npm run build` e `npm test` (75 testes) passando.
  - `npm audit` com 0 vulnerabilidades.
- **Resultado:** nenhum CRITICAL; 5 HIGH, 11 MEDIUM e cerca de 12 LOW.

## Prioridade: corrigir antes do PR

### 1. Falha do `/api/auth/me` apaga os dados locais (HIGH, regressão desta fase)

- **Onde:** `src/context/AuthContext.tsx:136-145` e `src/services/authApi.ts:122-131`.
- **Problema:**
  - O `catch` de `checkSession` trata qualquer erro como sessão inválida: rede, 5xx e servidor reiniciado.
  - Nesse caso ele chama `clearStoredSession()` e `clearBusinessData()`.
- **Efeito:** como as sessões do mock ficam em memória, reiniciar o `npm run dev` e recarregar a página apaga clientes, OS, estoque e pagamentos. Abrir o app sem rede também apaga.
- **Correção:**
  - O `getMe` passa a lançar um erro com `status`.
  - Sessão e dados só são limpos em 401 ou 403.
  - Em erro de rede, sessão e dados ficam como estão: seguir em modo offline ou só avisar.

### 2. Portal ainda pode ser desviado pela troca de e-mail (HIGH, S-05 corrigido pela metade)

- **Onde:** `server.ts:581` (409 de e-mail duplicado) e `src/components/client-portal/ClientPortalView.tsx:39-44`.
- **Problema:**
  - O portal liga o usuário `cliente` ao cadastro pelo e-mail em `clients` (localStorage).
  - O 409 só consulta `users`.
- **Exemplo:**
  1. Lucas lê `luthier_clients` no DevTools.
  2. Troca o e-mail da conta para o de outro cliente. Para isso basta a senha dele.
  3. Passa a ver e aprovar as OS desse cliente.
- **Correção:**
  - **Mínima:** bloquear a troca de e-mail para o papel `cliente` no `sensitive-update`.
  - **Completa:** um `clientId` fixo no usuário do servidor, devolvido em `sanitizeUser`, ou um token de portal.

### 3. "Desfazer" do avanço de status restaura a OS inteira (HIGH, já existia)

- **Onde:** `src/context/AppContext.tsx:499-512` (`undoAction: () => commitOrder(order)`).
- **Efeito:** um pagamento, foto ou serviço registrado nos 4,5 s do toast é perdido. A linha em `payments` continua existindo, então o saldo fica inconsistente.
- **Correção:**
  - Reverter só os campos da transição, sobre a OS atual: `status`, `completedDate`, `deliveredDate`, `quote` gerado e o evento de timeline.
  - Alternativa: não desfazer quando a OS mudou depois do snapshot.

### 4. `ordersRef` desatualizado depois de `setOrders` funcional (HIGH)

- **Onde:** `src/context/AppContext.tsx:409-418`. O ref é lido em `:434` e `:640`.
- **Problema:**
  - Só `commitOrder` atualiza o ref na hora.
  - `recordPayment`, `addServiceItem`, `toggleServiceDone`, `addOrderPhoto`, `rejectQuote`, `updateOrder` e `createOrder` só o atualizam depois do render.
  - `commitOrder` substitui a OS inteira pelo snapshot.
- **Efeito:**
  - Pagar e entregar no mesmo handler vê o saldo antigo e bloqueia a entrega.
  - Um `commitOrder` logo após outra escrita apaga essa escrita.
- **Correção:**
  - Um helper único `mutateOrders(fn)` que faz `ordersRef.current = fn(ordersRef.current)` e depois `setOrders(ordersRef.current)`, usado por todas as ações.
  - Fazer o mesmo para `stockRef`, que `resetToDefaults` também não atualiza.

### 5. `toggleSyncStatus` com efeitos dentro do updater (HIGH, já existia)

- **Onde:** `src/context/AppContext.tsx:291-317`.
- **Efeito:** com StrictMode ou em modo concorrente, toasts e timers de sincronização saem duplicados.
- **Correção:**
  - Decidir fora do updater e só então chamar `setSyncStatus`, `showToast` e `setTimeout`.
  - Guardar o id do timer em um ref e limpá-lo no unmount.

## MEDIUM

### Segurança

- **S-M1. Bloqueio de conta por terceiros (S-03 parcial).**
  - **Onde:** `server.ts:270,276`.
  - **Problema:** a chave `login:user:<id>` é global. Quem conhece o e-mail ou o CPF tranca a conta a cada 15 minutos.
  - **Correção:** bloqueio duro só por par identidade + IP; para a identidade sozinha, atraso progressivo. Ou documentar como trade-off do mock.
- **S-M2. `TRUST_PROXY` chega como string.**
  - **Onde:** `server.ts:387`.
  - **Problema:** o Express 4 trata string como lista de IPs, não como contagem de saltos.
  - **Correção:** converter o valor (`/^\d+$/` vira `Number`, `'true'` vira `true`) e falhar na subida se for inválido.
- **S-M3. Dados de todos os clientes carregados na sessão `cliente` (S-02).**
  - **Onde:** troca de perfil em `AuthContext.tsx:250-267`.
  - **Problema:** a sessão `cliente` carrega CPF completo e valores de todos os clientes; só a tela filtra.
  - **Decisão pendente:** aceitar como risco até a integração, ou não carregar esses dados no papel `cliente`.

### React e regras de negócio

- **R-M1. Ações sem checagem de papel no contexto.**
  - **Onde:** `AppContext.tsx:430-445` (`advanceOrderStatus`) e `:538` (`updateOrder`).
  - **Problema:** qualquer papel avança ou cancela uma OS. `updateOrder` aceita qualquer campo da OS.
  - **Correção:** validar o papel (o atendente só pode registrar `entregue`); remover `updateOrder` ou restringir os campos que ele aceita.
- **R-M2. `addServiceItem` não respeita o estado da OS.**
  - **Onde:** `AppContext.tsx:544-569`.
  - **Problema:** altera um orçamento já aprovado e OS entregue ou cancelada, e não baixa as peças do serviço novo quando `partsDeducted` já é `true`.
- **R-M3. `recordPayment` frágil.**
  - **Onde:** `AppContext.tsx:844-902`.
  - **Problema:**
    - O recibo `REC-2026-${payments.length + 100}` pode repetir e tem o ano fixo.
    - Não valida o valor nem se a OS existe.
    - Soma em float.
- **R-M4. Token do portal adivinhável.**
  - **Onde:** `AppContext.tsx:745-746`.
  - **Problema:** `${iniciais}-${nº}-${10..99}` dá cerca de 90 combinações por OS.
  - **Correção:** usar `crypto.randomUUID()`.
- **R-M5. Baixa parcial marcada como completa.**
  - **Onde:** `AppContext.tsx:368-379`, `:480` e `:653`.
  - **Problema:** com estoque insuficiente, a OS fica com `partsDeducted = true` e a falta nunca é reprocessada.
- **R-M6. Dependências faltando nos `useCallback`.**
  - **Problema:** `actor` não está nos deps de `advanceOrderStatus`, `approveQuote`, `addOrderPhoto`, `rejectQuote`, `createOrder` e `recordPayment`. Hoje é inofensivo, porque o provider remonta por `key`. Sem ESLint, nada avisa (ver 3.3).
- **R-M7. Persistência sem debounce.**
  - **Problema:** o array inteiro é serializado no localStorage a cada mudança (ver 3.8).
- **R-M8. Arquivos acima ou perto do teto de linhas.**
  - `AppContext.tsx` tem 1014 linhas, acima do teto de 800.
  - `OrderDetailSheet.tsx` (770) e `NewOrderWizardModal.tsx` (767) estão perto do limite.
  - Ver 3.5 e 3.9.

## LOW

- **Logout.** `AuthContext.tsx:189-203`: o logout espera a rede antes de limpar o aparelho. Limpar primeiro e chamar a API depois, sem `await` ou com timeout.
- **Inatividade.** `server.ts:306-311,432`: o servidor não tem timeout de inatividade; os 15 minutos existem só no cliente.
- **Corrida no `sensitive-update`.** `server.ts:579-602`: o `await hashPassword` fica entre a checagem e a gravação.
- **Protótipo no `ACTION_POLICY`.** `server.ts:46,698`: `__proto__` e `constructor` passam no lookup. O acesso continua negado, mas a mensagem fica errada. Usar `Object.hasOwn`.
- **CSP, login e senha.**
  - `img-src https:` aceita qualquer origem; restringir ao Unsplash.
  - `font-src` está sem `'self'`.
  - O login por CPF ignora texto depois dos dígitos.
  - A senha nova não tem regra de complexidade.
  - O fallback de `initialRole` continua `'luthier'` (S-18).
- **Câmera.** `src/utils/image.ts`:
  - Capturar com `videoWidth` 0 grava um quadro preto; checar `readyState`.
  - O `catch` do `createImageBitmap` engole erro de canvas.
- **Valor do pagamento.** `OrderDetailSheet.tsx:164`: `"1.234,56"` vira 1.234, e o valor não é arredondado em centavos antes da comparação.
- **Mensagem do `denyUnless`.** `AppContext.tsx:532-533`: diz "exclusivo do Luthier / Dono" para qualquer ação.
- **Wizard.** `NewOrderWizardModal.tsx` (`handleFinishOrder`): não há guarda contra clique duplo, e `nextNumber` vem do closure.
- **Bancada.** `WorkbenchModeModal.tsx`: o fallback `orders[0]` pode ser uma OS que não está na bancada. Já existia.
- **`initialNotice`.** O effect roda a cada render, porque o objeto é novo a cada vez; só o ref segura a repetição. Usar uma chave estável.

## Verificado sem problemas

- **Hooks:** as regras de hooks estão certas nos componentes divididos em casca e conteúdo (`WorkbenchModeModal`, `CameraModal`, `NewOrderWizardModal`) e no effect de `orderSheetFocus`.
- **`AppProviderKeyed`:** não há loop de render nem toast duplicado. `isPersistenceEnabled` está coerente com a `key`.
- **Efeitos em `setOrders`:** `advanceOrderStatus`, `approveQuote` e `deliverOrder` não têm mais efeitos colaterais no updater. O estoque é baixado uma única vez.
- **Servidor:**
  - Tickets de reauth de uso único, presos à sessão e à ação.
  - `switch-profile` exige sessão.
  - Rate limit pela identidade canônica.
  - Tempo de resposta igual com o hash fictício.
  - Formato `{ error }` mantido.
  - 404 JSON e error handler sem vazar stack.
  - Bind em 127.0.0.1 e guarda `ENABLE_DEMO_AUTH`.
- **Utilitários:** `storage`, `dates`, `ids`, `totals`, `orderRules`, `whatsapp` e `identifier`.
- **Achados originais da auditoria corrigidos:** S-01, S-04, S-06, S-07, S-08, S-09, S-11, S-13, S-14, S-16 e S-17.
- **Achados originais corrigidos em parte:** S-03, S-05, S-10, S-12 e S-15.
