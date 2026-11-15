# Auditoria de Segurança: srv-lutheria-front

**Data:** 2026-11-07
**Tipo:** revisão estática somente leitura. Nenhum arquivo do projeto foi alterado, nenhum pacote instalado e o servidor não foi iniciado.
**Branch/commit:** `main` @ `8a567a2`
**Autor:** agente `security-reviewer`. Os pontos marcados *(reconferido)* foram verificados de novo pela sessão principal.

**Reconferências:**
- **S-04:** `crypto.pbkdf2Sync(['1','2','3','4','5','6'], …)` lança `ERR_INVALID_ARG_TYPE` (testado em Node). Em `server.ts:464-465`, o `salt` é trocado antes do hash.
- **S-13:** o script `start` é só `tsx server.ts`, sem `NODE_ENV=production`.
- Os itens conhecidos (sensitive-update, validate-action, CPFs, storage) foram conferidos no code review anterior.

## 1. Escopo

| Item | Arquivos |
|---|---|
| Servidor mock de auth | `server.ts` (rotas `/api/auth/*`, static/Vite) |
| Estado de sessão | `src/context/AuthContext.tsx` |
| Cliente HTTP | `src/services/authApi.ts` |
| Web storage | todo uso de `localStorage`/`sessionStorage` em `src/` |
| Consumidores | `ReauthBottomSheet.tsx`, `LoginPage.tsx`, `AccountSettingsModal.tsx`, `ForgotPasswordModal.tsx`, `ClientPortalView.tsx`, `AuthGuard.tsx`, `Header.tsx`, `App.tsx` |
| Superfície e dependências | `index.html`, `vite.config.ts`, `package.json`, `npm audit --json` |

## 2. Metodologia

- **Leitura:** integral de `server.ts`, `AuthContext.tsx` e `authApi.ts`, e dirigida dos consumidores.
- **Grep em `src/`** por:
  - sinks de XSS (`dangerouslySetInnerHTML`, `innerHTML`, `eval`);
  - `JSON.parse`;
  - `import.meta.env` e `process.env`;
  - `localStorage`/`sessionStorage`;
  - `window.open`;
  - credenciais demo.
- **`npm audit --json`:** 1 vulnerabilidade high.
- **Cenários de exploração:** derivados do código, **não executados**. Os achados estão "verificados no código", não "reproduzidos".
- **Severidade:** ponderada para um mock intencional. Cada achado traz duas marcas:
  - **Hoje:** explorável no estado atual.
  - **Integração:** vira crítico (ou mais grave) se o padrão for levado ao backend real (Spring Boot, JWT 15 min + refresh, multi-tenant).

## 3. Itens já conhecidos: confirmados ou refutados

| Item conhecido | Resultado |
|---|---|
| sensitive-update altera antes de validar os tipos | **Confirmado**, e é pior do que se descrevia: um `newPassword` em array trava a conta (S-04) |
| E-mail duplicado no sensitive-update | **Confirmado** (S-05) |
| validate-action libera por padrão | **Confirmado**. Além disso, o front não usa o endpoint (S-09) |
| switch-profile sem sessão e ticket sem vínculo | **Confirmado** (S-06) |
| Rate limit só por identificador, com contadores separados | **Confirmado**. Também permite bloquear a conta de outra pessoa (S-03) |
| Map de tentativas sem limpeza | **Confirmado** (S-12) |
| Timing revela usuário inexistente | **Confirmado** (S-11) |
| PBKDF2 bloqueante como DoS | **Parcialmente refutado**: o bloqueio após 5 falhas limita o custo. Rebaixado para LOW (S-11) |
| `x-forwarded-for` aceito sem checagem | **Confirmado** (S-10) |
| forgot-password inunda o audit log | **Confirmado** (S-10) |
| Sem helmet, CSP ou `x-powered-by` desligado, sem error handler JSON | **Confirmado** (S-08, S-13) |
| body-parser high | **Confirmado**: versão 1.20.8, corrigida na 1.20.9 (S-14) |
| Token em web storage | **Confirmado**. Não há sink de XSS hoje (C-01) |
| switchProfile grava só no sessionStorage | **Confirmado**. Após o reload, o usuário é deslogado (S-07) |
| Logout não limpa os dados de negócio | **Confirmado** (C-02) |
| `JSON.parse` sem try/catch | **Confirmado** em 7 pontos (C-03) |
| Credenciais demo no bundle | **Confirmado** (S-01) |
| ClientPortalView cai em cli-1/`clients[0]` | **Confirmado**. Há uma cadeia pior, via e-mail mutável (C-04, S-05) |
| Senha nova não revoga as outras sessões | **Confirmado** (S-12) |
| Sessões e tickets expirados nunca são varridos | **Confirmado** (S-12) |
| **Escalada para luthier via `targetRole`/switch-profile** | **Refutado**: exige as credenciais do alvo (S-06) |

## 4. Achados por severidade

**Resumo:** no contexto de mock, 0 CRITICAL, 3 HIGH, 9 MEDIUM, 6 LOW e 4 INFO (S-11 conta como MEDIUM). Vários sobem para CRITICAL na integração.

### HIGH

#### S-01: Credenciais demo ativas sem guarda de ambiente, no servidor e no bundle, com o servidor em 0.0.0.0
- **Onde:**
  - `server.ts:53-93`: seed com as senhas em texto puro.
  - `server.ts:602-604`: `listen(3000, '0.0.0.0')`.
  - `server.ts:588-600`: `NODE_ENV=production` só troca o Vite pelo `dist/`; os usuários demo continuam.
  - `src/components/auth/LoginPage.tsx:345,353,361`: botões que preenchem e-mail e senha.
  - `src/components/auth/ReauthBottomSheet.tsx:43-47,247-249`: e-mails e senhas na interface.
- **Descrição:**
  - Não há `if (isProd) throw` nem flag `ENABLE_DEMO_USERS`.
  - As três senhas estão em strings do JS servido a qualquer visitante.
  - O servidor escuta em todas as interfaces, e não há `HOST` configurável.
- **Exploração:**
  1. Qualquer máquina da LAN, ou da internet se a porta for publicada, abre `http://host:3000`.
  2. Clica no botão demo do Armando, ou faz `POST /api/auth/login` com as credenciais que estão no bundle.
  3. Ganha uma sessão `luthier` (admin).
  4. Lê `/api/auth/audit-logs` e executa switch-profile e sensitive-update.
- **Impacto:** acesso admin ao mock e leitura dos IPs e identificadores do audit log. Na integração, é o padrão que vira uma conta admin conhecida em produção.
- **Correção:**
  ```ts
  const DEMO = process.env.ENABLE_DEMO_AUTH === 'true';
  if (isProd && DEMO) throw new Error('Demo auth proibido em produção');
  const HOST = process.env.HOST ?? '127.0.0.1';
  app.listen(PORT, HOST, ...)
  ```
  No front, mostrar os botões e as dicas de senha só sob `import.meta.env.DEV`. Assim o Vite elimina esse código do bundle de produção.
- **Hoje:** sim. **Integração:** crítico, se qualquer seed ou credencial sobreviver.

#### S-02: Todo o estado de negócio fica em localStorage em texto puro, sem isolamento por papel
CPF completo, telefone, e-mail, fotos e valores.
- **Onde:**
  - `src/context/AppContext.tsx:109-137` (leitura) e `:169-191` (escrita em `luthier_clients|instruments|orders|stock|payments|movements`).
  - `src/data/seedData.ts:9,20,31…`: `cpf: '321.654.987-12'` completo.
  - `src/components/common/CameraModal.tsx:106`: foto como dataURL base64.
- **Descrição:**
  - O servidor mascara o CPF (`server.ts:183`), mas o front grava o CPF completo dos clientes.
  - Qualquer papel, inclusive `cliente`, carrega a base inteira na memória e no storage. A separação é só na renderização (`ClientPortalView.tsx:38`).
  - Sem criptografia e sem TTL.
- **Exploração:**
  1. Entrar como Lucas (cliente).
  2. Abrir DevTools → Application → Local Storage.
  3. Ler `luthier_clients` (CPF, telefone e e-mail de todos), `luthier_payments` e `luthier_orders` (valores e fotos).
  4. Ou rodar `JSON.parse(localStorage.luthier_clients)` no console.
- **Impacto:**
  - Vazamento de dados pessoais (LGPD) para qualquer usuário do aparelho.
  - Leitura por XSS, extensão de navegador ou malware.
  - Adulteração de preços e status, já que nada é validado na leitura (C-03).
- **Correção:**
  - Na integração, nenhum dado pessoal em web storage. Buscar da API, escopado por tenant e papel, e manter em memória só o necessário.
  - Se for preciso modo offline, usar IndexedDB criptografado (WebCrypto, chave derivada da sessão), limpo no logout.
  - Não gravar o CPF completo; usar o mascarado, como o backend faz.
  - Fotos em object storage com URL assinada, não em base64. Hoje elas também ameaçam estourar a cota de ~5 MB.
- **Hoje:** sim, como exposição local de dados pessoais. **Integração:** crítico (LGPD e vazamento entre papéis).

#### S-03: Rate limit por identificador permite bloquear a conta de terceiros e é contornável; não há limite por IP
- **Onde:**
  - `server.ts:225-238,249,264-266`: a chave é o e-mail em minúsculas ou os dígitos do CPF.
  - `server.ts:306`: chave `reauth:`.
  - `server.ts:144-178`: nada considera o IP.
- **Descrição:**
  - **Contadores separados:** `email`, `cpf`, `reauth:email` e `reauth:cpf` são independentes. São até 4 contadores por usuário, ou seja, até 20 tentativas a cada 15 min para quem tem uma sessão válida.
  - **Bloqueio de terceiros:** como o contador não depende do IP, qualquer anônimo que saiba o e-mail do alvo (os e-mails demo estão na interface) bloqueia o login dele por 15 min com 5 senhas erradas, e pode repetir.
  - **Janela deslizante:** deixa 4 tentativas a cada 15 min por chave, indefinidamente.
  - **Ruído no log:** cada tentativa feita durante o bloqueio também grava no audit log (`server.ts:229`), o que serve para apagar evidências (S-10).
- **Exploração:**
  1. `POST /api/auth/login` 5 vezes com `armando.luthier@oficina.com` e senha errada.
  2. O luthier de verdade passa a receber 429 por 15 min.
  3. Repetir a cada 15 min.
- **Impacto:** negação de serviço dirigida a uma conta. Brute force distribuído sem freio por origem.
- **Correção:**
  - Contadores por IP e por conta, com backoff exponencial.
  - Uma chave única por usuário resolvido (`user.id`), não pelo texto digitado.
  - Para contas existentes, preferir atraso progressivo e CAPTCHA/MFA a um bloqueio duro.
  - Na integração: Bucket4j/Redis por IP e por conta, e não gravar log a cada tentativa bloqueada.
- **Hoje:** sim. **Integração:** crítico (dá para bloquear o ADMIN).

### MEDIUM

#### S-04: sensitive-update altera o usuário antes de validar os tipos; um `newPassword` em array trava a conta *(reconferido)*
- **Onde:** `server.ts:457-466`.
- **Descrição:**
  - `email.includes('@')` e `phone.trim()` supõem string.
  - O e-mail é gravado (`:458`) antes do `phone.trim()` (`:461`), que pode lançar. Resultado: atualização parcial.
  - Com `newPassword` sendo um array de 6 ou mais itens, `newPassword.length >= 6` é verdadeiro. O código grava `user.salt = randomBytes` (`:464`) **antes** de `hashPassword` (`:465`). O `pbkdf2Sync` lança `ERR_INVALID_ARG_TYPE`, e o `salt` novo fica com o hash antigo. A senha antiga deixa de valer até o processo ser reiniciado.
  - O ticket só é consumido em `:468-469`. Se a resposta for 500, ele continua válido.
- **Exploração** (exige sessão e ticket válidos, ou seja, a própria conta):
  1. `POST /api/auth/sensitive-update` com `{"ticket":"…","newPassword":["1","2","3","4","5","6"]}`.
  2. A resposta é 500 e a conta fica sem login possível.
- **Impacto:** integridade corrompida e sabotagem depois de um comprometimento. Também vaza stack trace (S-13).
- **Correção:**
  - Validar o corpo inteiro por schema antes de escrever qualquer coisa, aplicando as mudanças numa cópia e só então gravando.
  - Calcular o hash novo primeiro e só depois atribuir `salt` e `passwordHash`.
  ```ts
  const parsed = z.object({
    email: z.string().email().max(254).optional(),
    phone: z.string().max(20).optional(),
    newPassword: z.string().min(10).max(128).optional(),
  }).strict().parse(req.body)
  ```
- **Hoje:** sim (o impacto se limita à própria conta). **Integração:** médio (exige Bean Validation e transação).

#### S-05: E-mail duplicado e sem formato válido no sensitive-update; e é ele que define o isolamento do portal
- **Onde:**
  - `server.ts:457-459`: só checa `includes('@')`, sem unicidade e sem limite de tamanho.
  - `server.ts:241-246`: o login usa `users.find`, então o primeiro registro vence.
  - `src/components/client-portal/ClientPortalView.tsx:33-36`: o portal casa usuário e cliente pelo e-mail.
- **Descrição:**
  - **Sombra de conta:** se um usuário de índice menor (ex.: Mariana) muda o e-mail para o de outro (ex.: Lucas), o login por e-mail do Lucas passa a encontrar a Mariana, falha e acaba bloqueado.
  - **Quebra do isolamento do portal (cadeia):** o e-mail do usuário é mutável e livre. Um usuário `cliente` muda o próprio e-mail (reauth com a própria senha) para o e-mail de **outro cliente** cadastrado. O `updateUserInMemory` atualiza `user.email`, e o portal passa a mostrar as OS, orçamentos e fotos do outro cliente, além de permitir aprovar os orçamentos dele.
- **Impacto:** quebra o isolamento entre clientes na interface. No mock os dados já estão todos no storage, mas o fluxo "autorizado" falha. Na integração, é IDOR/BOLA.
- **Correção:**
  - E-mail único (índice único sem distinção de maiúsculas) e com formato validado.
  - Verificar o e-mail novo por link (double opt-in).
  - Nunca derivar a autorização sobre dados de cliente de um e-mail mutável. Usar um `customerId` imutável no JWT ou no token do portal (`/portal/orders/{token}`).
- **Hoje:** sim (interface). **Integração:** crítico (BOLA).

#### S-06: switch-profile não exige sessão, e o ticket não fica vinculado à sessão que o criou
- **Onde:**
  - `server.ts:25-33`: `ReauthTicket` não tem `sessionId`.
  - `server.ts:390,397-411`: `currentSession` é opcional.
  - `server.ts:320-328`: em SWITCH_PROFILE, as credenciais identificam o **alvo**.
- **Descrição:**
  - **Ticket ao portador:** o ticket (192 bits) funciona como credencial ao portador. Quem o tiver ganha uma sessão completa do usuário alvo, sem token Bearer, sem vínculo de IP e sem vínculo com a sessão de origem.
  - **Segundo endpoint de login:** na prática, o fluxo é outro login. Um `cliente` autenticado pode testar a senha do luthier via `/reauthenticate`, com contadores separados dos do login (S-03).
  - **Sem escalada sem a senha do alvo:** o `targetRole` do corpo só filtra (`:326`), e o papel do ticket vem do usuário real (`:369`). **A escalada via `targetRole` foi refutada.**
- **Impacto:** um ticket vazado (log, proxy, memória) vira tomada de conta. Sem vínculo com a sessão, a janela de 5 min não protege nada.
- **Correção:**
  - Exigir sessão (401 se `!currentSession`).
  - Guardar o `sessionId` no ticket e conferi-lo na troca.
  - Melhor ainda: remover o conceito. "Trocar de perfil" não deve existir em produção. Cada pessoa tem a própria conta, e trocar de conta é sair e entrar.
  ```ts
  if (!currentSession || reauth.sessionId !== currentSession.id) return res.status(403)...
  ```
- **Hoje:** sim (limitado). **Integração:** alto.

#### S-07: switchProfile grava só no sessionStorage, e o token antigo do localStorage vence no reload
- **Onde:**
  - `AuthContext.tsx:52,56`: a leitura dá prioridade ao localStorage.
  - `AuthContext.tsx:210-217`: a gravação vai só para o sessionStorage.
  - `server.ts:408-410`: o servidor invalida a sessão antiga.
- **Descrição:**
  - **Token revogado no aparelho:** com "lembrar-me", o localStorage guarda o token antigo, já revogado no servidor.
  - **Deslogado no reload:** ao recarregar, `getMe` recebe 401 e o catch (`:85-95`) apaga tudo. O usuário é deslogado e a sessão nova se perde.
  - **Dados residuais:** o e-mail e o telefone do perfil antigo (`luthier_auth_user`) continuam no localStorage depois da troca.
  - **Duração fixa:** o servidor sempre emite sessões de 2 h na troca (`server.ts:421`), ignorando o `rememberMe`.
- **Impacto:** funcional (o usuário cai deslogado) e dados pessoais residuais.
- **Correção:** uma única `persistSession(token, user, remember)` que limpa os dois storages antes de gravar. Na integração, cookie `HttpOnly`.
- **Hoje:** sim. **Integração:** médio.

#### S-08: Sem cabeçalhos de segurança, sem CSP e sem proteção contra clickjacking
- **Onde:** `server.ts:210-211,596-599` e `index.html`.
- **Descrição:**
  - Não há helmet, e o Express expõe `X-Powered-By: Express`.
  - Faltam CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (o app usa câmera e leitor de código de barras) e `frame-ancestors`.
  - Por isso o app, inclusive o `ReauthBottomSheet`, pode ser embutido em iframe (clickjacking).
  - A CSP é viável: o `index.html` não tem script inline nem de CDN. Há só fontes do Google (CSS e fonte) e imagens do Unsplash.
- **Correção (produção):**
  ```ts
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["https://fonts.gstatic.com"], imgSrc: ["'self'", "data:", "blob:", "https:"],
    connectSrc: ["'self'"], frameAncestors: ["'none'"], objectSrc: ["'none'"],
  } } }));
  ```
  Em desenvolvimento, relaxar a CSP, porque o Vite injeta o preamble do HMR.
- **Hoje:** sim. **Integração:** alto (a CSP é a principal defesa contra roubo de token guardado em web storage).

#### S-09: validate-action libera por padrão, o front não o usa, e o controle de papéis existe só na interface
- **Onde:** `server.ts:566-584`, `authApi.ts:176` e `authApi.ts:167`.
- **Descrição:**
  - Qualquer `action` fora de `adminOnlyActions` (um typo, `view_financials` em minúsculas, `undefined`) recebe `{allowed: true}`.
  - O front **não chama** `validateAction` nem `getPermissions`: nenhum `.tsx` os usa. Os papéis são aplicados só no cliente, via `currentRole`. O `ROLE_PERMISSIONS` também não é usado.
  - Toda alteração de dados é local; não há nenhum endpoint de dados.
- **Correção:** negar por padrão, com uma enumeração (`const POLICY: Record<Action, Role[]>`), e responder 403 para ação desconhecida. Na integração, autorização em cada endpoint (`@PreAuthorize`) com os papéis `ADMIN/LUTHIER/ATENDENTE/ESTOQUISTA`.
- **Hoje:** não é explorável de forma útil, porque o endpoint não protege nada. **Integração:** crítico, se o padrão de liberar por padrão for copiado.

#### S-10: Audit log com IP forjável, sujeito a inundação e com evidência apagável
- **Onde:**
  - `server.ts:136`: `x-forwarded-for` cru, sem `trust proxy`, sem validação e sem limite de tamanho.
  - `server.ts:139-140`: limite de 200 itens.
  - `server.ts:512`: forgot-password sem rate limit.
  - `server.ts:229`: um registro a cada tentativa bloqueada.
  - `server.ts:344,358`: `details` monta texto com o `actionType` enviado pelo cliente.
- **Descrição:**
  - **IP forjável:** qualquer um define `X-Forwarded-For: 10.0.0.1`, para incriminar outra pessoa ou se esconder.
  - **Evidência apagável:** requisições anônimas em loop empurram os 200 registros legítimos para fora (`unshift` + `pop`).
  - **Registros falsos:** o `actionType` e o `identifier` controlados pelo usuário vão para `details` e `maskedIdentifier` e aparecem para o admin. O React escapa o texto (`AccountSettingsModal.tsx:258-268`), então **não há XSS**, mas dá para forjar registros com aparência legítima (log injection semântico).
  - **Sem escopo de tenant:** o log é global. `/audit-logs` mostra tudo, inclusive `userId` e IP.
  - **Sem persistência:** fica só em memória.
- **Correção:**
  - `app.set('trust proxy', N)` e uso de `req.ip`.
  - Limite de registros por IP.
  - `details` a partir de um enum, com campos truncados.
  - Persistência só de inclusão (append-only), com política de retenção.
  - Na integração, audit separado por tenant.
- **Hoje:** sim. **Integração:** alto.

#### S-11: Enumeração de usuários por timing e PBKDF2 síncrono
- **Onde:**
  - `server.ts:48-50`: `pbkdf2Sync` com 10.000 iterações, SHA-512.
  - `server.ts:248-252`: para usuário inexistente, o código retorna sem calcular hash.
  - `server.ts:255`: cálculo do hash para usuário existente.
- **Descrição:**
  - **Enumeração:** a diferença de tempo entre "usuário não existe" (rápido) e "senha errada" (hash completo) revela quais e-mails e CPFs existem. A mensagem é uniforme; o tempo, não.
  - **Event loop bloqueado:** o hash bloqueia o event loop. O DoS é limitado pelo bloqueio após 5 falhas por chave, mas as chaves podem variar (e-mail, CPF, reauth).
  - **Iterações insuficientes:** a OWASP recomenda 210.000 ou mais para PBKDF2-HMAC-SHA512.
- **Correção:** calcular um hash fictício quando o usuário não existe e usar a versão assíncrona (`crypto.pbkdf2` ou `scrypt`). Na integração, argon2id/bcrypt no Spring Security com `DelegatingPasswordEncoder`.
- **Hoje:** sim, mas com pouco impacto (os e-mails demo são públicos). **Integração:** médio. **Severidade final:** MEDIUM para a enumeração e LOW para o DoS.

#### S-12: Sessões e tickets sem revogação na troca de senha, sem varredura e sem timeout de inatividade no servidor; o cliente ignora `expiresAt`
- **Onde:**
  - `server.ts:96-97`: os Maps não são limpos; um item só sai quando é acessado.
  - `server.ts:463-466`: senha nova não revoga as outras sessões.
  - `server.ts:272`: 24 h com "lembrar-me", sem timeout de inatividade.
  - `AuthContext.tsx:46-48,104-126`: a inatividade é controlada só no cliente.
  - `server.ts:284-288`: o `expiresAt` é devolvido e nunca usado pelo front.
  - `server.ts:106`: `failedAttempts` cresce com chaves de até ~100 KB (o limite padrão do `express.json`).
- **Descrição:**
  - **Token roubado continua válido:** trocar a senha por suspeita de comprometimento não derruba um token roubado, que continua valendo por até 24 h.
  - **Inatividade só no cliente:** o timer de 15 min é um `setTimeout`, suspenso quando a aba vai para segundo plano ou o aparelho dorme. O servidor não impõe nada.
  - **Memória sem limite:** cresce com um flood de identificadores únicos.
  - **Sessão expirada passa despercebida:** como os dados de negócio são locais, uma sessão expirada no servidor não impede o uso do app; isso só é percebido no reload.
- **Correção:**
  - Revogar todas as sessões do usuário na troca de senha.
  - Varrer os Maps com `setInterval(...).unref()` ou TTL.
  - Limitar o tamanho das chaves.
  - Na integração: JWT de 15 min e refresh token rotativo, com detecção de reuso e revogação por família.
- **Hoje:** sim (pouca gravidade). **Integração:** alto.

### LOW

#### S-13: Sem error handler JSON; stack trace em erros 500 e 400 em HTML fora do modo produção *(reconferido)*
- **Onde:** `server.ts:210-211,594-599`. Não há `app.use((err, req, res, next) => …)` nem 404 para `/api/*`.
- **Descrição:**
  - **Stack trace exposto:** com `npm start` (que não define `NODE_ENV=production`), o handler padrão do Express devolve o stack trace com caminhos absolutos. Dá para provocar isso com JSON malformado, `phone: 123` ou `newPassword` em array.
  - **Resposta em HTML:** com `NODE_ENV=production` o trace some, mas a resposta continua em HTML.
  - **Rota inexistente vira `index.html`:** em produção, `GET /api/qualquer` cai no `app.get('*')` e devolve o `index.html` com 200. O `authApi` chama `res.json()` e estoura um `SyntaxError` sem mensagem útil.
- **Correção:** um `app.use('/api', notFoundJson)` e um handler final `app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: 'Erro interno' }))`. Definir `NODE_ENV=production` no `start`. Na integração, usar RFC 9457 `problem+json`.
- **Hoje:** sim. **Integração:** baixo, desde que os erros do Spring não exponham detalhes.

#### S-14: Dependência vulnerável: body-parser 1.20.8 (high)
- **Onde:** `package.json`. O `express ^4.21.2` instala o body-parser 1.20.8 (express 4.22.3).
- **Descrição:** o `npm audit` aponta 1 vulnerabilidade high: DoS por bytes extras depois de um corpo comprimido, corrigido na 1.20.9. Não há outras (info 0, low 0, moderate 0, critical 0).
- **Correção:**
  - `npm audit fix` (a correção está marcada como disponível) ou atualizar o express dentro da 4.x.
  - Se for avaliar o Express 5: lá o `req.body` vem `undefined` quando não há corpo, o que quebra as desestruturações em `server.ts:217,299,…`.
- **Hoje:** sim (exige acesso de rede ao servidor). **Integração:** não se aplica (o mock será descartado), mas o `npm audit` continua valendo para as dependências do front.

#### S-15: Logout sem revogação garantida e senha mantida no estado do React
- **Onde:** `authApi.ts:134-143` (engole erro de rede), `AuthContext.tsx:147-158`, `ReauthBottomSheet.tsx:28-29,128-134`.
- **Descrição:**
  - **Logout offline:** se a chamada de logout falhar por rede, o token é apagado só no aparelho e continua válido no servidor até expirar (até 24 h), sem nova tentativa.
  - **Servidor correto:** o lado do servidor funciona quando o token chega (`server.ts:493-501` faz `sessions.delete`), então o problema é só no cenário offline.
  - **Senha esquecida em memória:** depois da reautenticação, `password` continua no `useState` até o sheet ser reaberto (`:52` só limpa ao abrir).
- **Correção:** guardar revogações pendentes para enviar depois, limpar com `setPassword('')` no `finally` e usar `autocomplete` adequado.
- **Hoje:** sim. **Integração:** médio (refresh token).

#### S-16: `window.open` sem `noopener` e número do luthier fixo no código
- **Onde:** `ClientPortalView.tsx:80`, `ClientsModule.tsx:215,267`, `OrdersModule.tsx:271`, `OrderDetailSheet.tsx:146` e `MoreModule.tsx:72`.
- **Descrição:**
  - `window.open(…, '_blank')` não aplica `noopener` implicitamente (isso só vale para âncoras), então a página `wa.me` recebe `window.opener`.
  - O número `5511987654321` está fixo no portal (`:80`).
  - O número do cliente passa por `replace(/\D/g, '')`, então **não há injeção de URL**.
- **Correção:** `window.open(url, '_blank', 'noopener,noreferrer')` e número vindo da configuração da oficina.
- **Hoje:** sim (pouco impacto). **Integração:** baixo.

#### S-17: forgot-password devolve o token de recuperação para quem chamou
- **Onde:** `server.ts:504-519`, campo `mockToken` em `:517`.
- **Descrição:**
  - O endpoint anônimo devolve `mockToken: 'recov_…'` para qualquer identificador, exista ou não.
  - O front ignora o campo (`authApi.forgotPassword` tipa só `message`), e não há reset implementado.
  - Se o padrão for levado adiante, a resposta passaria a carregar o token de reset, o que permite tomar a conta.
  - Não há rate limit nem limite de tamanho do identificador.
- **Correção:** remover o campo, enviar o link só por e-mail, responder de forma uniforme em tempo e conteúdo, e aplicar rate limit por IP e por conta.
- **Hoje:** não (inofensivo). **Integração:** crítico, se for mantido.

#### S-18: Papel inicial `luthier` no AppContext, independente do usuário
- **Onde:** `AppContext.tsx:140` (`useState<UserRole>('luthier')`) e `AuthGuard.tsx:11-16`.
- **Descrição:**
  - **Flash de dados:** o papel padrão do `AppContext` é `luthier` e só é sincronizado com `user.role` depois de um `useEffect`. Há um ciclo de render em que um `cliente` vê a interface de luthier.
  - **Papel duplicado:** a interface usa `currentRole`, não o `user.role` vindo do servidor.
  - **Menu de teste exposto:** o menu "Alternar Persona de Teste" (`Header.tsx:183`) aparece para qualquer usuário autenticado.
- **Correção:** derivar o papel de `useAuth().user.role` (uma fonte só), começando em `null`, e esconder o menu de personas em produção.
- **Hoje:** sim (cosmético). **Integração:** baixo.

### INFO (fazem parte do desenho do mock; C-02 e C-04 sobem para HIGH/CRITICAL na integração)

#### C-01: Token em web storage, sem sink de XSS hoje mas com impacto alto se surgir um
- **Onde:** `AuthContext.tsx:51-58,135-139,216-217`.
- **Verificado:**
  - Não há `dangerouslySetInnerHTML`, `innerHTML` nem `eval` em `src/`.
  - O React escapa os dados do audit log.
  - Não há `import.meta.env.VITE_*` nem `process.env` no bundle, e o `vite.config.ts` não tem `define`. A `GEMINI_API_KEY` não chega ao cliente.
  - `.env*` está no `.gitignore`.
- **Risco residual:** não há CSP (S-08) e o CSS das fontes do Google é um canal de injeção de estilo. Qualquer XSS futuro, extensão ou dependência comprometida lê o `luthier_auth_token` (válido por 24 h) e a base inteira (S-02).
- **Na integração:** access token só em memória; refresh token em cookie `HttpOnly; Secure; SameSite=Strict`, com proteção CSRF (double-submit ou verificação de Origin) no endpoint de refresh.

#### C-02: Logout e troca de perfil não limpam os dados de negócio
- **Onde:** `AuthContext.tsx:147-158` (logout) e `:205-222` (só `luthier_os_wizard_draft` é limpo).
- **Descrição:**
  - **Dados herdados:** `luthier_clients|instruments|orders|stock|payments|movements` continuam no localStorage e na memória (o `AppProvider` fica acima do `AuthGuard` em `App.tsx`). Num balcão ou bancada compartilhados, o próximo usuário herda tudo.
  - **Rascunho do wizard:** `NewOrderWizardModal.tsx:93-113` guarda `reportedIssue` e `selectedClientId`, e só é limpo na troca de perfil e ao concluir a OS, não no logout nem na expiração.
  - **Expiração:** quando a sessão expira (catch em `:85-95`), nada é limpo.
- **Correção:** uma função `clearLocalData()` única (todas as chaves `luthier_*`, menos preferências), chamada no logout, na expiração, na troca de usuário e em qualquer 401.
- **Hoje:** sim. **Integração:** alto (aparelho compartilhado).

#### C-03: `JSON.parse` sem try/catch nem validação de schema
- **Onde:** `AuthContext.tsx:57` e `AppContext.tsx:111,116,121,126,131,136`, todos em inicializadores de `useState`. O único protegido é `NewOrderWizardModal.tsx:96-101`.
- **Descrição:**
  - **Tela branca:** um valor corrompido ou adulterado lança erro no render inicial e derruba a árvore, até alguém limpar o storage.
  - **Tipo não verificado:** um objeto no lugar de um array quebra os `.filter`/`.map`.
  - **Adulteração aceita:** preços, status e `clientId` modificados são aceitos sem checagem.
- **Correção:** um helper `readJson<T>(key, schema, fallback)` com try/catch e zod, que descarta e recria o valor quando ele é inválido.
- **Hoje:** sim (disponibilidade). **Integração:** moderado (os dados virão da API, mas qualquer cache local precisa do mesmo cuidado).

#### C-04: ClientPortalView cai em cli-1 ou `clients[0]`
- **Onde:** `ClientPortalView.tsx:33-38`.
- **Descrição:**
  - **Fail-open:** se o e-mail do usuário não casar com nenhum cliente, o portal mostra os dados de `cli-1` ou do primeiro cliente, em vez de bloquear.
  - **Lista vazia:** com `clients` vazio, `currentClient.id` (`:38`) lança.
  - **E-mail mutável:** o casamento é por e-mail mutável (ver S-05).
  - **Aprovação sem servidor:** aprovar e recusar orçamento (`approveQuote`/`rejectQuote`) é só local, sem verificação do servidor nem de dono.
  - **Banner incorreto:** o banner diz "sem senha", mas o `cliente` do mock tem senha. O portal real (token por OS) usa outro modelo.
- **Correção:** fechar por padrão (tela "conta sem cliente vinculado") e vincular por um `customerId` imutável vindo do servidor. Na integração, o servidor aplica o filtro de dono e valida a transição de estado.
- **Hoje:** sim (mock). **Integração:** crítico (BOLA).

## 5. Verificado e sem achado

- **CSRF:** não se aplica hoje.
  - A auth é Bearer em header, sem cookie.
  - O `express.json()` só aceita `application/json`, e sem CORS o navegador bloqueia leitura e escrita entre origens.
  - Vira requisito se o refresh token passar a cookie.
- **CORS:** não há middleware; vale o comportamento padrão de mesma origem, adequado ao mock.
- **Autorização por rota:**
  - Públicas por design: `login` e `forgot-password`.
  - Exigem sessão: `reauthenticate`, `sensitive-update`, `me`, `permissions`, `validate-action` e `audit-logs`.
  - `audit-logs` exige também `role === 'luthier'` (`:524`).
  - `logout` aceita a ausência de sessão.
  - `switch-profile` **não exige sessão** (S-06).
- **Escalada via `targetRole`/switch-profile:** refutada; exige as credenciais do alvo.
- **Tickets e tokens:** 192 e 256 bits via `crypto.randomBytes`. A busca é por lookup em Map, não em tempo constante, mas com essa entropia o risco é desprezível. São de uso único (`:411-412`, `:468-469`), e `actionType` e `userId` são verificados.
- **Path traversal:** `express.static('dist')` e `sendFile(path.resolve('dist/index.html'))` não usam entrada do usuário, e não há `fs` com input.
- **Segredos no bundle:** não há `VITE_*`, `import.meta.env` nem uso de `@google/genai`. Só as senhas demo (S-01).
- **Vite em desenvolvimento:** `createViteServer` em `middlewareMode`, atrás do Express em `0.0.0.0`, expõe o código-fonte na rede (mesmo ponto do S-01). O `server.fs.strict` protege `.env*` por padrão. O `allowedHosts` em middleware mode não foi testado.
- **Respostas:** `sanitizeUser` não devolve salt nem hash e mascara o CPF (`:181-193`). `/me` devolve só o próprio usuário.
- **Máscara no audit:** `maskIdentifier` esconde o CPF; do e-mail mostra as 2 primeiras letras e o domínio.

## 6. Tabela-resumo

| ID | Sev. | Título | Arquivo:linha | Hoje | Crítico na integração |
|---|---|---|---|---|---|
| S-01 | HIGH | Credenciais demo sem guarda, no bundle, servidor em 0.0.0.0 | `server.ts:53-93,602-604`; `LoginPage.tsx:345-361`; `ReauthBottomSheet.tsx:247` | Sim | Sim |
| S-02 | HIGH | Dados pessoais completos em localStorage, sem isolamento por papel | `AppContext.tsx:109-191`; `seedData.ts:9` | Sim | Sim |
| S-03 | HIGH | Rate limit por identificador: bloqueio de terceiros e contorno | `server.ts:225-238,306` | Sim | Sim |
| S-04 | MEDIUM | sensitive-update altera antes de validar; array trava a conta | `server.ts:457-466` | Sim | Médio |
| S-05 | MEDIUM | E-mail duplicado e mutável quebra o isolamento do portal | `server.ts:457-459`; `ClientPortalView.tsx:33` | Sim | Sim |
| S-06 | MEDIUM | switch-profile sem sessão; ticket sem vínculo | `server.ts:25-33,390-411` | Sim | Sim |
| S-07 | MEDIUM | Token antigo do localStorage vence no reload | `AuthContext.tsx:52-56,210-217` | Sim | Médio |
| S-08 | MEDIUM | Sem helmet, CSP nem proteção contra clickjacking | `server.ts:210`; `index.html` | Sim | Sim |
| S-09 | MEDIUM | validate-action libera por padrão e o front não o usa | `server.ts:566-584` | Não | Sim |
| S-10 | MEDIUM | Audit: IP forjável, inundação, evidência apagável | `server.ts:136-140,229,512` | Sim | Sim |
| S-11 | MEDIUM/LOW | Enumeração por timing; PBKDF2 síncrono | `server.ts:48-50,248-255` | Sim | Médio |
| S-12 | MEDIUM | Sessões não revogadas na troca de senha, sem varredura e sem timeout no servidor | `server.ts:96-97,272,463-466` | Sim | Sim |
| S-13 | LOW | Sem error handler JSON; stack trace exposto | `server.ts:210-211,596-599` | Sim | Baixo |
| S-14 | LOW | body-parser 1.20.8 (high) | `package.json` | Sim | N/A |
| S-15 | LOW | Logout offline sem revogação; senha no estado | `authApi.ts:134-143`; `ReauthBottomSheet.tsx:128-134` | Sim | Médio |
| S-16 | LOW | `window.open` sem `noopener` | `ClientPortalView.tsx:80` e outros | Sim | Baixo |
| S-17 | LOW | forgot-password devolve token de recuperação | `server.ts:517` | Não | Sim |
| S-18 | LOW | Papel inicial `luthier` no AppContext | `AppContext.tsx:140` | Sim | Baixo |
| C-01 | INFO | Token em web storage; sem sink de XSS hoje | `AuthContext.tsx:51-58` | Teórico | Sim |
| C-02 | INFO | Logout e troca de perfil não limpam os dados de negócio | `AuthContext.tsx:147-222` | Sim | Alto |
| C-03 | INFO | `JSON.parse` sem try/catch nem schema | `AppContext.tsx:111-136`; `AuthContext.tsx:57` | Sim | Médio |
| C-04 | INFO | Portal cai em outro cliente quando não acha o dono | `ClientPortalView.tsx:33-38` | Sim | Sim |

## 7. Pontos positivos

- Hash de senha com salt aleatório por usuário e comparação com `timingSafeEqual`.
- Tokens e tickets com boa entropia. Os tickets são de uso único, vinculados ao usuário e à ação, com janela de 5 min.
- Reautenticação para ações sensíveis. A troca de e-mail e senha confere `reauth.userId === session.userId` (`server.ts:452`).
- Mensagens de erro de login uniformes, CPF mascarado nas respostas e `sanitizeUser` sem segredos.
- Auth por Bearer em header, sem cookie, o que elimina CSRF hoje. Sem CORS aberto.
- `audit-logs` restrito ao luthier, com auditoria de login, reauth, troca de perfil e RBAC.
- Nada de `dangerouslySetInnerHTML`, `innerHTML` ou `eval`. Nenhum segredo real no repositório, `.env*` ignorado, nenhum `VITE_*`.
- Telefone limpo antes de entrar na URL do `wa.me`.
- `npm audit` com uma única vulnerabilidade.

## 8. Plano de correção priorizado

**P0: antes de expor o servidor fora da máquina local**
1. **S-01:**
   - Escutar em `127.0.0.1` por padrão, com `HOST` configurável.
   - Recusar a inicialização em produção quando houver usuários demo.
   - Esconder os botões e as senhas demo fora do modo `DEV`.
2. **S-14:** `npm audit fix`, depois rodar `npm run lint` e `npm run build`.
3. **S-08/S-13:**
   - Ligar o helmet (CSP, nosniff, frame-ancestors, referrer) e desligar o `x-powered-by`.
   - Adicionar error handler JSON e 404 para `/api/*`.
   - Definir `NODE_ENV=production` no `start`.

**P1: endurecer o mock**

4. **S-04/S-05:** validar por schema (zod) antes de alterar, calcular o hash antes de atribuir o salt, e exigir e-mail único e verificado.
5. **S-06:** exigir sessão e vincular o ticket a ela (`sessionId`).
6. **S-03/S-10:**
   - Rate limit por IP e por conta, com chave canônica.
   - `trust proxy` e `req.ip`.
   - `details` a partir de enum.
   - Não gravar log a cada tentativa bloqueada.
7. **S-12:**
   - Revogar as sessões na troca de senha.
   - Varrer os Maps e limitar o tamanho das chaves.
   - Timeout de inatividade no servidor.
8. **S-09:** negar por padrão no `validate-action` (e usá-lo, ou removê-lo).
9. **S-11:** hash fictício para usuário inexistente e hash assíncrono.

**P2: front-end**

10. **C-02/C-03:** `clearLocalData()` no logout, na expiração e na troca de perfil; `readJson` com try/catch e schema.
11. **S-07:** uma `persistSession()` única, que limpa os dois storages.
12. **S-02/C-04:**
    - Portal fechado por padrão, com vínculo por `customerId`.
    - Parar de gravar o CPF completo e as fotos em base64.
13. **S-15/S-16/S-17/S-18:**
    - Limpar a senha do estado.
    - Usar `noopener`.
    - Remover o `mockToken`.
    - Derivar o papel de `user.role`.

**P3: na integração com o `srv-lutheria`**
- **Remover do front o que vira backend:**
  - Sai a auth do `server.ts`, junto com `switch-profile` e os tickets de reauth.
  - A reautenticação vira step-up por JWT (claim `auth_time` ou endpoint dedicado).
  - A troca de perfil deixa de existir.
- **Tokens:** access token de 15 min em memória e refresh token rotativo em cookie `HttpOnly; Secure; SameSite=Strict`, com proteção CSRF e detecção de reuso.
- **Tenant:** o `tid` escopa dados, audit e rate limit. Registros de outro tenant respondem 404.
- **Papéis:** `ADMIN/LUTHIER/ATENDENTE/ESTOQUISTA` aplicados no servidor em cada endpoint, negando por padrão. A interface só reflete.
- **Portal do cliente:** por token de OS (`/portal/orders/{token}`), com alta entropia, expiração, rate limit e sem usar e-mail como chave.
- **Erros:** RFC 9457 sem detalhes internos; o front trata `Retry-After` e 429.
- **Storage:** nenhum dado pessoal em web storage. Se houver modo offline, IndexedDB criptografado, limpo no logout.
- **Pipeline:** `npm audit` e testes de segurança (Vitest/Playwright) cobrindo bloqueio de conta, ticket, isolamento do portal e RBAC.

## 9. Limitações

- Análise estática: nenhum cenário de exploração foi executado; todos foram inferidos do código.
- Não foram revisados `seedData.ts` (além do CPF), os componentes de interface que não tocam auth ou storage, nem o backend `srv-lutheria`.
- O `allowedHosts` do Vite em `middlewareMode` não foi testado.
- O comportamento exato do handler padrão do Express 4.22.3 foi inferido da documentação (stack trace só fora de `production`), não observado.
