# Oficina Luthier - Gestão Mobile-First

Aplicativo de gestão projetado especificamente para oficinas de lutheria (construção, manutenção e reparo de instrumentos de cordas e clássicos). O celular é a plataforma principal, com alvos de toque generosos, zona do polegar e fluxo otimizado para o luthier na bancada e o atendente no balcão.

---

## 🎯 Decisões de UX e Ergonomia Mobile

1. **Zona do Polegar Prioritária**:
   - Navegação inferior fixa com **5 abas essenciais**: `Hoje`, `OS`, `+ Nova OS (FAB central elevado)`, `Clientes`, `Estoque` e `Mais`.
   - Botões de ação principal (Avançar Status, Tirar Foto, Aprovar Orçamento) posicionados na metade inferior da tela.

2. **Alvos de Toque $\ge 48$px**:
   - Espaçamento calibrado para toque fácil mesmo com luvas finas de látex ou mãos com resíduos de lixa, cola e verniz.

3. **Fluxo de Abertura de OS em < 60 segundos (3 Passos)**:
   - **Passo 1**: Selecionar ou criar cliente rapidamente com máscara de telefone.
   - **Passo 2**: Instrumento + **Foto Primeiro** (câmera ao vivo ou galeria) + **Ditado por voz** no defeito relatado.
   - **Passo 3**: Seleção de serviços pré-configurados + prazo estimado + confirmação imediata.

4. **Modo Bancada (Workbench Mode)**:
   - Interface de altíssimo contraste e botões extragrandes ($\ge 64$px).
   - Cronômetro/timer integrado para tempo de cura de cola (Titebond 30 min, cianoacrilato, verniz goma-laca).
   - Checklist de serviços em 1 toque.

5. **Portal do Cliente Sem Senha**:
   - Acompanhamento via link único e token seguro (ex: `FNDR-1042-LS`).
   - Linha do tempo com fotos de antes e depois.
   - Botão de **Aprovação de Orçamento em 1 toque** com feedback comemorativo.

6. **Aparelho compartilhado**:
   - Qualquer pessoa da equipe troca de usuário pelo menu do perfil, com o próprio e-mail e senha.
   - Sem "manter conectado", a sessão encerra após 15 minutos sem uso.

---

## 👥 Perfis

O perfil vem da conta (API `srv-luthieria`): **Admin** e **Luthier** veem bancada, estoque,
financeiro e configurações; **Atendente** cuida do balcão (clientes, abertura e entrega de OS).
O admin cria as contas em *Mais → Config → Equipe*. O cliente não tem login: recebe o link
`/acompanhar/<token>` para ver fotos, andamento e aprovar o orçamento.

---

## 📦 Módulos do Sistema

1. **Hoje (Dashboard)**: Métricas do dia, prazos críticos, alertas de estoque baixo e atalhos rápidos.
2. **Ordens de Serviço**: Lista e modo Kanban com filtros de status (`Recebido` → `Diagnóstico` → `Orçamento` → `Aguardando aprovação` → `Em execução` → `Pronto` → `Entregue`).
3. **Clientes**: Cadastro, histórico de instrumentos e atalhos de ligação e WhatsApp em 1 toque.
4. **Instrumentos**: Ficha técnica com tipo, marca, modelo, ano, calibre de cordas e afinação.
5. **Estoque**: Peças, cordas, madeiras e insumos com cadastro de itens, leitor de código de barras/QR pela câmera (Chrome/Android) ou leitor USB, e ajuste rápido (+1 / -1).
6. **Agenda**: Visualização de entregas e compromissos.
7. **Financeiro**: Recebido no mês, ticket médio, a receber e totais por forma de pagamento.
8. **Mensagens**: Avisos automáticos pendentes de envio pelo WhatsApp e modelos de texto com o link do portal.
9. **Config**: Catálogo de serviços (preços padrão) e equipe.

---

## 🛠️ Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:3000, /api -> http://localhost:8080 (API srv-luthieria)
npm run build      # typecheck + build de produção em dist/
```

Suba a API com `docker compose up --build` no repositório `srv-lutheria` (ou
`java -jar ...` no perfil dev). `API_PROXY_TARGET` muda o destino do proxy do Vite.

## 🚀 Produção

A imagem deste repositório (`Dockerfile`) é o **Caddy** servindo o build estático e
encaminhando `/api/*` para a API no mesmo domínio, com HTTPS automático (Let's Encrypt) e
cabeçalhos de segurança (`Caddyfile`). O workflow `Imagem Docker` publica
`ghcr.io/o-fm/srv-lutheria-front` a cada push na `main`. O passo a passo do servidor está em
`srv-lutheria/deploy/README.md`.
