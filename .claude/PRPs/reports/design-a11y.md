# Design e Acessibilidade por Tela: Oficina Luthier (srv-lutheria-front)

**Data:** 2026-11-08
**Modo:** somente leitura. Nenhum arquivo do projeto foi alterado. Nada foi renderizado.
**Autor:** agente `a11y-architect`. As razões de contraste foram **calculadas** pela sessão principal a partir da paleta oficial (`node_modules/tailwindcss/theme.css`, oklch → sRGB, fórmula WCAG).

**Correções feitas pela sessão principal:**
- O agente dizia que o Modo Bancada quebra ao *fechar*. Na verdade quebra ao **abrir**: o componente começa fechado, com menos hooks, e ao abrir passa a ter mais.
- O `index.html:5` foi conferido e tem mesmo `user-scalable=no`.

---

## 0. Escopo, método e legenda

- **Leitura:**
  - `README.md`, `CLAUDE.md`, `index.html`, `src/index.css` e `src/App.tsx`;
  - todos os arquivos de `src/components/**`;
  - o `AppContext.tsx`, só nos trechos de toast, confete e háptico.
- **Altura dos alvos:** calculada pelas classes do Tailwind v4. `text-xs` tem 12px de fonte e 16px de altura de linha, `text-sm` tem 20px e `text-base` tem 24px. Somam-se 2px quando há `border`. O que depende de medir visualmente está marcado **(est.)**.
- **Severidade:**
  - **[C]** bloqueia o uso;
  - **[H]** falha WCAG AA ou viola a ergonomia do projeto numa ação frequente;
  - **[M]** ação secundária ou inconsistência relevante;
  - **[L]** polimento.
- **Critérios WCAG 2.2 citados:** 1.1.1, 1.3.1, 1.4.1, 1.4.3, 1.4.4, 1.4.11, 2.1.1, 2.2.1, 2.2.2, 2.4.3, 2.4.7, 2.4.11 (Focus Not Obscured), 2.5.8, 3.3.1, 3.3.2, 3.3.4, 3.3.7, 3.3.8, 4.1.2 e 4.1.3.

### Razões de contraste (calculadas)

| Par (texto sobre fundo) | Razão | Veredito (AA: 4,5 para texto, 3,0 para componente) | Ocorrências |
|---|---|---|---|
| branco sobre `amber-600` (CTA primário) | **3,19:1** | FALHA | 31 |
| branco sobre `amber-500` (hover) | 2,15:1 | FALHA | n/a |
| branco sobre `emerald-600` (CTA de sucesso) | **3,67:1** | FALHA | 14 |
| `stone-500` sobre `stone-950` / `stone-900` / `stone-800` | 4,11 / **3,64** / 3,16 | FALHA | 32 textos + 10 placeholders |
| `stone-600` sobre `stone-950` / `stone-900` | 2,58 / 2,29 | FALHA | 3 |
| borda `stone-800` / `stone-700` sobre `stone-950` (campos) | **1,30** / 1,92 | FALHA 1.4.11 | quase todos os inputs |
| botão desabilitado (branco/50 sobre `amber-600`/50) | 2,30 | isento, mas pouco perceptível | n/a |
| `stone-400` sobre `stone-950` / `stone-900` / `stone-800` | 7,63 / 6,76 / 5,87 | OK | n/a |
| `amber-400` sobre `stone-950` / `stone-900` | 11,50 / 10,19 | OK | n/a |
| `rose-400` sobre `stone-900`, `emerald-400` sobre `stone-900` | 6,12 / 9,05 | OK | n/a |
| badges (`amber-300`/`amber-950`, `sky-300`/`sky-950`, `rose-300`/`rose-950`) | 8,1 a 10,8 | OK | n/a |
| **Correção proposta:** `stone-950` sobre `amber-600` / `amber-500` | **6,19 / 9,21** | OK | n/a |
| **Correção proposta:** branco sobre `emerald-700` / `amber-700` / `rose-600` | **5,37 / 5,05 / 4,51** | OK (`rose-600` no limite) | n/a |

**Ainda vale medir com ferramenta** (dependem de opacidade ou degradê):
- a contagem com `opacity-75` dos chips;
- o tile "NOVA OS" (degradê de `amber-600` para `amber-700`, com subtexto `amber-200/90`);
- textos sobre `bg-stone-950/60` aplicados sobre degradê, na tela Hoje.

**Outras contagens no código:**
- 167 textos de 9-11px;
- 19 `focus:outline-none` e nenhum `focus-visible`;
- 13 animações infinitas e nenhum `motion-reduce`.

---

## 1. Login (`LoginPage`) e Esqueci a senha (`ForgotPasswordModal`)

**Contraste**
- [H] O CTA "Entrar no Sistema" é branco sobre `amber-600` (3,19:1), em texto de 14px bold, que não conta como texto grande (`LoginPage.tsx:319-323`).
- [H] Placeholders em `stone-500` (3,64:1) em `:237` e `:283`, e em `ForgotPasswordModal.tsx:110`.
- [M] Textos de 10-11px em `stone-500` sobre `stone-950` (4,11:1): a dica de CPF (`:368`) e o aviso de LGPD (`:376`).
- [L] O estado desabilitado (`bg-stone-800 text-stone-500`, `:321`) se distingue só pela cor.

**Alvos de toque**
- OK: inputs de ≈54px, CTA de ≈52px, botão de olho de ≈48×46px (`:286-293`).
- [M] "Esqueci minha senha" tem ≈16px de altura (`:263-269`).
- [M] O checkbox "Manter conectado" tem 16px (`:299-311`).
- [M] No Forgot: inputs de ≈38px, botões de ≈36px (`:111,119,126`) e X de 28px.

**Zona do polegar:** o CTA fica no meio-inferior. Aceitável.

**Estrutura**
- [C] O campo de identificador começa com `inputMode="numeric"` (`:228`): `isEmailMode` só vira verdadeiro depois que se digita um `@`. No celular, o teclado numérico não tem letras nem `@`, e digitar o e-mail fica impossível. Só funcionam CPF, autofill, colar ou os botões de demo. (est., testar em aparelho)
- [H] O Forgot não tem `role="dialog"`, `aria-modal`, foco controlado, Escape nem retorno de foco (`:51`). O X (`:58-66`) não tem nome acessível.
- [H] No Forgot, o `<label>` não tem `htmlFor` (`:102`). Erro (`:94`) e sucesso (`:71-76`) não têm `role="alert"`/`status`, e o foco se perde quando o formulário dá lugar à mensagem de sucesso.
- [M] A contagem regressiva do bloqueio fica dentro de um `role="alert"` (`:185-197`), e o leitor de tela pode reler a mensagem a cada segundo.
- [M] Senha vazia mostra só um erro geral, sem `aria-invalid` e sem levar o foco ao campo (`:111-114`).
- [M] Inputs de 12px no Forgot, o que faz o iOS dar zoom ao focar.
- [L] Credenciais demo na tela (`:338-371`), `select-none` na raiz (`:152`) e cartões demo com texto de 10-11px.

**Hierarquia:** um único CTA claro e um `h1` presente.

Totais: C1 H4 M7 L4. **Nota: C**

---

## 2. Shell global: Header, BottomTabBar, ToastContainer e GlobalSearchModal

**Header (`Header.tsx`)**
- [H] Botões de 28-30px de altura (est.) e sem nome confiável:
  - a pílula de sync (`:100-121`) e "Bancada" (`:126-135`) escondem o texto abaixo de `sm` e ficam só com `title`;
  - o seletor de persona (`:150-168`) tem só emoji e um badge de 9px;
  - a busca tem `aria-label`, mas mede ≈30px.
- [H] O menu de persona não tem `aria-expanded`, `aria-haspopup`, `role="menu"`, Escape nem controle de foco. O fundo clicável é um `div onClick` (`:170-259`).
- [M] O botão de tema não faz nada (`:138-146`): a classe `.dark` é aplicada, mas o Tailwind v4 usa `prefers-color-scheme`. Também não tem `aria-pressed`.
- [M] Os itens de conta e sair têm ≈28px. "Restaurar Dados Demo" (≈24px) fica ao lado de "Sair" e apaga os dados sem pedir confirmação (`:225,236,245-255`).
- [M] Header sem `pt-safe`, embora o `index.html:14` use `black-translucent` e `viewport-fit=cover`: num PWA no iPhone, o header fica sob o notch. O mesmo vale para a Bancada e a Busca.
- [M] Badges de 9-11px. A busca fica no topo, fora da zona do polegar.
- [L] `hidden xs:inline-block` (`:72`): o breakpoint `xs:` não existe no v4, então o badge "Mobile" nunca aparece.
- [L] `animate-pulse` infinito na pílula de offline (`:108`).

**BottomTabBar (`BottomTabBar.tsx`)**
- Positivo:
  - altura `h-16` (64px), abas `flex-1` com `min-w-[48px]`;
  - `<nav aria-label>` e FAB com `aria-label`;
  - ≈50px por aba em 320px de largura.
- [H] Não há `aria-current="page"`. A aba ativa se distingue só por cor, peso da fonte e uma barra de 2px (`:48-56`).
- [H] O FAB usa `focus:outline-none` sem nada no lugar (`:92`): falha 2.4.7 para quem navega por teclado.
- [H] O ponto vermelho de estoque baixo é só cor (`:133`). O contador de OS entra no nome da aba ("7OS") e é branco sobre `amber-600`, com 9px de fonte (3,19:1).
- [L] O `pb-safe` soma 16px fixos, e o toast em `bottom-20` encosta no FAB (est.).

**ToastContainer (`ToastContainer.tsx`)**
- [H] A região live só existe enquanto há toasts (`:8`), o que torna o anúncio pelo leitor de tela pouco confiável. O tipo do toast aparece só pelo ícone, e título e descrição usam `truncate` (`:32,36`).
- [H] Todo toast some em 4,5 s (`AppContext.tsx:217`), inclusive os que têm "Desfazer" (≈26px). O X tem 24px. Falha 2.2.1 e fica no limite do 2.5.8.

**GlobalSearchModal (`GlobalSearchModal.tsx`)**
- [H] Não tem `role="dialog"`, Escape nem controle de foco. O input não tem label (`:118-125`). O X de limpar tem ≈20px e nenhum nome (`:127-133`). "Cancelar" tem ≈32px.
- [H] Os instrumentos encontrados são calculados (`:57-62`) e somados ao total, mas **nunca aparecem na tela**. Buscar por número de série mostra uma lista vazia, sem nem a mensagem de "nenhum resultado".
- [M] Clicar num cliente ou item de estoque só troca de aba (`:98-110`).
- [M] A contagem de resultados não tem `aria-live`, e os títulos de grupo são `span`.
- [M] "Limpar" tem 3,64:1, e os chips de buscas recentes têm ≈30px.
- Positivo: as linhas de resultado têm ≈59px.

**Global**
- [H] `index.html:5` tem `maximum-scale=1.0, user-scalable=no`, o que impede o zoom (1.4.4). *(reconferido)*
- [M] Não há skip link. Trocar de aba não move o foco nem atualiza o `document.title`. Não há `scroll-padding`, então o header sticky e a barra inferior (≈80px) podem cobrir o elemento focado (2.4.11).
- [L] O `body` tem `bg-stone-100` (`index.html:19`), que aparece clara no overscroll.

Totais: H10 M9 L5. **Nota: D**

---

## 3. Hoje (`HomeModule`)

**Contraste**
- [H] O tile "NOVA OS" é branco sobre um degradê de `amber-600` para `amber-700` (3,19 a 5,05:1). O subtexto `amber-200/90` tem 10px (`:178-186`). Medir com ferramenta.
- [M] Rótulos de 10px em `stone-500` sobre `bg-stone-950/60` (≈4:1, est.) em `:97,106,115,138`.

**Alvos de toque**
- [H] "Avançar", "Entregar" e "Detalhes" têm ≈28px (`:384-415`). "Avançar" muda o status sem pedir confirmação, no cartão mais usado da tela.
- [M] "Ver Todas" tem ≈16px de altura (`:308-315`).
- Positivo: os tiles de ação rápida têm ≈96px.

**Zona do polegar:** as ações rápidas ficam no meio da tela; o FAB cobre a ação principal.

**Hierarquia e conteúdo**
- [M] Só 3 estilos de badge para 7 status. Os rótulos saem de `replace('_',' ')` e, em caixa alta, viram "EM EXECUCAO", sem acento (`:363-373`).
- [M] A foto rápida vai sempre para `activeOrders[0]`, sem o usuário escolher a OS (`:48-62`).
- [M] Data cortada: "Prazo: 06-20" (`:380`).
- [M] Textos de desenvolvedor na interface: "(Zona do Polegar)" e "< 60 seg" (`:168,185`).
- [L] Emojis sem `aria-hidden` (`:71,345`). `alt="Foto"` em miniatura decorativa (`:341`). `toFixed(0)` no faturamento. `span` no lugar de `h2`.

**Estrutura**
- [H] 7 `div onClick` sem teclado e sem papel: 5 tiles (`:91,100,109,119,130`), o banner de estoque (`:146`) e a linha da OS (`:329`).

Totais: H3 M6 L3. **Nota: C-**

---

## 4. OS: lista e Kanban (`OrdersModule`)

**Contraste**
- [H] Branco sobre `amber-600` no toggle ativo (`:85,98`) e em "Nova OS" (`:111`). Placeholder em `stone-500` (`:73`).
- [M] Textos de 10px em `stone-500` (`:199,238,368`).

**Alvos de toque**
- [H] As ações de cada cartão têm ≈28px: "Ver Detalhes", WhatsApp (só com `title`, `:267-277`) e "Avançar" (`:281-288`). WhatsApp, que abre outro app, fica a só 6px de Avançar, que muda o status.
- [M] Chips de filtro de ≈30px, sem `aria-pressed`. A contagem com `opacity-75` dá ≈4,3:1 (est.).
- [M] O toggle Lista/Kanban tem ≈28px e esconde o rótulo abaixo de `sm`.
- [M] A busca não tem label e usa 12px.

**Zona do polegar:** "Nova OS" e a busca ficam no topo; o FAB compensa.

**Hierarquia e consistência**
- [H] `animate-pulse` infinito no badge de `em_execucao` (`:222`), sem respeitar `prefers-reduced-motion` (falha 2.2.2).
- [M] O Kanban tem só 5 colunas (`:313-320`): OS em orçamento, entregue ou cancelada não aparecem.
- [M] Rótulos de status sem acento. O `h4` combina `uppercase` com `capitalize` (`:329`).
- [L] `scrollbar-none` não existe no v4. Falta um `h2`. A barra de progresso não tem `role="progressbar"`.

**Estrutura**
- [H] Os cartões do Kanban são `div onClick` (`:342-349`), sem acesso por teclado.

Totais: H4 M7 L4. **Nota: C-**

---

## 5. Detalhe da OS (`OrderDetailSheet`)

**Contraste**
- [H] Branco sobre `emerald-600` (3,67:1) em "REGISTRAR ENTREGA", "Enviar Orçamento" e "Confirmar Pagamento" (`:545,628,708`).
- [H] Branco sobre `amber-600` (3,19:1) no CTA principal (`:686`), em "Aprovar" (`:555`) e nos passos do stepper.
- [H] Os passos futuros do stepper são `stone-600` sobre `stone-900/60` (≈2,3:1). Como são botões ativos, não estão isentos (`:237`).
- [M] Datas e horas de 10px em `stone-500`.

**Alvos de toque**
- [H] O CTA principal tem ≈44px (`py-3.5`), com texto longo em caixa alta. O botão de câmera tem ≈44px e só `title` (`:673-690`).
- [H] Os botões do stepper têm ≈24px (`:229-242`). Para o luthier, tocar num passo pula ou volta o status sem confirmação.
- [M] "Adicionar Serviço" tem ≈16px, "Nova Foto" ≈28px, os métodos de pagamento ≈28px e "Salvar" ≈32px.
- [M] As abas têm ≈28px e não usam `tablist`, `tab` nem `aria-selected`.
- [M] O telefone não é um link `tel:`.

**Zona do polegar:** a barra de ação fica fixa no rodapé (`:672-759`), como deveria.

**Estrutura**
- [C] O sheet não tem `role="dialog"`, `aria-modal`, foco inicial, Escape nem retorno de foco. Ele fica no fim do DOM (`App.tsx:58`), e o foco continua no cartão por trás. O X não tem nome. Para quem usa teclado ou leitor de tela, o conteúdo fica praticamente inalcançável.
- [H] Os serviços do checklist são `div onClick`, sem `role` nem `aria-checked` (`:359-410`). É a ação central do luthier, inacessível por teclado e leitor.
- [H] "Aprovar" não pede confirmação. Ao registrar a entrega com saldo pendente, o formulário de pagamento é aberto, mas só aparece na aba "Orçamento" (`:583` contra `:704-706`). O estado muda e nada fica visível.
- [M] Labels sem `htmlFor` (`:586,597`), inputs identificados só pelo placeholder e fonte de 12px.
- [M] Chips informativos parecem botões e usam `truncate`.
- [M] Moeda formatada com `toFixed` e ponto decimal. "cartao credito" e "AGUARDANDO APROVACAO" sem acento.
- [M] `h-[95vh]` em vez de `dvh`: no iOS, a barra de ação pode ficar sob a interface do navegador (est.).
- [M] A linha do tempo não usa `ol`/`li`.
- [L] `ph.tag` exibido cru, chip "Bancada & Dono (Admin)" no cabeçalho, `hover:scale` nas fotos.

Totais: C1 H5 M8 L3. **Nota: D**

---

## 6. Nova OS: wizard de 3 passos (`NewOrderWizardModal`)

**Contraste**
- [H] "ABRIR ORDEM DE SERVIÇO AGORA" (branco sobre `emerald-600`, 3,67:1) e "Avançar" (branco sobre `amber-600`, 3,19:1), em `:720,729`.

**Alvos de toque**
- [H] "Voltar" e "Avançar", no rodapé, têm ≈40px.
- [H] "Fotografar Agora" tem ≈24px e "Falar" ≈20px (`:523-531,574-585`). São os dois recursos centrais da meta de foto primeiro e ditado, e têm os menores alvos da tela. "Falar" falha o 2.5.8.
- [H] Os chips de tipo, prazo, prioridade e serviços têm 32-36px, sem `aria-pressed`/`checked`. O estado depende só da cor.
- [M] O botão de remover foto tem 16px e nenhum nome. Todas as fotos têm `alt="Foto OS"`.

**Zona do polegar:** os botões de navegação ficam no rodapé, como deveria. O X fecha o wizard sem confirmar a perda dos dados.

**Estrutura**
- [C] Não há `role="dialog"`, foco nem Escape. Também não há `<form>`, então Enter não avança. O X tem 28px e nenhum nome. É o fluxo principal do produto.
- [H] A validação acontece só por toast (`:190,201,209,229`). Não há `required`, `aria-required` nem `aria-invalid` (falha 3.3.1).
- [H] A lista de clientes não tem busca, e mostra só ~4 itens visíveis (`max-h-56`).
- [M] Valores inventados aplicados em silêncio:
  - instrumento "Fender Stratocaster";
  - telefone `(11) 99999-0000` e e-mail fictício;
  - serviço padrão de R$150;
  - o ditado simulado insere texto falso quando o navegador não tem reconhecimento de voz.
- [M] Cliente e instrumento são criados antes da confirmação final. Voltar e trocar de cliente mantém o instrumento escolhido para o cliente anterior.
- [M] O passo 3 não mostra total nem resumo.
- [M] 10 labels sem `htmlFor`. A barra de progresso não tem `role="progressbar"`, e a troca de passo não é anunciada.
- [L] `hover:bg-stone-850` não existe. O wizard oferece 6 tipos de instrumento, contra 8 na tela de Clientes.

### Meta "< 60 s em 3 passos" (estimativa)
- **Cliente recorrente com instrumento já cadastrado:** ≈8 toques mais o ditado. Leva ≈25-40 s, **dentro da meta**.
- **Cliente novo com foto:** nome, telefone, tipo, marca e modelo (com valores pré-preenchidos errados), câmera nativa (3-4 toques) e defeito. Leva ≈70-120 s, **fora da meta**.
- **Bloqueios:**
  - botões de 40px;
  - nenhuma busca de cliente;
  - valores inventados para corrigir;
  - a foto vem depois do formulário do instrumento (não é "foto primeiro");
  - "Abrir Nova OS" na tela de Clientes não pré-seleciona o cliente.
- **Sugestões:**
  - foto no topo do passo 2;
  - busca e clientes recentes no passo 1;
  - botão "Abrir agora" já no passo 2;
  - pré-selecionar o cliente vindo de Clientes;
  - remover os valores inventados.

Totais: C1 H6 M6 L2. **Nota: D**

---

## 7. Clientes (`ClientsModule` e seus 2 modais)

**Contraste**
- [H] Branco sobre `amber-600` em "Novo Cliente", "Salvar Cliente" e "Cadastrar Instrumento" (`:153,535,648`).
- [M] "Calibre:" e "Afinação:" em `stone-500` com 11px (3,64:1).

**Alvos de toque**
- [H] Cada linha da lista tem 3 botões de ≈32px, a só 6px um do outro: WhatsApp e Ligar (só com `title`) e o chevron, **sem nenhum nome** (`:211-242`). Um toque errado dispara uma ligação.
- [M] No detalhe:
  - WhatsApp e Ligar têm ≈28px;
  - "← Voltar para lista" tem ≈16px e fica no topo;
  - "Adicionar Instrumento" e "Abrir Nova OS" têm ≈16px.
- [M] Inputs de ≈34px com 12px de fonte; botões dos modais de ≈36px.

**Estrutura**
- [H] Os 2 modais não têm `role="dialog"`, foco nem Escape. O X tem 28px e nenhum nome. São 11 labels sem `htmlFor`. Não há `max-h`/`overflow-y-auto`: com o teclado virtual aberto, o botão "Salvar" fica fora de alcance (est.).
- [H] A linha do histórico de OS é um `div onClick` (`:394-401`).
- [H] O CPF é gravado e exibido completo (`:308`), contra a regra de mascarar o CPF. O `isValidCpf` não é usado.
- [M] Valores inventados: telefone padrão, e-mail `nome@gmail.com` e "São Paulo" como endereço padrão.
- [M] Tipos de instrumento exibidos via `replace('_',' ')`, sem acento. A busca não tem label.
- [L] O `alt` do avatar repete o nome. "instrumento(s)". O botão Voltar do Android não funciona dentro do app (não há rotas).

Totais: H5 M6 L3. **Nota: D**

---

## 8. Estoque (`StockModule`) e leitor de código (`BarcodeScannerModal`)

**Contraste**
- [H] "Custo" e "(mínimo: n)" em `stone-500` com 10px (3,64:1, `:241,258`). É uma informação útil para decidir a reposição.
- [M] Branco sobre `amber-600` em "Escanear", no botão "+" e no "OK" do leitor.

**Alvos de toque**
- [H] Os botões −/+ têm 40×40px, embora o comentário no código diga "48px" (`:263-286`). Ficam a 6px um do outro e têm só `title`, sem o nome do item. É a ação mais frequente do módulo, e um toque errado altera o inventário.
- [H] "Escanear" tem ≈36px, fica no topo e esconde o rótulo abaixo de `sm`.
- [M] Os chips de categoria têm ≈30px.
- [M] As abas têm ≈28px e não usam `tablist`.
- [M] "Ver Itens" tem ≈16px e só limpa os filtros, em vez de mostrar o estoque baixo.

**Estrutura**
- [H] O leitor não tem `role="dialog"`, Escape nem foco. O X não tem nome. O input manual não tem label nem `<form>`, então Enter não confirma.
- [M] O leitor é simulado, sem vídeo. O laser usa `animate-bounce` infinito. A lista "Simular Leitura" é uma ferramenta de desenvolvedor exposta na interface.
- [M] Mudanças de quantidade não são anunciadas. Ao escanear, aparecem dois toasts.
- [L] A busca não tem label. O histórico mostra sempre "un". A tela "Estoque restrito" nunca é alcançada.
- Positivo: "Estoque Baixo" aparece como texto mais borda, e o histórico usa seta e sinal. Nada depende só da cor.

Totais: H4 M5 L2. **Nota: D+**

---

## 9. Mais (`MoreModule`: agenda, financeiro, mensagens e config)

- [M] Branco sobre `emerald-600` em "Enviar no WhatsApp" e branco sobre `amber-600` nos chips ativos.
- Positivo: a sub-navegação tem ≈52px de altura.
- [M] Alvos e campos pequenos:
  - chips da agenda com ≈26px;
  - botões de mensagem com ≈32px;
  - "Restaurar" com ≈36px;
  - o select tem ≈36px e o label não tem `htmlFor`.
- [H] As linhas da agenda são `div onClick` (`:177-183`).
- [M] Os filtros hoje/semana/todos não filtram nada.
- [M] O tile de data mostra o mês fixo "OUT".
- [M] Métricas inventadas: "+18%", "R$ 483,00" e "Pix 72%". "Mês atual" soma todos os pagamentos já feitos.
- [M] A sub-navegação não usa `tablist`.
- [M] A Config usa `subSection` em vez de `activeSubSection` (`:378`), e um atendente pode acabar vendo a tela.
- [M] "Copiar" mostra sucesso mesmo quando a cópia falha. O `select-none` impede selecionar a mensagem.
- [M] "Restaurar" apaga os dados sem confirmação. Rótulos sem acento.
- [L] `h4` sem `h3` acima; texto monoespaçado de 11px.

Totais: H1 M9 L2. **Nota: D**

---

## 10. Modo Bancada (`WorkbenchModeModal`), alvo de 64px

| Elemento | Altura | Resultado |
|---|---|---|
| Serviços do checklist (`min-h-[58px]`, `:208`) | 58px | **FALHA**, embora o comentário diga "GIANT" |
| "Iniciar Cronômetro" (`:283`) | ≈40px | FALHA |
| Reset do timer (`:306`) | ≈40px | FALHA |
| Presets do timer (10px, `:327`) | ≈28px | FALHA |
| "Sair do Modo" (`:114`) | ≈36px | FALHA |
| Seletor de OS (`:140`) | ≈52px | FALHA |
| Botões Foto e Avançar (`min-h-[90px]`) | ≥90px | OK |

**Estrutura**
- [C] Há hooks depois de um `return` condicional (`:35`, antes de `:42-68`). **Abrir** o modo bancada lança "Rendered more hooks than during the previous render", e sem Error Boundary a tela fica branca. *(Corrigido pela sessão principal: é ao abrir, não ao fechar. Confirmado também no react-review.)*
- [H] Os controles críticos estão abaixo de 64px (ver a tabela).
- [H] O checklist usa `<button>`, mas sem `aria-pressed`/`aria-checked`. O estado concluído aparece só por traço, ícone e cor.
- [H] "Sair do Modo" é pequeno e fica no topo. Foto e Avançar rolam com o conteúdo em vez de ficar fixos no rodapé.
- [H] "Iniciar Cronômetro" é branco sobre `emerald-600` (3,67:1). Não há `role="dialog"`, Escape nem foco, e esta é a segunda tela com `h1`.
- [M] O seletor lista `orders.slice(0,5)` e ignora `benchOrders`.
- [M] O preset ativo não é indicado, e o reset volta sempre para 30 min.
- [M] O fim do timer gera só um toast: sem som, sem vibração e sem Wake Lock (a tela pode apagar).
- [M] "AVANÇAR STATUS" não pede confirmação nem dá retorno.
- [L] `animate-pulse` infinito, rótulos sem acento, textos de 10-11px.
- Positivo: os tiles grandes têm bom contraste (branco sobre `emerald-800`/`amber-700`, ≥5:1).

Totais: C1 H5 M4 L3. **Nota: D**

---

## 11. Câmera (`CameraModal`)

- [H] Branco sobre `amber-600` em "Salvar Foto na OS" e nas tags ativas.
- [H] Alvos pequenos:
  - "Cancelar", "Salvar" e "Abrir Câmera ao Vivo" têm ≈40px;
  - as tags têm ≈24px;
  - "Ditado por voz" tem ≈20px.
- [H] O botão de disparo da câmera (56px) não tem nenhum nome acessível (`:229-235`).
- [H] Não há `role="dialog"`, Escape nem foco. O X não tem nome. As tags não têm `aria-pressed`.
- [M] "Galeria / Arquivo" usa `capture="environment"` e, no celular, abre a câmera, não a galeria.
- [M] As fotos de exemplo (Unsplash) podem ser salvas numa OS real. O ditado simulado insere texto falso.
- [M] Labels sem `htmlFor`. `animate-pulse` enquanto ouve, sem `aria-live`. Input de legenda de ≈34px com 12px de fonte.
- [L] Tags de exemplo com 10px. `92vh` em vez de `dvh`.
- Positivo: sheet inferior com rodapé fixo, `<h2>`, e o stream da câmera é encerrado ao fechar.

Totais: H4 M4 L2. **Nota: D+**

---

## 12. Portal do Cliente (`ClientPortalView`)

- [H] "APROVAR ORÇAMENTO EM 1 TOQUE" é branco sobre `emerald-600` (3,67:1).
- [H] Passos futuros da linha do tempo em `stone-500` sobre `stone-900` (3,64:1).
- [M] "Voltar p/ Luthier" tem ≈25px, os chips de instrumento ≈38px e "WhatsApp" ≈36px.
- Positivo: o CTA de aprovação tem ≈52px.
- [M] O CTA de aprovação não fica fixo e aparece abaixo da dobra.
- [H] A linha do tempo é só visual: sem `ol`, sem `aria-current="step"` e sem texto dizendo "concluído".
- [H] "Aprovar em 1 toque" assume um compromisso financeiro sem confirmação nem desfazer (3.3.4). Também não há como recusar: `rejectQuote` é importado mas não é usado.
- [H] Os passos não incluem "orçamento" nem "entregue". Nesses status, e em "cancelado", nenhum passo fica destacado.
- [H] O cliente vê controles da equipe: o seletor de persona no Header e o banner "Voltar p/ Luthier". O telefone de WhatsApp está fixo no código.
- [M] Status sem acento, data em formato ISO, tag `detalhe_defeito` exibida crua.
- [M] Os itens listam só a mão de obra, e o total não confere com a soma.
- [L] `animate-pulse` infinito, sem lightbox para as fotos.
- Positivo: `h1` presente, fotos com `alt` vindo da legenda, código de acompanhamento visível.

Totais: H4 M4 L2. **Nota: D**

---

## 13. Reautenticação (`ReauthBottomSheet`) e Conta & Segurança (`AccountSettingsModal`)

- [H] Branco sobre `amber-600` nos botões de confirmação.
- [M] "CPF: ***" em 11px `stone-500` (4,11:1).
- [M] Campos e botões pequenos:
  - inputs de ≈46px no Reauth e ≈38px (12px) na Conta;
  - botões de 36-40px;
  - "← Voltar aos dados" com ≈16px;
  - a nova senha não tem `autocomplete="new-password"` nem botão de mostrar/ocultar.
- [C] O Reauth, aberto a partir da Conta, aparece **por trás** dela: os dois usam `fixed z-50`, e o `ReauthBottomSheet` vem antes no DOM (`App.tsx:65-66`). "Salvar Dados Sensíveis" parece não fazer nada, e a promessa de reautenticação fica pendente. O fluxo de reautenticação exigido pelo CLAUDE.md fica bloqueado. *(Confirmado no react-review.)*
- [H] O Reauth tem `role="dialog"`, `aria-modal` e `aria-labelledby`, mas não tem Escape, prisão de foco nem retorno de foco. Tocar no fundo fecha e descarta o que foi digitado.
- [H] A Conta não tem `role="dialog"`, o X não tem nome, e 3 labels sem `htmlFor` deixam os campos de e-mail e telefone sem nome acessível.
- [H] O `statusMsg` não tem `role="alert"`/`status`.
- [M] "Senhas de teste" aparecem na interface.
- [L] O erro do Reauth não usa `aria-describedby`.
- Positivo: o CPF aparece mascarado na Conta, e o Reauth já preenche o identificador.

Totais: C1 H4 M5 L1. **Nota: D**

---

## Padrões transversais

| # | Padrão | Onde e quantos |
|---|---|---|
| 1 | Modais sem `role="dialog"`, foco, prisão de foco e Escape | Só o Reauth tem `role`/`aria-modal`. Não há handler de Escape em lugar nenhum. 10 modais sem nada disso |
| 2 | `<label>` sem `htmlFor` | 37 labels e só 5 `htmlFor` (Login e Reauth): ≈32 sem associação, em 11 arquivos |
| 3 | Botões só com ícone e sem nome | Só 5 arquivos usam `aria-label`. Mais de 15 botões dependem só de `title` |
| 4 | `div onClick` sem teclado | 14: Home 7, OS 2, Detalhe 1, Clientes 2, Mais 1, Wizard 1 |
| 5 | Branco sobre `amber-600`/`emerald-600` | 31 + 14 ocorrências. Praticamente todo CTA primário |
| 6 | Texto de 9-11px | 167 ocorrências em 18 arquivos, muitas em `stone-500` |
| 7 | Alvos abaixo de 48px | Dezenas. Predominam `py-1.5`+`text-xs` (≈28px) e `py-2.5`+`text-xs` (≈36px) |
| 8 | Placeholder no lugar de label, em `stone-500` | Todas as buscas e os formulários inline |
| 9 | Estado indicado só por cor | 0 usos de `aria-current`, `aria-selected`, `aria-pressed` e `aria-expanded` |
| 10 | Ações irreversíveis sem confirmação | Avançar status (4 telas), stepper, aprovar orçamento, restaurar dados |
| 11 | Animação infinita sem reduced-motion | 13 `animate-pulse/bounce/spin`, 0 `motion-reduce`. Confete em 3 lugares sem `disableForReducedMotion` |
| 12 | Foco | 19 `focus:outline-none`, 0 `focus-visible`. O FAB não tem substituto. Não há `scroll-padding` |
| 13 | Rótulos de status | `replace('_',' ')` em 13 lugares: sem acento e só troca o primeiro `_` |
| 14 | Formatação | Moeda com `toFixed` e ponto decimal ao lado de "R$ 483,00" fixo. Datas ISO cruas |
| 15 | Inputs com 12px | O iOS dá zoom ao focar. Só Login (16px) e Reauth (14px) escapam |
| 16 | Alturas em `vh` | 95/94/92/90vh nos sheets. Usar `dvh` |
| 17 | Bordas de campo | `stone-800` = 1,30:1 e `stone-700` = 1,92:1, abaixo dos 3:1 |
| 18 | Conteúdo de protótipo na interface | Credenciais demo, "(Zona do Polegar)", "Simular Leitura", fotos de exemplo, ditado simulado, métricas fixas |
| 19 | Classes que não geram CSS no v4 | `animate-in`, `fade-in`, `xs:`, `stone-850`, `scrollbar-none`, `dark:` |
| 20 | Um único nível de empilhamento | Todos os overlays usam `fixed z-50`, e a ordem no DOM decide quem fica por cima. É a causa do [C] do Reauth |

---

## Consistência entre telas

| Componente | Variações encontradas |
|---|---|
| **Botão primário** | Login `py-4 text-sm rounded-2xl` (52px) · Wizard `py-3 text-xs` (40px), que troca de âmbar para verde no último passo · Detalhe `py-3.5` (44px) · Home: tile com degradê · OS `px-3 py-2` (32px) · Clientes e Estoque `py-2.5` (36px) · cartões `py-1.5` (28px) · Bancada `min-h-[90px]` · Portal `py-4` verde (52px) · Reauth, Câmera e Conta `py-3` (40px) · Forgot `py-2.5` (36px) |
| **Botão fechar** | X `p-1 w-5` (28px), sem nome, em 7 modais · Detalhe `p-2` (36px), sem nome · Reauth 28px com `aria-label` · Toast 24px com `aria-label` · Bancada: texto "Sair do Modo" (36px) · Busca: "Cancelar" (32px) |
| **Badge de status** | Home com 3 estilos (10px) · OS com pulse · Clientes só em `stone` · Mais em verde ou `stone` · Bancada sempre âmbar · Portal `font-black` com pulse · Detalhe `rounded-full` · Header com 9px |
| **Modal** | Centrado (Forgot, Leitor, 2 de Clientes, estes sem scroll) · sheet inferior (Detalhe 95vh, Wizard 94vh, Câmera 92vh, Reauth 90vh, Conta 92vh) · tela cheia (Bancada, Busca). Fundos `black/80`, `/85` e `stone-900/95` |
| **Input** | Login `py-3.5 text-base rounded-2xl` (54px) · Reauth `py-3 text-sm` (46px) · os demais `py-2`-`py-2.5 text-xs` (34-38px). Fundos `stone-900` ou `stone-950`. Labels em 12px `stone-300`, 11px `stone-400` ou 10px |
| **Raios** | `3xl` em banners, `2xl` em cartões, `xl` em botões, `lg` em elementos pequenos, `full` em pílulas. Coerentes, mas sem escala documentada |

---

## Resumo por tela

| Tela | C | H | M | L | Nota |
|---|---|---|---|---|---|
| 1. Login e Esqueci a senha | 1 | 4 | 7 | 4 | C |
| 2. Shell global | 0 | 10 | 9 | 5 | D |
| 3. Hoje | 0 | 3 | 6 | 3 | C- |
| 4. OS: lista e Kanban | 0 | 4 | 7 | 4 | C- |
| 5. Detalhe da OS | 1 | 5 | 8 | 3 | D |
| 6. Nova OS (wizard) | 1 | 6 | 6 | 2 | D |
| 7. Clientes | 0 | 5 | 6 | 3 | D |
| 8. Estoque e Leitor | 0 | 4 | 5 | 2 | D+ |
| 9. Mais | 0 | 1 | 9 | 2 | D |
| 10. Modo Bancada | 1 | 5 | 4 | 3 | D |
| 11. Câmera | 0 | 4 | 4 | 2 | D+ |
| 12. Portal do Cliente | 0 | 4 | 4 | 2 | D |
| 13. Reauth e Conta | 1 | 4 | 5 | 1 | D |
| **Total** | **5** | **59** | **80** | **36** | |

Os padrões transversais contam uma vez em cada tela onde aparecem. A nota combina a severidade com a frequência de uso da tela.

---

## Pontos positivos

- **BottomTabBar:** 64px de altura, `<nav aria-label>` e FAB com nome. É o único elemento global que cumpre o tamanho de alvo.
- **Login:**
  - `htmlFor`, `aria-invalid`, `aria-describedby` e `role="alert"`;
  - `autocomplete` correto, colar permitido (3.3.8) e fonte de 16px;
  - alvos de 52-54px.
- **Reauth:** é o único modal com `role="dialog"`, `aria-modal` e `aria-labelledby`.
- **Alvos grandes onde importa:**
  - Bancada com botões reais e tiles de ≈90px com bom contraste;
  - sub-navegação do Mais com ≈52px;
  - resultados de busca com ≈59px;
  - CTA do portal com ≈52px.
- **Estoque:** nada depende só de cor. Fotos com `alt` vindo da legenda.
- **Outros acertos:**
  - não há interações que dependam de arrastar (2.5.7);
  - o rascunho do wizard é salvo (3.3.7);
  - `lang="pt-BR"`, `viewport-fit=cover` e `pb-safe`;
  - `type="button"` usado de forma consistente.

---

## Recomendações priorizadas

| Prioridade | Ação | Resolve |
|---|---|---|
| **P0** | Bancada: mover o `return null` para depois de todos os hooks | [C] Bancada |
| **P0** | Reauth acima da Conta: `<dialog>` (top layer) ou trocar a ordem de montagem e o z-index | [C] Reauth |
| **P0** | `inputMode="text"` no identificador (numérico só quando houver apenas dígitos) | [C] Login |
| **P0** | Componente `Modal`/`BottomSheet` com foco, prisão de foco, Escape e retorno de foco, migrando os 10 modais | [C] Detalhe e Wizard, além de 8 [H] |
| **P1** | `Button` com tamanhos (md ≥ 48px, bench 64px) e cores ≥ 4,5:1 (`stone-950` sobre `amber-600` = 6,19:1; branco sobre `emerald-700` = 5,37:1) | Contraste dos CTAs e alvos de 40px |
| **P1** | `IconButton` com `aria-label` obrigatório e área de toque de 48px | Nome e tamanho dos botões só com ícone |
| **P1** | `Field` com `useId`, label, erro, `aria-describedby` e `text-base` | 32 labels, zoom do iOS, 3.3.1 |
| **P1** | Trocar os 14 `div onClick` por `button`; adicionar `aria-pressed`/`current`/`selected` | 2.1.1, 4.1.2 |
| **P1** | Remover `maximum-scale=1, user-scalable=no` do `index.html` | 1.4.4 |
| **P1** | Confirmação ou desfazer em avançar status, aprovar orçamento e restaurar dados | 3.3.4 |
| **P1** | Bordas de campo com ≥ 3:1 (ex.: `border-stone-500`) | 1.4.11 |
| **P2** | `StatusBadge` único, com mapa de rótulos acentuados, ícone e cor | Consistência |
| **P2** | Toast com região live sempre montada, pausa ao focar ou passar o mouse, sem truncar | 4.1.3, 2.2.1 |
| **P2** | `prefers-reduced-motion` global (`motion-safe:`, `disableForReducedMotion`) | 2.2.2 |
| **P2** | Busca de cliente no passo 1, foto no topo do passo 2, sem valores inventados | Meta de 60 s |
| **P3** | Máscara de CPF em Clientes, `Intl` para moeda e data, `dvh`, `pt-safe`, `scroll-padding` | Regras do projeto, polimento |
| **P3** | Implementar ou remover o botão de tema; tirar as credenciais demo de produção | Honestidade da interface |

### Snippets

**Tokens (`src/index.css`, Tailwind v4)**
```css
@theme {
  --spacing-target: 3rem;        /* 48px */
  --spacing-target-bench: 4rem;  /* 64px */
}
html { scroll-padding-block: 5rem; } /* header sticky e barra inferior fixa */
```

**Button (tamanhos e contraste; razões calculadas)**
```tsx
const SIZES = {
  sm: 'min-h-10 px-3 text-sm',      // só secundário
  md: 'min-h-12 px-4 text-sm',      // padrão (48px)
  lg: 'min-h-14 px-5 text-base',
  bench: 'min-h-16 px-6 text-lg',   // Modo Bancada (64px)
};
const TONES = {
  primary: 'bg-amber-600 text-stone-950 hover:bg-amber-500',   // 6,19:1 → 9,21:1
  success: 'bg-emerald-700 text-white hover:bg-emerald-800',   // 5,37:1
  ghost:   'bg-stone-800 text-stone-100 hover:bg-stone-700',
};
```

**IconButton**
```tsx
type IconButtonProps = { label: string; icon: LucideIcon; onClick: () => void };
export function IconButton({ label, icon: Icon, onClick }: IconButtonProps) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="grid size-12 place-items-center rounded-xl focus-visible:outline-2 focus-visible:outline-amber-400">
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
```

**Modal com `<dialog>`** (foco, Escape, `inert` e top layer nativos; também resolve o empilhamento)
```tsx
export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose}
      className="m-0 mt-auto w-full max-w-lg rounded-t-3xl bg-stone-900 text-stone-100 backdrop:bg-black/80">
      <h2 id={titleId} className="text-base font-bold">{title}</h2>
      {children}
    </dialog>
  );
}
```

**StatusBadge**
```tsx
const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  recebido:             { label: 'Recebido',             tone: 'bg-stone-800 text-stone-200' },
  diagnostico:          { label: 'Diagnóstico',          tone: 'bg-sky-950 text-sky-300' },
  orcamento:            { label: 'Orçamento',            tone: 'bg-violet-950 text-violet-300' },
  aguardando_aprovacao: { label: 'Aguardando aprovação', tone: 'bg-amber-950 text-amber-300' },
  em_execucao:          { label: 'Em execução',          tone: 'bg-orange-950 text-orange-300' },
  pronto:               { label: 'Pronto',               tone: 'bg-emerald-950 text-emerald-300' },
  entregue:             { label: 'Entregue',             tone: 'bg-stone-800 text-stone-400' },
  cancelado:            { label: 'Cancelado',            tone: 'bg-rose-950 text-rose-300' },
};
export const StatusBadge = ({ status }: { status: OrderStatus }) => (
  <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${STATUS[status].tone}`}>
    {STATUS[status].label}
  </span>
);
```

**Field**
```tsx
export function Field({ label, error, ...input }: FieldProps) {
  const id = useId(); const errId = `${id}-err`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-stone-300">{label}</label>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? errId : undefined}
        className="min-h-12 w-full rounded-xl border border-stone-500 bg-stone-900 px-3.5 text-base" {...input} />
      {error && <p id={errId} role="alert" className="mt-1 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
```

**Movimento, zoom e moeda**
```ts
confetti({ particleCount: 50, disableForReducedMotion: true });
// Tailwind: motion-safe:animate-pulse  (nunca animate-pulse puro)
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
```
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

### Validação sugerida
- Rodar o axe DevTools e o Lighthouse nas 5 abas e nos modais.
- Testar com TalkBack e VoiceOver:
  - o login;
  - a abertura de OS;
  - o checklist;
  - a aprovação no portal.
- Medir os alvos marcados (est.) e os contrastes com opacidade ou degradê num aparelho de 360px.
