# All Feedback — Claude Reference

<!-- projectId: af-b616c72a | repo: wpeverest/allfeedback -->

WordPress plugin for NPS feedback surveys. All data stored locally — no third-party services. React admin SPA + public widget.

Entry: `allfeedback.php` → `src/Plugin.php`

---

## Commands

```bash
# Frontend (pnpm 10.30.0, Node >=20)
pnpm dev          # webpack watch + HMR
pnpm watch        # webpack watch, no HMR
pnpm build        # production build
pnpm lint         # ESLint
pnpm format       # prettier auto-fix TS/TSX
pnpm make-pot     # regenerate translation POT
pnpm release      # clean → build → POT → composer --no-dev → zip

# PHP
composer install
composer lint             # phpcs
composer lint:fix         # phpcbf

# e2e (Playwright, chromium only)
pnpm exec playwright test                    # whole suite
pnpm exec playwright test --grep @fresh      # regression tier only
pnpm exec playwright test tests/e2e/specs/settings
pnpm exec playwright show-report
```

> **e2e suite**: `tests/e2e/`, 73 `@fresh` specs. Site URL and admin credentials
> come from `.themegrill-qa/.env.local` (gitignored) or `ALLFEEDBACK_BASE_URL` /
> `_ADMIN_USER` / `_ADMIN_PASS` in CI. Specs create and destroy their own
> fixtures and run single-worker against one shared WordPress.
>
> Four things to know before writing more — each one cost a debugging session:
> 1. There are **no `data-testid` attributes**. Select by role, visible text, or
>    the `allfb-*` classes.
> 2. Admin REST calls need an `X-WP-Nonce` from `window.__ALLFB_ADMIN__.nonce`,
>    or they 401 — which looks exactly like a permission bug and is not one.
> 3. The widget's default `auto` trigger means the panel is **already open** on
>    load, so clicking the launcher *closes* it. Use `openWidget()`.
> 4. Never drive the widget on the site home page — the theme's hero image
>    overlays it and intercepts clicks. Use `Wp.createBlankPage()`.
>
> **CI builds the assets** — `.themegrill-qa/suite.json` runs
> `pnpm install --frozen-lockfile && pnpm build`, because `resources/build/` is
> gitignored and a CI checkout would otherwise have no compiled SPA or widget.
> Drop that build step and every JS-dependent spec fails while the REST-only ones
> pass, which looks like a UI regression and is not one.
>
> Three specs in `block-embed.spec.ts` are `test.fail()` markers pinning the open
> `SurveyBlock` bug below; they will start failing when it is fixed, which is the
> signal to delete them. See `tests/e2e/support/` and
> `.themegrill-qa/knowledge.md`.
>
> No PHP unit-test framework is configured.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| PHP | PHP 8.2+ strict, WordPress 6.5+, PHP-DI 7.0 |
| React | React 18, TypeScript strict, TanStack Query v5 / Form v1 / Router v1 |
| Styling | Tailwind CSS v4, Radix UI, shadcn |
| Rich text | Tiptap v3 (form field editors) |
| Build | `@wordpress/scripts` (Webpack) |
| DB | WordPress `wpdb`, tables prefixed `wp_af_` |

---

## Architecture

### Key Paths

| Path | Purpose |
|------|---------|
| `src/Core/` | Bootstrap, DI container, service providers |
| `src/API/Controllers/V1/` | REST controllers |
| `src/Domain/Survey/` + `src/Infrastructure/Database/Repositories/` | Survey entity, repository interface and `$wpdb` implementation |
| `src/Infrastructure/Database/` | Migrator + Migration base + repositories |
| `src/Modules/` | Add-on system |
| `config/services.php` | PHP-DI bindings |
| `database/migrations/` | Numbered migrations (`0001_*.php`) |
| `resources/scripts/admin/` | React SPA entry (`index.tsx`) |
| `resources/scripts/frontend/` | Widget entry (`index.tsx`) |
| `resources/scripts/blocks/` | Gutenberg blocks (`block.json` + `Edit.tsx` + `index.ts`) |

### Database Tables

| Table | Columns of note |
|-------|----------------|
| `wp_af_surveys` | `form_schema` JSON, `settings` JSON, `styling` JSON, `status`, `conflict_reason`, `response_count` |
| `wp_af_responses` | `response_data` JSON, `score`, `ip_hash`, `ip_address`, `guest_token`, `is_read`, `consent_given` |
| `wp_af_survey_sessions` | `session_id`, `survey_id`, `user_id`, `guest_id`, `status`, `started_at`, `submitted_at` |

### REST API

Base: `/wp-json/allfeedback/v1/`
Auth: write endpoints require `manage_options`; submission requires nonce only (`allfeedback_submit`).
Envelope: `{ success: bool, data: mixed }`
Full spec: [`.claude/docs/api_reference.md`](.claude/docs/api_reference.md)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/surveys` | Create survey (always `draft`) |
| `GET` | `/surveys/{id}` | Load for editing |
| `PUT` | `/surveys/{id}` | Autosave / save draft |
| `POST` | `/surveys/{id}/publish` | Transition to `published` |

---

## Migrations

Auto-run on `admin_init`. WP-CLI is preferred in development:

```bash
wp allfeedback migrate                  # run pending
wp allfeedback migrate status           # show all (name, batch, ran_at)
wp allfeedback migrate rollback         # roll back last batch
wp allfeedback migrate rollback --step=2
wp allfeedback migrate reset            # drop all plugin tables
wp allfeedback migrate refresh          # reset + re-run all
```

Verify tables: `wp db query "SHOW TABLES LIKE 'wp_af%';"`

---

## Gotchas

- **⚠ OPEN BUG — `SurveyBlock` fatals on every render.**
  `src/Frontend/Blocks/SurveyBlock.php:105` has the
  `$repo = $this->container->get( SurveyRepository::class );` statement sitting
  *after* a `//` line comment on the same physical line, so it never executes
  and line 106 calls `findById()` on null. **Any page containing the
  `allfeedback/survey` block returns HTTP 500** — for published, draft and
  dangling survey ids alike, since the fatal precedes the status check. It also
  fires through the REST API (`the_content` is rendered into post responses), so
  such a page cannot even be *deleted* via REST until its content is blanked.
  The shortcode path is fine. Introduced by `37a1196`, a bulk PHPCS fix that
  collapsed the comment and the statement onto one line. Fix: put the assignment
  on its own line. Pinned by `test.fail()` specs in
  `tests/e2e/specs/building-forms/block-embed.spec.ts`.
- **Widget targeting is split across two layers.** PHP (`TargetingEngine`)
  decides which surveys are eligible for the current URL from `targetPages` /
  `target_page_ids` and the `page_id` / `post_id` / `post_type` rules. The React
  widget then applies **audience** (`checkAudience`) and **frequency**
  (`checkFrequency`) per visitor from `show_to`, `display_frequency`,
  `max_impressions` and `reshow_after_days` — see
  `resources/scripts/frontend/index.tsx:9,16`. Looking for either half in the
  other layer wastes an afternoon.
- **PHP-DI compiled container** lives in `wp-content/uploads/allfeedback/di-cache/{version}/` (path set in `Container::getCacheDir()`). Changing `config/services.php` **or any DI-resolved class's constructor signature** without clearing it crashes on boot with `ArgumentCountError`:
  ```bash
  rm -rf "/c/Users/Themegrill/Local Sites/test/app/public/wp-content/uploads/allfeedback/di-cache"
  ```
- **`routeTree.gen.ts`** at `resources/scripts/admin/routeTree.gen.ts` is auto-generated by TanStack Router on every build. Never edit it manually.
- **WP JSON decoding** — WordPress decodes JSON request bodies as `stdClass`, not arrays. Use `normaliseJsonParam()` helper and widen arg types to `['object','array','string','null']`.
- **Admin SPA routing** — Hash-based (`#/dashboard`, `#/forms`). Don't use `history` mode — it conflicts with WP admin URLs.

---

## Roadmap

> **Stale as of 1.0.0** — verified 2026-09-07. Three of the items below already
> ship, at different paths than planned. Left here so someone can retire them
> deliberately rather than by accident.

| Priority | Item | Planned path | Actual state |
|----------|------|--------------|--------------|
| ~~Next~~ | Targeting engine | `src/Survey/Targeting.php` | **done** at `src/Frontend/TargetingEngine.php` |
| ~~Next~~ | Frontend asset enqueue | `src/Survey/Assets.php` | **done** via `src/Support/AssetManager.php` + `FrontendServiceProvider` |
| ~~Later~~ | Widget HTML renderer | `src/Survey/Renderer.php` | **not needed** — the widget renders in React (`resources/scripts/frontend/`) |
| Later | Cron / data retention | `src/Cron.php` | open. Log *files* are already pruned by `Logger` on each write using `advanced.logging.retention_days` (`src/Support/Logger.php:358`); there is no scheduled retention for response or session rows |
| Later | FormRepository DB impl | `src/Infrastructure/Form/WpdbFormRepository.php` | open |

Form builder API (POST/GET/PUT/publish) — complete and validated.

---

## Docs

- [Architectural Patterns](.claude/docs/architectural_patterns.md) — DI, service providers, REST conventions, React Query, module system
- [API Reference](.claude/docs/api_reference.md) — All endpoints with params and example responses
