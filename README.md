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

6. **Offline-First**:
   - Persistência contínua com armazenamento local.
   - Alternador no cabeçalho para simular perda de sinal e sincronização com fila de requisições.

---

## 👥 Personas Disponíveis para Teste

Você pode alternar entre as 3 personas a qualquer momento no seletor no cabeçalho:
1. **Luthier / Dono (Armando)**: Visão de bancada, avanço de status, controle de peças e financeiro.
2. **Atendente / Balcão (Mariana)**: Abertura rápida de OS, contato via WhatsApp em 1 toque, check-in.
3. **Cliente (Lucas Silveira)**: Portal simplificado de acompanhamento e aprovação de orçamento.

---

## 📦 Módulos do Sistema

1. **Hoje (Dashboard)**: Métricas do dia, prazos críticos, alertas de estoque baixo e atalhos rápidos.
2. **Ordens de Serviço**: Lista e modo Kanban com filtros de status (`Recebido` → `Diagnóstico` → `Orçamento` → `Aguardando aprovação` → `Em execução` → `Pronto` → `Entregue`).
3. **Clientes**: Cadastro, histórico de instrumentos e atalhos de ligação e WhatsApp em 1 toque.
4. **Instrumentos**: Ficha técnica com tipo, marca, modelo, ano, calibre de cordas e afinação.
5. **Estoque**: Peças, cordas, madeiras e insumos com leitor de código de barras/QR pela câmera e ajuste rápido (+1 / -1).
6. **Agenda**: Visualização de entregas e compromissos.
7. **Financeiro**: Resumo mensal, formas de pagamento (Pix, cartão, dinheiro) e recibos.
8. **Mensagens**: Gerador de textos prontos para WhatsApp.
