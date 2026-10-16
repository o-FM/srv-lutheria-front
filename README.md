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

---

## 🔌 Integração com o backend (teste e2e local)

O front pode chamar o backend [srv-lutheria](https://github.com/o-FM/srv-lutheria) **direto do navegador**
(sem proxy). Basta definir `VITE_API_URL`; sem ela o app continua no modo demonstração
(mock Express em `server.ts` + `localStorage`).

```bash
# 1. Backend (perfil dev: H2 em memória, porta 8080, CORS liberado para localhost:3000)
cd srv-lutheria
mvn install -DskipTests
java -jar srv-luthier-app/target/srv-luthier-app-1.0.0-SNAPSHOT.jar

# 2. Dados de demonstração via API (oficina, usuários, estoque, clientes e OS)
cd srv-lutheria-front
npm install
npm run seed:api          # API_URL=http://... para outra URL

# 3. Front em http://localhost:3000 apontando para a API (lê .env.api)
npm run dev:api
```

Contas criadas pelo seed (as mesmas dos botões "Contas de Teste" do login):

| Perfil | E-mail | Senha |
|---|---|---|
| Luthier / Dono (ADMIN) | `armando.luthier@oficina.com` | `Luthier@2026` |
| Atendente | `mariana.balcao@oficina.com` | `Balcao@2026!` |

Como o front conversa com a API:

- `src/services/apiClient.ts`: `fetch` com Bearer token, renovação automática pelo refresh token
  em 401 e erros RFC 9457 (`problem+json`) viram mensagens nos toasts.
- `src/services/backendApi.ts`: endpoints e conversão dos DTOs para os tipos do front.
- `AuthContext` / `authApi`: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/users/me`,
  `/auth/forgot-password` e `/audit-logs`. Trocar de persona = entrar com a conta destino.
- `AppContext`: carrega clientes, instrumentos, OS e estoque após o login; cada ação (abrir OS,
  avançar status, orçamento, serviços, pagamentos, movimentar estoque) chama o endpoint e aplica a
  resposta da API.

Limitações conhecidas no modo integrado:

- Login só por **e-mail** (a API não aceita CPF como identificador).
- **Fotos** ficam só na memória do navegador (a API ainda não tem upload).
- Persona **Cliente** é uma pré-visualização do portal com a sessão da equipe; aprovar/recusar usa o
  endpoint público `/portal/orders/{token}`.
- Alterar e-mail/telefone/senha em "Minha Conta" ainda não existe na API.
- Serviço concluído não pode ser reaberto, e a API impõe o ciclo da OS (ex.: concluir serviço só
  "em execução"; "pronto" só pela bancada). As recusas aparecem como toast com a mensagem da API.
