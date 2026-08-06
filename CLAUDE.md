# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page interactive web app that is simultaneously a commercial proposal (КП / "коммерческое предложение") and a price calculator for an architecture bureau's project & marketing services. The finished proposal is exported to PDF via the browser's print dialog. UI text is in Russian.

The calculator has two families of offerings, each in a collapsible plate:
- **Project disciplines** — `int` (интерьер), `arch` (архитектура), `blago` (благоустройство). Each is a `DisciplinePlate` with its own params (площадь + тип) and per-stage cards. Stages: int/arch = ОД→К→ЭП→РД→Надзор; blago = ОД (топооснова)→МП→ГП. Priced by the **unified pricing system** (see below).
- **Презентационные материалы** — the original visualization blocks b1–b4 (`BLOCKS`, `blockPrice`/`priceOf`, `CalculatorBlock`), unchanged. Visualizations live ONLY here, never in arch/blago.

### Unified pricing system (disciplines)
Editable constants at the top of the Babel script; calibrated from the bureau's historical data + РФ market analysis. Formula: `ставка = BASE_RPM[disc][stage] × DISC_TYPE_K[disc][тип] × rateAreaK(disc,area)`, then `стоимость = max(area×ставка, dayNorm() × срок)`. That `max` is the **окупаемость floor** — the load-bearing rule that guarantees payback ≥ 1 (no «минус»), which the client explicitly required; do not remove it. **`dayNorm()` is a single company-wide break-even ₽/day = `COMPANY.monthlyCost / (COMPANY.projects × WORKDAYS_PER_MONTH)`** (defaults 2 500 000 / 6 / 21 ≈ 19 841). `COMPANY.monthlyCost` & `.projects` are user-editable in «Инструменты компании»; App syncs the module `COMPANY` from state (`companyCost`/`companyProjects`) each render, and `total`/`autoDays` memos list them as deps. Срок = `BASE_DAYS × daysAreaK × DISC_TYPE_DAYS_K` (type factor bounded <2×). `MARKET_RPM` decays with area (via `rateAreaK`) so market deltas are scale-fair. `rateAreaK` floor 0.55. Надзор has its own tiered per-month prices (`NADZOR`) + market ref (`MARKET_NADZOR`), not the m²-formula. `stageCost` respects a per-stage `manualPrice`; `stageSuggestion` proposes a price when the user overrides срок (proportional down; up only if payback < 150% / <130% over 5 млн). Key functions: `discCost`, `discDays`, `stageCost`/`stageAutoCost`/`stageDays`, `enabledStageItems`/`discCostTotal`/`discDaysTotal`.

### «Инструменты компании»
An internal toggle in the black `SummaryBar` (`showTools` state) — **screen-only, never in the client PDF** (`PrintProposal`). Shows per-service окупаемость% (`stagePayback` vs `DAY_NORM`) and отклонение к рынку РФ% (`stageMarketDelta` vs `MARKET_RPM`), plus a company aggregate.

## Critical constraints (do not break these)

- **No build step, no backend.** The whole app is `index.html`. The target Windows machine has **no Node.js and no Python**, so there is no dev server, no npm, no bundler, and no way to run the app from a terminal here. Verify visually in the user's browser, not via CLI.
- **All libraries are CDN `<script>` tags** loaded at runtime: React 18 + ReactDOM (unpkg UMD), `@babel/standalone` (the app code is one `<script type="text/babel" data-presets="react">` block, compiled in-browser), Tailwind Play CDN (`cdn.tailwindcss.com`) with inline `tailwind.config`, and Inter via Google Fonts.
- **No persistence.** Never use `localStorage`/`sessionStorage`. All state lives in React (`useState`) only.
- **No fabricated statistics.** Sales-impact percentages are content, not computed — only use values the user provides.
- **Follow the REZEDA brand book.** Palette in `tailwind.config`: neutrals `air #FFFFFF`, `steel #F2F2F2` (page bg), `concrete #D9D9D9` (hairline borders), `night/ink #000000`; accents used **sparingly/"дозированно"**: `sun #F7FF1D` (neon-yellow — CTA, summary highlights, hover), `lilac #C4A2F7` (per-block "Влияние на продажи", textures), `grape #916BD8` (focus, checkbox, description accent bar), `dawn #FFA352` (rare). Most surfaces stay neutral; color is a flash, not a fill. (`bg`/`accent`/`accentSoft` remain as back-compat aliases.)
- **Typography is brand-locked.** Headings = **Inter Regular** (`font-normal`), body = **Inter Light** (`font-weight: 300`, set on `body`). Do **not** reintroduce `font-bold`/`font-extrabold` for display text — emphasis comes from size + the global `h1–h5 { font-weight: 400 }` rule. Labels/kickers are small uppercase with wide tracking.
- **Flat, modular, architectural.** No drop shadows — use the `.hair` 1px `concrete` border instead. No rounded corners: enforced globally via `*, *::before, *::after { border-radius: 0 !important; }`.
- **Header is intentionally minimal.** Only the logo (`LOGO.png`, white wordmark rendered black via `filter: brightness(0)`) and the caption "Коммерческое предложение" beneath it, in a hairline-bordered bar. Do **not** add decorative marks, hero banners, taglines, `ID REZEDA`/year labels, or other copy that wasn't requested — the user has explicitly removed such additions.
- **Rubles formatted with space thousands-separators** (e.g. `12 000 ₽`) via the `rub()` helper.

## Editing & verifying

- Edit `index.html` directly. There is nothing to compile or install. Open it in a browser to see changes.
- **PDF / print is a first-class output.** The proposal must fit a budget of **4 A4 pages**. The print rules live in the `@media print` block in `<style>`. Key levers:
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

5. **State flow in `App`:** two state objects — `params` (project params) and `blocks` (per-block selections). A `useEffect` keyed on `params` re-syncs the recommended counts for b1/b3 whenever project params change. `total` is the sum over enabled blocks via `blockPrice`; the combined sales-effect range is computed from the count of enabled blocks. `SummaryBar` is the sticky right-hand panel and triggers `window.print()`.

## Photo examples

Image examples live in `examples/` (constant `EX = "examples/"`), named by block/level, 16:10 `.jpg` — see `examples/_PHOTOS_HERE.txt` for the exact filename convention. `PhotoPlaceholder` shows a "Фото будет добавлено" placeholder when a file is missing, so absent images are fine. `LOGO.png` is a white wordmark rendered black for the light theme via `filter: brightness(0)`.
