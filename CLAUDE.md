# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page interactive web app with **two tools behind a top tab bar** (`Root`, `tab` state = `"kp" | "doc"`):

1. **Коммерческое предложение** (`App`) — the original КП: simultaneously a commercial proposal and a price calculator for an architecture bureau's project & marketing services, exported to PDF via the browser's print dialog.
2. **Договор** (`ContractTool`) — a contract generator that reproduces the bureau's four Word templates (архитектура/интерьер × типовой/«ФОРТУНА»), see «Договор» below.

UI text is in Russian. Both panes stay mounted (`display:none` on the inactive one) so state survives tab switches and the КП→Договор transfer works; `display:none` also keeps the hidden pane out of print.

The КП calculator has two families of offerings, each in a collapsible plate:
- **Project disciplines** — `int` (интерьер), `arch` (архитектура), `blago` (благоустройство). Each is a `DisciplinePlate` with its own params (площадь + тип) and per-stage cards. Stages: int/arch = ОД→К→ЭП→РД→Надзор; blago = ОД (топооснова)→МП→ГП. Priced by the **unified pricing system** (see below).
- **Презентационные материалы** — the original visualization blocks b1–b4 (`BLOCKS`, `blockPrice`/`priceOf`, `CalculatorBlock`), unchanged. Visualizations live ONLY here, never in arch/blago.

### Unified pricing system (disciplines)
Editable constants at the top of the Babel script; calibrated from the bureau's historical data + РФ market analysis. Formula: `ставка = BASE_RPM[disc][stage] × DISC_TYPE_K[disc][тип] × rateAreaK(disc,area)`, then `стоимость = max(area×ставка, dayNorm() × срок)`. That `max` is the **окупаемость floor** — the load-bearing rule that guarantees payback ≥ 1 (no «минус»), which the client explicitly required; do not remove it. **`dayNorm()` is a single company-wide break-even ₽/day = `COMPANY.monthlyCost / (COMPANY.projects × WORKDAYS_PER_MONTH)`** (defaults 2 500 000 / 6 / 21 ≈ 19 841). `COMPANY.monthlyCost` & `.projects` are user-editable in «Инструменты компании»; App syncs the module `COMPANY` from state (`companyCost`/`companyProjects`) each render, and `total`/`autoDays` memos list them as deps. Срок = `BASE_DAYS × daysAreaK × DISC_TYPE_DAYS_K` (type factor bounded <2×). `MARKET_RPM` decays with area (via `rateAreaK`) so market deltas are scale-fair. `rateAreaK` floor 0.55. Надзор has its own tiered per-month prices (`NADZOR`) + market ref (`MARKET_NADZOR`), not the m²-formula. `stageCost` respects a per-stage `manualPrice`; `stageSuggestion` proposes a price when the user overrides срок (proportional down; up only if payback < 150% / <130% over 5 млн). Key functions: `discCost`, `discDays`, `stageCost`/`stageAutoCost`/`stageDays`, `enabledStageItems`/`discCostTotal`/`discDaysTotal`.

### «Договор» (вкладка 2)
Generates the full package — Договор + Приложение №1 «Состав работ» + optional Приложение №2 (налоговые заверения / НДС) — from one form. Reverse-engineered 1:1 from the bureau's files; the sources analysed were `архитектура типовой`, `архитектура ФОРТУНА`, `дизайн-проект типовой ворд`, `дизайн ФОРТУНА` and the filled `8_26 Ликон-2`.

- **One tree, two renderers.** `docTree(model)` returns a flat list of blocks (`h/at/p/sp/br/tbl`); `DocSheet`+`DocBlock` render it to HTML (on-screen preview **and** the print/PDF layout), `docxBlocks` renders the same tree with the `docx` UMD library. **Never fork the wording between the two outputs — edit `docArticles`/`docTerms`/`docTree` only.**
- **Format axes.** Discipline (`arch` / `int`) changes определения, ст. 2, ст. 5, ст. 9, исходные данные, field labels, default stage count and блоки правок. The «ФОРТУНА» axis is reduced to two independent checkboxes: `nda` (adds «не ранее, чем через N года…» to п. 7.5/7.6) and `app2` (Приложение №2).
- **Point numbering is literal text**, not Word auto-lists. Cross-references (`п. 6.1`, `ст. 4`, `п. 6.2`, `п.п. 1.4, 2.4, 4.7`) are hardcoded to match the templates — **the order of points inside an article must not change**, or the references break.
- **Word geometry matches their files exactly**: A4 11900×16840 twips, margins top/right/bottom/left 1021/851/1021/1134, header 709 / footer 567, **Inter 9 pt** (`size: 18`), justified, logo right-aligned ~29 mm in the header, «Исполнитель ___ Заказчик ___» centred in the footer, all tables borderless (their tables use white borders).
- **PDF keeps the same geometry** with `@page margin: 10mm` + `.doc-frame` side margins; the running header/footer are `thead`/`tfoot` of `.doc-frame`, which is the only way a browser repeats them on every page. Page breaks split the tree into one `.doc-frame` table per part.
- **Money & numbers in words**: `numWords`/`genWords`/`plural`, `cash()`, `daysNom()`, `daysIn()`. НДС 5% is derived as `5/105` (`ndsOf`) when the executor's `tax === "nds5"`, and suppressed when the sum is 0. Ставка = total ÷ площадь unless overridden. The contract total is always Σ stage prices — there is no separate total field.
- **`docx` is lazy-loaded** from `https://unpkg.com/docx@9.7.1/dist/index.umd.cjs` (pinned; unpkg serves `.cjs` as `text/javascript`, jsDelivr does not, so the URL matters) on the first Word click, so the КП tab doesn't pay for 1.1 MB.
- **The logo is embedded as base64** (`DOC_LOGO_B64`, black wordmark 208×30 lifted from their header) — the page runs from `file://` where `fetch`/canvas access to local images is blocked, and the bytes are needed inside the .docx.
- **`kpSnapshot`** (written to a ref by `App`, read by «Перенести из КП») carries stage name/description/price/days + площадь per discipline. It transfers *their* КП wording — do not invent deliverable lists.
- Presets: `PRESET_EXECS` (ИП Галин Д.С., ИП Мороз А.В.) and `PRESET_CLIENTS` (ООО «АзияСибИнвест», ИП Чекотова Н.А.) — taken from the sample contracts, editable and stored per-user.

### Сервер данных (`server/rezeda-server.js`)
The user's own machine is the store for counterparty legal data; other devices read it over the LAN. **This is the one part of the project that is not `index.html`** — a dependency-free Node script (`node server/rezeda-server.js`); the launcher lives next to the data, outside the repo.

- **Endpoints**: `GET /api/ping`, `GET /api/data`, `PUT /api/data` (server-side merge), plus static serving of the repo root, so `http://<lan-ip>:8765/` opens the app itself. CORS is open (`*`) because the page is often opened from `file://`, which has an opaque origin.
- **Data lives OUTSIDE the repo** — sibling folder `../КП автоматизация Резеда - сервер/dogovor-data.json` (+ `.bak`, atomic tmp+rename write), which also holds the launcher `Запустить сервер данных.cmd`. **The repo is public**, so counterparty legal data (ИНН, счета, паспорта) must never be committed: `PRESET_EXECS`/`PRESET_CLIENTS` are deliberately empty arrays and the directory is seeded in that JSON file instead. `.gitignore` is a second line of defence.
- **Merge rule, shared by server and client** (`mergeDir`): same `id` → the record with the newer `updatedAt` wins; deletions are **tombstones** (`deleted: true`), so a profile deleted on one device is not resurrected by another that still remembers it. UI lists are filtered through `alive()`.
- **Offline-first**: `SRV_SELF` (page opened over http) → same-origin; otherwise the address comes from the «Адрес сервера данных» field (`rezeda.dogovor.server` in localStorage, default `http://localhost:8765`). `srvFetch` aborts after 4 s. Every failure path falls back to the localStorage copy — the app must stay fully usable with the server off. `pull()` runs once on mount (read-only); the «Синхронизировать» button is a two-way exchange (`pushDirs`, server merges and returns the union).
- **Password**: when `REZEDA_TOKEN` is set, `/api/data` and `/api/ping` return `401 {authRequired:true}` without the `X-Rezeda-Key` header; the app shows a «Ключ доступа» field (`rezeda.dogovor.key` in localStorage) and a distinct `auth` sync state. Static files stay open — the HTML holds no secrets. **The token itself must never be committed**: it lives only in the launcher on the bureau's machine.
- **External access** is `ngrok http 8765` — it works through the bureau's corporate VPN (443) and reuses the account's one reserved free domain, so the link is stable. That same domain also serves their other project (CFO REZEDA, port 8770), so only one of the two can be exposed at a time. Fallback: `ssh -R 80:localhost:8765 nokey@localhost.run` (fresh URL each run). **Cloudflare Tunnel does not work here**: the VPN blocks outbound 7844 (TLS handshake EOF) and its DNS hands out synthetic 198.19.x.x addresses, breaking SRV discovery — don't spend time retrying it. `srvFetch` sends `ngrok-skip-browser-warning` so the free plan's interstitial can never replace a JSON response.
- Optional `REZEDA_PORT` / `REZEDA_TOKEN` / `REZEDA_DATA_DIR`. User-facing instructions: `server/README.md`.

### «Инструменты компании»
An internal toggle in the black `SummaryBar` (`showTools` state) — **screen-only, never in the client PDF** (`PrintProposal`). Shows per-service окупаемость% (`stagePayback` vs `DAY_NORM`) and отклонение к рынку РФ% (`stageMarketDelta` vs `MARKET_RPM`), plus a company aggregate.

## Critical constraints (do not break these)

- **No build step for the app.** The whole UI is `index.html` — there is no bundler and no framework build. The only server-side code is the optional data server in `server/`, which the app never requires to function. There is no dev server, no npm, no bundler. (A Python 3.12 and a portable Node do exist on this machine — usable for *inspecting* files, e.g. unzipping .docx — but never as a runtime dependency of the app.) Verify visually in a browser.
- **All libraries are CDN `<script>` tags** loaded at runtime: React 18 + ReactDOM (unpkg UMD), `@babel/standalone` (the app code is one `<script type="text/babel" data-presets="react">` block, compiled in-browser), Tailwind Play CDN (`cdn.tailwindcss.com`) with inline `tailwind.config`, Inter via Google Fonts, and `docx` (lazy, only on Word export).
- **No persistence in the КП tab.** Never use `localStorage`/`sessionStorage` there — all КП state lives in React (`useState`) only. **The only exception is the «Договор» tab**, where the user explicitly asked for counterparty data to persist on their computer: key `rezeda.dogovor.v1`, written through `lsSave`/`lsLoad` (both swallow errors), guarded by `STORAGE_OK`, with «Экспорт / Импорт» JSON as the fallback and backup path.
- **No fabricated statistics.** Sales-impact percentages are content, not computed — only use values the user provides.
- **Follow the REZEDA brand book.** Palette in `tailwind.config`: neutrals `air #FFFFFF`, `steel #F2F2F2` (page bg), `concrete #D9D9D9` (hairline borders), `night/ink #000000`; accents used **sparingly/"дозированно"**: `sun #F7FF1D` (neon-yellow — CTA, summary highlights, hover), `lilac #C4A2F7` (per-block "Влияние на продажи", textures), `grape #916BD8` (focus, checkbox, description accent bar), `dawn #FFA352` (rare). Most surfaces stay neutral; color is a flash, not a fill. (`bg`/`accent`/`accentSoft` remain as back-compat aliases.)
- **Typography is brand-locked.** Headings = **Inter Regular** (`font-normal`), body = **Inter Light** (`font-weight: 300`, set on `body`). Do **not** reintroduce `font-bold`/`font-extrabold` for display text — emphasis comes from size + the global `h1–h5 { font-weight: 400 }` rule. Labels/kickers are small uppercase with wide tracking.
- **Flat, modular, architectural.** No drop shadows — use the `.hair` 1px `concrete` border instead. No rounded corners: enforced globally via `*, *::before, *::after { border-radius: 0 !important; }`.
- **Header is intentionally minimal.** Only the logo (`LOGO.png`, white wordmark rendered black via `filter: brightness(0)`) and a one-line caption beneath it ("Коммерческое предложение" / "Договор"), in a hairline-bordered bar. Do **not** add decorative marks, hero banners, taglines, `ID REZEDA`/year labels, or other copy that wasn't requested — the user has explicitly removed such additions.
- **The contract document is not brand-styled.** Inside `.doc` it is a legal document: Inter 9 pt, black on white, justified, no accent colours. The brand palette applies to the *form* around it, not to the document.
- **Rubles formatted with space thousands-separators** (e.g. `12 000 ₽`) via the `rub()` helper.

## Editing & verifying

- Edit `index.html` directly. There is nothing to compile or install. Open it in a browser to see changes.
- **PDF / print is a first-class output.** The **КП** must fit a budget of **4 A4 pages** (the contract has no page budget — it is ~9 pages, like their Word original). The print rules live in the `@media print` block in `<style>`. Key levers:
  - `html { zoom: 0.82 }` — global shrink to hit the page budget; tune this if content overflows or underflows 4 pages.
  - `.no-print` / `.print-hide` — hidden in print (interactive controls, photos, infographic bars).
  - `.print-block`, `.print-tight`, `.print-gap`, `.print-mt`, etc. — compact spacing and avoid page breaks.
  - `print-color-adjust: exact` is forced on everything so the dark "Стоимость блока" / "Влияние на продажи" cards and the dark summary panel keep their fills in the PDF (browsers strip backgrounds otherwise). The PDF is inherently vector — exported via `window.print()`.

## Architecture (all inside `index.html`)

The app code is one Babel-compiled script. Read it top-to-bottom; the layers are:

1. **Editable config constants** (top of the script). These are meant to be tuned without touching logic:
   - `PRICING` — per-block rate tables (`b1`–`b4`).
   - `DURATIONS` — video-length options for block 4 (`durSec`/`durLabel` helpers).
   - `recommend` — pure functions giving the recommended viewpoint/frame count from project params (only `b1`, `b3`).
   - `TYPE_FACTOR`, `FLOOR_BANDS`, `floorFactor`, `globalFactor` — the project-complexity multiplier.
   - `BLOCKS` — the array driving all four calculator sections (kicker, title, options, photos, mode, etc.).
   - `OBJECT_TYPES`.

2. **Pricing pipeline (pure functions):**
   - `globalFactor(p) = TYPE_FACTOR[objectType] × clamp(0.8, 2.5, 0.8 + area/40000) × floorFactor(floors)`. **Building area is intentionally the strongest cost driver.** Applied to b1, b3, b4 — **not** b2.
   - `priceOf` holds per-block formulas; `blockPrice(id, state, params)` is the dispatcher that routes each block to its formula based on its inputs.

3. **The block "mode" abstraction.** The four proposal blocks share one `CalculatorBlock` component but differ by `cfg.mode`:
   - `"count"` (b1 exterior, b3 interior) — quality toggle + a count stepper.
   - `"area"` (b2 axonometric model) — a standalone area input that is empty by default and is **not** auto-filled from project params; b2's price comes solely from this input.
   - `"duration"` (b4 video) — quality toggle + duration selector instead of a count.
   When adding/altering a block's UI, change `CalculatorBlock` (and `blockPrice`/`priceOf`) by mode rather than special-casing one block.

4. **Components:** `AnimatedNumber` (requestAnimationFrame count-up for prices/totals), `QualityToggle`, `StatBar` (defined but **not rendered** — dead code), `PhotoPlaceholder`, `CalculatorBlock`, `ProjectParams`, `SummaryBar`, and the root `App`.

   **Brand textures.** Source files in `текстуры/` are PDFs (`REZ-fon-1..6.pdf`, lilac/yellow dither on gray) and **cannot be used as CSS/img backgrounds** in a browser; there is also no rasterizer available (no Node/Python/ImageMagick). A vector-SVG recreation was tried (hero `BrandTexture`) and **removed** at the user's request along with the pixel "+" mark — keep the UI free of these decorative additions unless explicitly asked.

5. **State flow in `App`:** two state objects — `params` (project params) and `blocks` (per-block selections). A `useEffect` keyed on `params` re-syncs the recommended counts for b1/b3 whenever project params change. `total` is the sum over enabled blocks via `blockPrice`; the combined sales-effect range is computed from the count of enabled blocks. `SummaryBar` is the sticky right-hand panel and triggers `window.print()`. `App` also publishes `kpSnapshot(...)` into `snapRef` on every change — that ref is how the Договор tab reads КП stages without re-rendering.

6. **Договор module** — three clearly marked sections after `App`, in order: `1/3` numbers-in-words, helpers, presets, `docModel`, party sentences and requisites; `2/3` `docArticles`/`docTerms`/`APP2`/`docTree` (all the legal text); `3/3` `DocSheet`/`DocBlock`, `docxBlocks`/`exportDocx`, localStorage, form components, `ContractTool`, `Root`.

## Photo examples

Image examples live in `examples/` (constant `EX = "examples/"`), named by block/level, 16:10 `.jpg` — see `examples/_PHOTOS_HERE.txt` for the exact filename convention. `PhotoPlaceholder` shows a "Фото будет добавлено" placeholder when a file is missing, so absent images are fine. `LOGO.png` is a white wordmark rendered black for the light theme via `filter: brightness(0)`.
