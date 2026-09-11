# Tudo do Ecommerce

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout and then validates the Sites artifact. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares the logical D1 binding `DB` and R2 binding `BUCKET`
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` defines products, ads, pricing simulations and profiles
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

## Access model of Tudo do Ecommerce

The dashboard uses **anyone with the link + Sign in with ChatGPT**. It does not
use a guest allowlist or manual approval for each user. The page and write APIs
require an authenticated session, and each saved record is associated with the
email forwarded by the session.

## Runtime integrations

Production secrets are configured in the Site's production environment settings;
they do not belong in `.openai/hosting.json` or in client-side code:

- `GEMINI_API_KEY`: enables real multimodal product analysis via Google Gemini
  (free tier available from Google AI Studio, no credit card required);
- `GEMINI_VISION_MODEL`: optional model override, default `gemini-2.5-flash`;
- `SERPAPI_KEY`: enables commercial image search through Google Images/SerpApi.

The D1 and R2 logical bindings are already declared as `DB` and `BUCKET`. The
first authenticated request to a persistence route creates the required tables
idempotently, and the checked-in Drizzle migration is also packaged with the
deployment. If the bindings or secrets are absent, the interface shows a
configuration-pending state rather than returning fabricated data.

## Data integrity rules

- NCM and CEST are suggestions for verification, never definitive image-derived
  classifications.
- Images found on the web are references and do not prove product identity or
  commercial-use authorization.
- Trends combine Google Trends interest in Brazil (via `SERPAPI_KEY`) with a
  manually reviewed catalog of periodic publications. Every item exposes its
  origin and reference date; the product never labels this as a live sales
  ranking or invents monthly sales. The cache is daily and isolated by
  marketplace. The current report catalog was added on 2026-08-20: Shopee
  (`shopee.com.br/blog/mais-vendidos-shopee`), Mercado Livre (no specific
  periodic report registered yet), SHEIN (Mobile Time, 2025-02-13), and TikTok
  Shop (Newsroom, 2026-06-03).

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build and validate the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build, validate, and verify the rendered development-preview metadata
- `npm run validate:artifact`: recheck an existing artifact's manifest and ESM `default.fetch` export
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build and validation commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

---

# Diário Mello — portal de notícias

O portal de notícias ocupa a raiz do site (`/`). A ferramenta de ecommerce que
existia antes continua funcionando, agora em `/marketlab` (e só ela exige login
por ChatGPT — o portal é público).

## Identidade

A marca vem do sobrenome da família: **Diário Mello**, com selo "DM", vermelho
de jornal (`#c8102e`) e tipografia serifada nas manchetes. Todo texto de marca
fica em `lib/portal/brand.ts` — mudar o nome, a assinatura ou a cor é editar um
arquivo só.

## Rotas públicas

| Rota | O que faz |
| --- | --- |
| `/` | Capa: destaque (hero), últimas notícias e blocos por editoria |
| `/editoria/[slug]` | Lista paginada da editoria, mais recentes primeiro |
| `/noticia/[slug]` | Matéria: capa, autor, data, corpo, tags, compartilhamento e relacionadas |
| `/busca?q=` | Busca por título, linha fina e corpo do texto |
| `/sobre`, `/contato`, `/privacidade`, `/expediente` | Páginas institucionais |
| `/sitemap.xml`, `/robots.txt` | SEO, gerados dinamicamente a partir do banco |

Cada matéria publica meta tags próprias (title, description, Open Graph,
Twitter Card) e dados estruturados `NewsArticle`.

## Painel administrativo (`/admin`)

- `/admin` — lista de matérias com filtros por editoria, status e busca, mais
  contadores de publicadas, rascunhos e visualizações.
- `/admin/materias/nova` e `/admin/materias/[id]` — editor com título, linha
  fina, editoria, autor, tags, capa (upload para o R2), texto em Markdown com
  pré-visualização, destaque da capa e agendamento.
- `/admin/editorias` e `/admin/autores` — CRUD completo.

**Primeiro acesso:** enquanto não existir nenhum usuário, `/admin/login` mostra
o formulário "criar acesso do editor" e essa tela se fecha sozinha depois do
primeiro cadastro. Não existe senha padrão no código.

**Sessão:** cookie `dm_session` HttpOnly + Secure + SameSite=Lax, com token
assinado em HMAC-SHA256 (12 horas). A senha é guardada como PBKDF2-SHA256 com
150 mil iterações e salt por usuário. O segredo de assinatura vem do secret
`ADMIN_SESSION_SECRET`; sem ele, o portal gera um segredo aleatório e guarda na
tabela `portal_settings`.

## API de publicação automatizada

`POST /api/publish` — protegida pelo header `x-agent-api-key`, comparado em
tempo constante com o secret `AGENT_API_KEY` do Worker. Sem o secret
configurado a rota responde `503` (nunca aceita chamada aberta).

```bash
curl -X POST https://SEU-DOMINIO/api/publish \
  -H "x-agent-api-key: $AGENT_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "title": "Banco Central mantém juros",
    "subtitle": "Decisão foi unânime",
    "content": "## Cenário\n\nTexto em **Markdown**.",
    "category_slug": "economia",
    "author_name": "Redação Diário Mello",
    "tags": ["juros", "copom"],
    "status": "published"
  }'
```

A resposta traz a matéria criada com o slug único e a URL pública final.
Rotas auxiliares: `GET /api/categories` e `GET /api/authors` (públicas, sem
chave) informam os valores válidos de `category_slug` e `author_id`.

O schema **OpenAPI 3.1** fica em `GET /api/openapi.json`, com `servers` apontando
para o próprio host — é só colar a URL em Actions de um GPT customizado e
cadastrar a chave como API Key no header `x-agent-api-key`.

## Banco de dados

Schema Drizzle em `db/schema.ts`, migration em
`drizzle/0002_portal_diario_mello.sql`: `articles`, `categories`, `authors`,
`tags`, `article_tags`, `admin_users`, `newsletter_subscribers` e
`portal_settings`.

Como o ambiente pode entregar um D1 vazio, `lib/portal/db.ts` cria as tabelas
com `IF NOT EXISTS` na primeira consulta e faz o seed inicial: as sete
editorias (Política, Economia, Esportes, Cultura, Internacional, Tecnologia,
Opinião), a redação padrão e três matérias de exemplo — apague-as pelo painel
quando publicar as primeiras de verdade.

Para gerar novas migrations depois de mexer no schema: `npm run db:generate`.

## Imagens (R2)

O upload do painel (`POST /api/admin/upload`) valida o tipo pelos magic bytes,
limita a 6 MB e grava em `portal/capas/…` ou `portal/autores/…`. As imagens são
servidas por `GET /api/media?key=…`, que só entrega objetos com o prefixo
`portal/`.

## Variáveis e secrets

| Nome | Para quê |
| --- | --- |
| `AGENT_API_KEY` | Chave do header `x-agent-api-key` em `/api/publish` |
| `ADMIN_SESSION_SECRET` | Opcional: assinatura das sessões do painel |

Localmente, copie `.dev.vars.example` para `.dev.vars` (ignorado pelo Git). Em
produção, cadastre como secrets do Worker.

## Deploy

O build (`npm run build`) gera `dist/` já com `dist/server/wrangler.json`,
incluindo os bindings `DB` (D1) e `BUCKET` (R2) declarados em
`.openai/hosting.json`. Para publicar pela CLI do Wrangler, use
`wrangler.toml.example` como ponto de partida (crie o banco e o bucket, cole os
ids, cadastre os secrets e rode `wrangler deploy`); para aplicar as migrations:
`wrangler d1 migrations apply diario-mello --remote`.

## Testes

`node --test "tests/*.test.mjs"` roda contra o Worker construído e cobre a capa,
o robots/sitemap, o bloqueio do painel sem sessão, a recusa de `/api/publish`
sem chave, o schema OpenAPI e a área `/marketlab`.
