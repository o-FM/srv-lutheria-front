# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mobile-first front-end for luthier workshops ("Oficina Luthier"): service orders (OS) with photos and quotes, customers and instruments, stock with barcode scanning, a workbench mode and a password-less customer portal. React 19 + TypeScript + Vite + Tailwind CSS v4. UI text, docs and comments are in Portuguese (pt-BR). The backend lives in a separate repo (`srv-lutheria`, Spring Boot), but **this front-end is not wired to it yet** (see "Backend integration status").

The project started as a Google AI Studio prototype. That explains the package name (`react-example`), `metadata.json`, the `DISABLE_HMR` switch in `vite.config.ts` (do not remove it) and the unused `@google/genai` dependency / `GEMINI_API_KEY` in `.env.example`.

## Commands

```bash
npm ci              # install (package-lock.json is the source of truth; bun.lock also exists)
npm run dev         # tsx server.ts → Express + Vite middleware on http://localhost:3000
npm run lint        # tsc --noEmit — the only static check (no ESLint, no Prettier)
npm run build       # vite build → dist/
npm start           # same as dev; with NODE_ENV=production it serves dist/ instead of Vite
```

- There is **no test runner and no tests** yet. Before adding tests, pick a runner (Vitest fits the Vite setup) and add the script; do not assume one exists.
- "Done" today means `npm run lint` and `npm run build` both pass.

### Demo users (seeded in `server.ts`, in memory, reset on restart)

| Persona | Role | Login | Password |
|---|---|---|---|
| Armando | `luthier` (admin/owner) | `armando.luthier@oficina.com` | `Luthier@2026` |
| Mariana | `atendente` (front desk) | `mariana.balcao@oficina.com` | `Balcao@2026` |
| Lucas | `cliente` (customer) | `lucas.silveira@guitar.com` | `Cliente@2026` |

Login also accepts the CPF (digits or masked).

## Architecture

### Two halves: a mock auth server and a client-side app

- **`server.ts`** is a small Express server. It serves the SPA (Vite middleware in dev, `dist/` in prod) and implements a **mock auth API under `/api/auth/*`**, all in memory: login (email or CPF), session tokens, rate limiting (5 failures → 15 min lock), re-authentication tickets (5 min, single use), profile switch, sensitive-data update, forgot password, audit log and role permissions. Nothing is persisted.
- **Everything else is client-side.** Business data (clients, instruments, orders, stock, payments, stock movements) is seeded from `src/data/seedData.ts` and kept in `AppContext`, persisted to `localStorage` under `luthier_*` keys. "Offline / sync queue" is simulated (`toggleSyncStatus`); there is no real sync.

### Source layout

| Path | Role |
|---|---|
| `src/main.tsx`, `src/App.tsx` | Entry. `App` wraps `AuthProvider` → `AppProvider` → `AuthGuard` → `MainLayout`, and mounts every global modal/sheet once. |
| `src/context/AuthContext.tsx` | Session, user, login/logout, re-auth, profile switch. Token in `localStorage` (remember me) or `sessionStorage`. |
| `src/context/AppContext.tsx` | All domain state and actions (`createOrder`, `advanceOrderStatus`, `approveQuote`, `updateStockQuantity`, `recordPayment`…), UI state (active tab, open modals, toasts, dark mode), camera/barcode callbacks. Consume it with `useApp()`. |
| `src/services/authApi.ts` | The only module that calls `fetch`. Talks to `/api/auth/*`. |
| `src/types/index.ts` | Domain types. Enum values are lowercase pt-BR (`violao_aco`, `em_execucao`, `aguardando_aprovacao`), the same values the backend uses. |
| `src/utils/permissions.ts` | `ROLE_PERMISSIONS` per role (tab access and domain actions). |
| `src/utils/cpfValidator.ts` | CPF validation and masking. |
| `src/components/<feature>/` | One folder per feature: `home` (Hoje), `orders`, `clients`, `stock`, `more`, `workbench`, `client-portal`, `auth`, and `common` (header, bottom tab bar, toasts, camera, barcode scanner, global search). |

### Conventions

- **No router.** Navigation is `activeTab` in `AppContext` (`hoje`, `os`, `clientes`, `estoque`, `mais`), switched by `BottomTabBar`. Modals and sheets are opened by setting context state (`setActiveOrderId`, `setIsNewOrderWizardOpen`, `openCamera(cb)`…); they are rendered once in `App.tsx`, not inside the screens that open them.
- **Roles:** `luthier`, `atendente`, `cliente`. The `cliente` role only sees `ClientPortalView`. Stock, financials, workbench and config are `luthier`-only.
- **Permissions exist twice:** the client-side `ROLE_PERMISSIONS` (drives the UI) and the server's `/api/auth/permissions` + `/api/auth/validate-action`. Keep them in sync when changing a rule. Hiding something in the UI is not access control.
- **Sensitive actions require re-authentication** (`ReauthBottomSheet` → ticket → `/switch-profile` or `/sensitive-update`). Follow that flow for any new sensitive action.
- **State updates are immutable** (`setOrders(prev => prev.map(...))`). Keep it that way.
- **Styling:** Tailwind v4 utility classes (`@tailwindcss/vite`, entry `src/index.css`), `lucide-react` icons, `motion` for animations, `canvas-confetti` for celebrations. Dark stone/amber palette.
- **Mobile ergonomics are requirements, not polish** (see `README.md`): touch targets ≥ 48 px (≥ 64 px in workbench mode), primary actions in the lower half of the screen (thumb zone), opening an OS in under 60 s in 3 steps.
- CPF is masked in output (`***.982.247-**`), as in the backend.
- Path alias `@/` points to the **repo root**, not `src/`. Existing code uses relative imports.

### Known debt

- `AppContext.tsx` (~930 lines), `OrderDetailSheet.tsx` (~760) and `NewOrderWizardModal.tsx` (~740) are at or over the 800-line soft ceiling in the rules. Prefer extracting pieces (e.g. per-domain hooks or contexts) over growing them further.
- `@google/genai` is a dependency but is not imported anywhere.

## Backend integration status

The real backend (`srv-lutheria`) differs from the mock in `server.ts`. When integrating, expect to change:

- **Routes and auth:** the backend uses `/auth/**` with stateless JWT (15 min access token + refresh token), not `/api/auth/*` with opaque sessions and re-auth tickets. The JWT carries the tenant (`tid`): each workshop is a tenant.
- **Roles:** backend roles are `ADMIN`, `LUTHIER`, `ATENDENTE`, `ESTOQUISTA`. Customers have no login; they use the portal at `/portal/orders/{token}`.
- **Errors:** RFC 9457 `application/problem+json` (the mock returns `{ error }`). Records from another tenant come back as 404.
- **Data:** everything now in `localStorage`/`seedData` must move to API calls. Enum values already match.
- Contract and docs in the backend repo: `docs/openapi.json`, `docs/api.md` (state machine and endpoint/role matrix), `docs/security-review.md`.

## Claude Code setup (ECC)

`.claude/agents/` holds project-scoped agents from everything-claude-code (bare names, no `ecc:` prefix), and `.claude/rules/ecc/` holds its rules (`common`, `typescript`, `react`, `web`). Useful ones here: `react-reviewer` and `typescript-reviewer` after changing `.tsx`/`.ts`, `security-reviewer` for anything in `server.ts`, `AuthContext` or `authApi`, `a11y-architect` for UI work, `react-build-resolver` when `lint`/`build` fails, `planner` for features such as the backend integration.

The rules assume things this repo does not have yet (tests with 80% coverage, ESLint). Where they conflict with the current state of the repo, this file describes reality; set up the missing tooling rather than pretending it exists.
