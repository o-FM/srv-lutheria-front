# srv-lutheria-front

Front-end do sistema de gestão para oficinas de luthieria (React 19 + TypeScript + Vite +
Tailwind CSS 4). Mobile-first, responsivo até desktop, com tema claro/escuro e cores
configuráveis. Backend: [srv-lutheria](https://github.com/o-FM/srv-lutheria).

## Rodando

```bash
npm install

# Modo demonstração (sem backend): dados de exemplo + login simulado pelo server.ts
npm run dev                     # http://localhost:3000

# Com a API real (srv-lutheria rodando em :8080)
echo "VITE_API_URL=http://localhost:8080" > .env.local
npm run dev:vite                # http://localhost:5173

npm run build                   # checagem de tipos + build de produção em dist/
```

O modo é decidido por `VITE_API_URL` (`src/config/env.ts`): vazio → demonstração; preenchido →
API. Em produção o `dist/` é estático e pode ser servido por qualquer CDN/servidor web, com
fallback de rotas para `index.html` (rotas públicas abaixo).

## Estrutura

```
src/
├─ config/           env.ts (modo API/demo), navigation.ts (abas por papel)
├─ context/          AuthContext (sessão), AppContext (dados), ThemeContext (aparência)
├─ services/
│  ├─ api/           cliente HTTP, tipos, endpoints e mapeadores da API srv-luthieria
│  └─ authApi.ts     fachada de autenticação (API real ou servidor mock)
├─ pages/            páginas públicas: portal do cliente, cadastro, redefinir senha
├─ components/       telas e componentes (common/, orders/, clients/, stock/, ...)
└─ index.css         design tokens (cores, modos e paletas)
```

## Integração com a API

`src/services/api` tem um método tipado para **cada endpoint** do backend
(`api.customers.create`, `api.orders.sendQuote`, `api.portal.approve`, ...), com:

- `Authorization: Bearer` automático e **renovação de sessão**: em 401 o refresh token é trocado
  (rotação) e a requisição repetida uma vez; se falhar, volta para o login.
- Erros RFC 9457 viram `ApiError` com mensagem amigável e `fieldErrors` por campo.
- `mappers.ts` converte os DTOs para os tipos das telas, isolando o formato do backend.

| Tela / ação | Endpoint |
|---|---|
| Login, sair, "esqueci minha senha" | `/auth/login`, `/auth/logout`, `/auth/forgot-password` |
| Cadastro da oficina (`/cadastro`) | `POST /auth/register` |
| Redefinir senha (`/redefinir-senha#token=`) | `POST /auth/reset-password` |
| Usuário logado | `GET /users/me` |
| Carga inicial | `/customers`, `/instruments`, `/products`, `/service-orders?full=true` |
| Novo cliente / instrumento | `POST /customers`, `POST /customers/{id}/instruments` |
| Nova OS (wizard) | `POST /service-orders` |
| Avançar status | `/status`, ou `quote/send` e `quote/approve` nas etapas de orçamento |
| Aprovar / recusar orçamento | `/quote/approve`, `/quote/reject` |
| Serviços e peças da OS | `/services`, `/services/{id}/done`, `/parts` |
| Pagamento | `POST /service-orders/{id}/payments` |
| Estoque +1/−1 | `POST /products/{id}/movements` |
| Portal do cliente (`/acompanhar/{token}`) | `/portal/orders/{token}` (+ approve/reject) |
| Logs de auditoria (admin) | `GET /audit-logs` |

Também prontos no cliente, para as próximas telas: catálogo de serviços, relatórios
(`/reports/dashboard`, `/reports/financial`), notificações, exportação/anonimização LGPD e gestão
de usuários.

Ainda sem endpoint no backend (funcionam só no dispositivo): fotos de OS/instrumentos,
alteração de dados da própria conta e o simulador offline.

## Aparência

Menu do usuário → **Aparência** (ou *Mais → Configurações*):

- Modo: claro, escuro ou do sistema.
- Cor de destaque: âmbar, azul, esmeralda, violeta, rosa, petróleo.
- Tom dos neutros: quente, neutro, ardósia.

Os componentes usam só as escalas semânticas `base-*` (neutros) e `accent-*` (destaque),
definidas em `src/index.css` e trocadas em tempo real por atributos no `<html>`. Para criar uma
nova paleta, basta adicionar um bloco `:root[data-accent="..."]` e incluí-la em
`ThemeContext.ACCENTS`.

## Análise do projeto (out/2026)

O que foi encontrado e o que mudou nesta versão:

| Tema | Antes | Agora |
|---|---|---|
| Layout | Barra inferior de celular também no desktop; conteúdo espremido ao centro; cabeçalho com 6 botões no celular | Barra lateral em telas grandes, cabeçalho enxuto, barra inferior só até tablet; modais centralizados no desktop e com rolagem no celular |
| Cores | ~1.200 classes `stone-*`/`amber-*` fixas; "modo escuro" que não mudava nada | Tokens semânticos, modo claro/escuro real e 6 cores × 3 tons |
| Visual | Gradientes, sombras grandes, emojis, pesos 800–900 | Superfícies planas, uma fonte (Inter), pesos 400–600 |
| Acessibilidade | Zoom bloqueado (`user-scalable=no`), seleção de texto desligada | Zoom liberado, texto selecionável, foco visível, `prefers-reduced-motion`, rótulos ARIA na navegação |
| Dados | Só `localStorage` com dados de exemplo; login simulado | Camada de API tipada com renovação de sessão; modo demonstração mantido |
| Rotas | Nenhuma (links do portal/e-mail não abriam nada) | `/acompanhar/{token}`, `/cadastro`, `/redefinir-senha` |
| Projeto | Template do AI Studio (`react-example`, `@google/genai` e `motion` sem uso, dois lockfiles) | Nome próprio, dependências enxutas, `npm run build` com checagem de tipos, `.env.example` |

Próximos passos recomendados: roteador completo (react-router) para abas com URL, cache de dados
(TanStack Query) no lugar do estado global, testes (Vitest + Testing Library + Playwright) e
upload de fotos quando o backend tiver o endpoint.
