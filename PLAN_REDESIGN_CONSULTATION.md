# PLAN — تقدير Redesign: Consultation with 3 Priced Visual Options — Locked Decisions

> Created: 2026-09-01 — Build mode. Persistent context so we never lose decisions.
> Source audit: `PRD.md:1`, `prisma/schema.prisma:49`, `src/actions/estimates.ts:29`, `src/lib/ai/types.ts:1`, `src/lib/ai/prompt.ts:7`, `src/lib/ai/render-prompt.ts:15`, `src/components/new-estimate-form.tsx:1`, `src/lib/mock-db.ts:26`, `src/app/globals.css:3`, `PLAN_RENDER_MVP.md:1`, `PLAN_UI_SAAS.md:1`
> Skills: `frontend-design` (primary, distinctive identity), `vercel-react-best-practices` (critical/high), `tdd` (seams)
> Language: English for planning, Arabic RTL for product `src/app/layout.tsx:39`
> This file is the single source of truth for the redesign — read it before any code change.

---

## 0. Locked Decisions (user confirmed 2026-09-01)

| Topic | Decision | Why / Constraint |
|---|---|---|
| **Measurements** | Structured `lengthM / widthM / heightM Decimal?(10,2)` + `areaM2` computed (`length*width`), optional fallback `لا أعرف` | Replaces single `areaM2` scalar `prisma/schema.prisma:54`; keeps `rawDescription` for compat; auto-computes if dims present but no area |
| **Client wishes** | Structured chips `styleTags` `["عصري","كلاسيك","هادئ","ريفي","فاخر"]` single `style` + multi `styleTags String[]`; contractor interviews client (no client login MVP) | Pattern `QUICK_CHIPS` `src/components/new-estimate-form.tsx:8` → reuse `segmented` `src/app/globals.css:601` |
| **Contractor notes** | One `contractorNotes Text?` field during intake, plain textarea only (no photo annotation in MVP) | Distinct from `aiNotes` `prisma/schema.prisma:57`; not shown on client quote |
| **Materials / styles offered** | New `Material` catalog linked to `Contractor` with `grade OptionTier (economy/mid/premium)`, `unitPrice`, `visualHint`, `isActive` | Fixes gap `PriceItem {itemName,unit}` has no color/grade `prisma/schema.prisma:29` `PLAN_RENDER_MVP.md:13` — enables "same items, different grade/price" |
| **Visuals per option** | `1 hero angle / option = 3 images total` (MVP) using `photoPaths[0]` | Keeps sequential time 36-90s `src/actions/renders.ts:110` vs `12 images = 6min > timeout`; hero-only avoids `MAX_RENDERS_PER_ESTIMATE=4` `src/actions/renders.ts:12` blow-up |
| **Pricing of options** | Same quantities, 3 price columns via `Material.unitPrice` per grade; never invent prices `PRD.md:129` | Matching must filter `Materials` per tier; `EstimateOptionItem` stores snapshot |
| **Who sees options** | Contractor shows 3 cards on his phone (no share link MVP) | No auth/share token needed yet |
| **After picking** | `selectOption(tier)` clones `EstimateOptionItem → EstimateItem` + `status=final` still editable before print (yes) | Reuse `setEstimateStatus` `src/actions/estimates.ts:232` flow |
| **Fast mode** | Fully replaced by new wizard; old single-quote path removed | Breaking change |
| **Budget feeling** | **Marketing/UX best:** `segmented 3` `اقتصادي / متوازن / ممتاز` equals the 3 tiers, with live bubble `≈ 240 000 دج` `formatAmount` `src/lib/format.ts:4` + description `ماذا يشمل` under each chip. Fine-tune optional numeric `budgetDZD`. This ties budget directly to the visual choice. | `segmented` `src/app/globals.css:601` + `chip-ochre` `290`; beats pure slider for field use |
| **Quota reality** | Free models only MVP: chain `Gemini → OpenRouter → Mock` `src/lib/ai/index.ts:18` `src/actions/renders.ts:138` + `sleep(1200)` + 429 retry once | Needs new `src/lib/ai/openrouter.ts`; `GEMINI_API_KEY` valid `AIza…` `src/lib/ai/index.ts:7` else mock; free tiers ~60 RPM extract / ~10 RPM image `src/lib/ai/gemini.ts:9` |
| **Scope** | Algeria only, Arabic RTL `src/app/layout.tsx:39`, DZD `formatAmount` spaced thousands `src/lib/format.ts:7`, no extra deps `package.json:16` | Keep `dir=rtl`, `tnum ltr` `src/app/globals.css:92`, `font-brand Ruqaa` `src/app/layout.tsx:21` |

---

## 1. What Changes vs Current Pipeline

```
Before (PRD §5 + PLAN_RENDER_MVP):
  photo[]+desc → extract → match → review(edit) → final → N renders/angle → quote(text+gallery inside print-sheet)

After (Consultation Redesign):
  photo[] + dims(L/W/H) + style chips + budgetTier/budgetDZD + contractorNotes + material catalog
    → generateOptions(3 tiers) → matchTiered(3×)
    → 3 hero renders (photo[0] × 3 tiers, sequential)
    → compare(3 cards: image + ledger mini + total) → pick → clone to final → edit → print(1 hero + full ledger inside print-sheet)
```

One new parent: `Estimate (consultation)` → 3× `EstimateOption` → `EstimateOptionItem` + `EstimateRender(tier)`. Old `Estimate.estimateItems` becomes final selected snapshot only.

---

## 2. Data Model (one migration, mock parity)

```prisma
// prisma/schema.prisma — add
enum OptionTier { economy mid premium }

model Material {
  id           String     @id @default(uuid())
  contractorId String     @map("contractor_id")
  category     String
  itemName     String     @map("item_name")
  grade        OptionTier
  unit         String
  unitPrice    Decimal    @map("unit_price") @db.Decimal(12,2)
  visualHint   String?    @map("visual_hint") // "بيج مطفي / بورسلان 60×60"
  isActive     Boolean    @default(true) @map("is_active")
  contractor   Contractor @relation(fields:[contractorId], references:[id], onDelete:Cascade)
  @@index([contractorId, grade])
  @@map("materials")
}
model Contractor {
  // add
  materials Material[]
}
model Estimate {
  // keep: id, contractorId, clientName, roomType, areaM2, rawDescription, photoPaths, aiNotes, status, proofHash, lastRenderedAt, createdAt
  lengthM          Decimal?   @map("length_m") @db.Decimal(10,2)
  widthM           Decimal?   @map("width_m") @db.Decimal(10,2)
  heightM          Decimal?   @map("height_m") @db.Decimal(10,2)
  style            String?    @map("style")
  styleTags        String[]   @map("style_tags")
  budgetTier       String?    @map("budget_tier") // economy|mid|premium
  budgetDZD        Decimal?   @map("budget_dzd") @db.Decimal(14,2)
  contractorNotes  String?    @map("contractor_notes") @db.Text
  selectedOptionId String?    @map("selected_option_id")
  options          EstimateOption[]
  // renders stays for legacy, but per-option renders preferred
}
model EstimateOption {
  id         String                @id @default(uuid())
  estimateId String                @map("estimate_id")
  tier       OptionTier
  title      String                // "اقتصادي" / "متوازن" / "ممتاز"
  total      Decimal               @db.Decimal(14,2)
  proofHash  String?               @map("proof_hash")
  estimate   Estimate              @relation(fields:[estimateId], references:[id], onDelete:Cascade)
  items      EstimateOptionItem[]
  renders    EstimateRender[]
  @@index([estimateId, tier])
  @@unique([estimateId, tier])
  @@map("estimate_options")
}
model EstimateOptionItem {
  id         String         @id @default(uuid())
  optionId   String         @map("option_id")
  materialId String?        @map("material_id")
  itemName   String         @map("item_name")
  quantity   Decimal        @db.Decimal(10,2)
  unit       String
  unitPrice  Decimal        @map("unit_price") @db.Decimal(12,2)
  lineTotal  Decimal        @map("line_total") @db.Decimal(14,2)
  category   String
  option     EstimateOption @relation(fields:[optionId], references:[id], onDelete:Cascade)
  @@map("estimate_option_items")
}
model EstimateRender {
  // existing: id, estimateId, basePhotoPath, renderPath, status, model, promptHash, promptSnapshot, error, createdAt, renderedAt
  // add:
  tier     String? @map("tier") // economy|mid|premium
  optionId String? @map("option_id")
  option   EstimateOption? @relation(fields:[optionId], references:[id], onDelete:Cascade)
  @@index([estimateId, tier])
}
```

* Update `src/lib/mock-db.ts:26,41,73` Store types + `loadStore` `89-131` backfill + CRUD `164-487` for new tables, handling `String[]` for `styleTags` (Postgres native vs JSON fallback in mock).
* Seed `src/lib/seed.ts:6` — from `DEFAULT_PRICE_ITEMS` generate `3× Materials` with multipliers `economy 0.85 / mid 1.0 / premium 1.45` + `visualHint` generic (`أبيض مطفي / بيج بورسلان / رخام فاتح`).
* `data/mock-db.json:129` persists via `saveStore`; add `materials:[]` `estimateOptions:[]` `estimateOptionItems:[]`.
* Migration: `npx prisma migrate dev --name redesign_consultation_3options` (needs `DATABASE_URL` + `DATABASE_URL_UNPOOLED` `prisma/schema.prisma:14` pooled vs direct) or `npm run db:push` on Render; keep `src/lib/db.ts:7` mock switch `!DATABASE_URL → mock` for zero-config demo.

---

## 3. AI Provider Extension

`src/lib/ai/types.ts:34` extend:

```ts
type Tier = "economy" | "mid" | "premium";
interface GenerateOptionsInput {
  photos: PhotoInput[];
  dims: { lengthM:number|null; widthM:number|null; heightM:number|null; areaM2:number|null };
  styleTags: string[];
  budgetTier: Tier | null;
  budgetDZD: number | null;
  contractorNotes: string | null;
  roomType: string | null;
  description: string;
  allowedMaterials: { id:string; itemName:string; unit:string; category:string; grade:Tier; unitPrice:number; visualHint:string|null }[];
}
interface GenerateOptionsResult {
  options: { tier:Tier; title:string; items:{itemName:string; quantity:number; unit:string; materialId:string|null; category:string }[]; rationale:string|null }[];
  roomType: string | null;
  areaM2: number | null;
  notes: string | null;
}
interface RenderInput { basePhoto: PhotoInput; items: {itemName:string; category:string}[]; roomType:string|null; tier:Tier; styleTags:string[] }
interface AiProvider {
  readonly name:string;
  extract(input:ExtractionInput):Promise<ExtractionResult>; // kept for compat, new flow uses generateOptions
  generateOptions(input:GenerateOptionsInput):Promise<GenerateOptionsResult>;
  render(input:RenderInput):Promise<RenderResult>;
}
```

* `src/lib/ai/options-prompt.ts` (new) — `OPTIONS_SYSTEM_INSTRUCTION` enforces closed `allowedMaterials` per tier, never invent prices, output strict JSON ` {options:[{tier, items:[{item_name, quantity, unit}]}]}` via `responseSchema`. `buildOptionsPrompt(...)` serializes 3 tier allow-lists + dims/style/budget + contractorNotes. Tests `options-prompt.test.ts`.
* `src/lib/ai/render-prompt.ts:15` — `buildRenderPrompt(items, roomType, tier, styleTags)` appends tier palette block (`economy: سيراميك 30×30 أبيض مطفي`, `mid: بورسلان 60×60 بيج قابل للغسل`, `premium: رخام 80×80 + دهان فاخر + إضاءة مخفية بسيطة`), `hashRenderInput` includes `tier` else stale collision.
* `src/lib/ai/gemini.ts:18,90` — `generateOptions()` uses `ENDPOINT` `MODEL=gemini-3.6-flash` `generationConfig {responseMimeType:"application/json", responseSchema, temperature:0.3}`; `render()` uses `IMAGE_MODEL=gemini-2.5-flash-image` `responseModalities:["IMAGE","TEXT"]` `temperature:0.4` `src/lib/ai/gemini.ts:90,111`; both handle `429 → Arabic تجاوزت الحصة` `src/lib/ai/gemini.ts:40,119`.
* `src/lib/ai/openrouter.ts` (new) — `OpenRouterProvider implements AiProvider` OpenAI-compat `POST https://openrouter.ai/api/v1/chat/completions` with `messages:[{role:user, content:[{type:"image_url", image_url:{url:"data:mime;base64,..."}},{type:"text", text:prompt}]}]`; env `OPENROUTER_API_KEY` `OPENROUTER_MODEL` (free e.g. `qwen/qwen2.5-vl-7b-instruct:free` or Gemini flash free); fallback only on Gemini 429.
* `src/lib/ai/mock.ts:10,61` — `generateOptions` returns 3× same quantities with tier multipliers + `visualHint`, `guessDims` regex `(\d+[.,]?\d*)\s*[×x*]\s*(\d+[.,]?\d*)`; `render` returns base `imageBase64` with per-tier tint/watermark `model: mock-tier` so UI shows 3 distinct cards without key.
* `src/lib/ai/index.ts:18` — `getAiProvider()` chain `Gemini (valid AIza)` → else `Mock` `src/lib/ai/index.ts:7`, new `getFallbackProvider()` for OpenRouter.

---

## 4. Server Actions

* `src/actions/estimates.ts:29` → rewrite as consultation creator:
  - Reads `FormData photos (1-4)` `MAX_PHOTOS=4` `MAX_PHOTO_BYTES=4MB` `ALLOWED_MIME jpg/png/webp` `src/actions/estimates.ts:16`, plus `lengthM, widthM, heightM, styleTags, budgetTier, budgetDZD, contractorNotes, clientName, roomType, description` via helpers `num()` `139` + `trim`.
  - Persists `public/uploads/<estimateId>/0.jpg` `src/actions/estimates.ts:52` + builds `PhotoInput[]`.
  - Loads `ensureDefaultContractor()` `src/lib/seed.ts:39` + `prisma.material.findMany({contractorId, isActive:true})` (fallback to `priceItem` if catalog empty for migration).
  - Calls `provider.generateOptions(...)` (Gemini/OpenRouter, try/catch → Arabic error), then `matchTiered` per tier (reuse `normalizeArabic/tokenOverlap≥0.6` `src/lib/matching.ts:24,52`).
  - `prisma.estimate.create({ ..., options:{create:[{tier, title, total, items:{create: matchedRows}}]}})` single transaction.
  - `revalidatePath("/")` → `redirect(/estimates/<id>)`.
  - Keep `updateEstimateItem` `145`/`deleteEstimateItem` `171`/`addEstimateItem` `179` for post-pick final editing; add `updateEstimateMeta` fields length/style/budget/notes `221`.

* `src/actions/renders.ts:33` → `generateOptionRenders(estimateId, {heroIndex=0})`:
  - Load `estimate {photoPaths, options:{include:items}}`, validate `photoPaths.length>0`.
  - `heroPath = photoPaths[0]` (MVP single angle), `tiers = ["economy","mid","premium"]`.
  - For each tier sequentially: create `EstimateRender {status:pending, tier, optionId, basePhotoPath:heroPath, promptHash:hashRenderInput(items, roomType, tier)}`, `revalidatePath`.
  - Loop tiers sequentially with `sleep 1200ms` + `provider.render({basePhoto, items: option.items, roomType, tier, styleTags})` (try quota → fallback `MockProvider.render` `src/actions/renders.ts:138` mutated `model:"mock-fallback:quota"`).
  - Write `public/uploads/<id>/render-${tier}.jpg` `183` (`extForMime` `15`), update row `done/failed`, set `option.proofHash` + `estimate.lastRenderedAt`.
  - Helpers `regenerateOptionRenders(estimateId, tier)` and `deleteRenders`.

* `src/actions/options.ts` (new):
  - `selectOption(estimateId, tier)` — loads `EstimateOption` + items, deletes existing `EstimateItem` for final, bulk `create EstimateItem` from `OptionItem` snapshots (copy `unitPrice/lineTotal`), sets `estimate.selectedOptionId`, `status=draft` (still editable), `revalidatePath`.
  - `updateOptionItem` / validation stubs.

---

## 5. UI / UX — Mobile-First, keep tokens `src/app/globals.css:3`

**Design system (frontend-design):** Keep `paper #f7efe2 / ink #1e262b / teal #bf4d28 / ochre #b78c18` `globals.css:17,22` `Cairo 800 / Tajawal 700 / Ruqaa` `src/app/layout.tsx:9`. Signature: `card-zellige` `244` on recommended tier (`متوازن`) + `ruler` tape `56` atop wizard. All interactive `min 44px` `101,159`, focus ring `173`, `prefers-reduced-motion` `664`.

### Intake Wizard `src/components/consultation-wizard.tsx` (replaces `new-estimate-form.tsx:127`)

5 steps (segmented stepper `1 teal` rest `paper-100` `127-140` + `ruler-animated` header `76`):

1. **Photos** — reuse `dropzone` `633` `dragover teal` `647` + dual `galleryRef` (multiple) + `cameraRef capture=environment` `217-236` + `DataTransfer` merge `32` + `snap-x carousel h-28 w-28` `246` + remove `✕` `94`.
2. **Measurements** — 3 `field tnum ltr` `92` `16px mobile` `134` with `Stepper` `538` `step 0.5`, preview `≈ 12.0 م²` live, checkbox `لا أعرف — سيقدّرها الذكاء` (keeps dims nullable), hint `paper-100` `295`.
3. **Wishes** — chips `flex flex-wrap gap-1.5` `288` `chip bg-white border-line hover:border-teal` `285`; selected `chip-teal`; also `BottomSheet` `src/components/ui.tsx:72` for long list.
4. **Budget** — `segmented` triple `economy/mid/premium` `602` `[aria-pressed=true] bg-teal` `622` + live bubble `chip-ochre` `290` showing `formatAmount` `src/lib/format.ts:4`, ticks `ruler opacity .25` `quote:179`; also hidden `budgetDZD number` for fine-tune.
5. **Contractor notes** — `textarea field min-h110` `279` + `clientName` `302` optional.

Sticky CTA `sticky bottom-[72px] z20 bg-card/95 backdrop-blur` `317` offset `bottom-nav` `src/app/globals.css:322` avoids nav overlap; desktop `sm:static`. `useActionState` pending spinner `يحلّل ويولّد 3 خيارات…` → redirect to compare.

### Material Catalog `src/components/material-catalog-editor.tsx` (extends `price-list-editor.tsx:22`)

* New top-level page `src/app/materials/page.tsx` + editor: `Category suggestions 22` `Unit suggestions 23`, per-tier pills `economy/mid/premium` `121-134` active `bg-teal white` `128`, add form `border-dashed teal/40 bg-teal-50/60` `142`, accordion `205` rows `hover bg-paper/60` `231` with `visualHint` badge + `chip grade`. `BottomSheet` edit `293` + `ConfirmDialog` `357`.

### Compare `src/components/option-compare.tsx` on `src/app/estimates/[id]/page.tsx:60`

* `grid grid-cols-1 lg:grid-cols-3 gap-4` desktop, `snap-x snap-mandatory` mobile `new-estimate-form:246`.
* Card `card card-hover` `231` selected `border-teal bg-teal-50/60` `price-list:154` + `card-zellige` corner for `متوازن` (recommended) `244`; badge `chip-ochre موصى به` `290`.
* Hero `BeforeAfterSlider` `src/components/before-after-slider.tsx:58` `dir ltr` `57` per tier (single image, not gallery); proof strip `border-t paper` `quote-render-gallery:52` `ح proofHash#8` `59` + `تم التوليد` `58`.
* Collapsible `ledger` `302` mini `th 11px 1.5px line` `306` showing 3-5 lines + total `ochre` `161`; delta `chip-ink` vs cheapest.
* CTA `btn-primary اعتماد هذا الخيار` `177` full-width `md:sticky` `515`; `useTransition` `estimate-render-card:35` for pick.
* States: `pending skeleton shimmer` `579` + spinner `218`, `failed danger` `25` with `إعادة التوليد`, `fallback ochre` `193` ("وضع احتياطي — الأصل") `src/actions/renders.ts:199`, stale per tier `isRenderStale` `src/lib/render-hash.ts:16` banner `ochre` `estimate-render-card:159`.

### Quote `src/app/estimates/[id]/quote/page.tsx:84` (after pick)

* Only selected option's hero **inside** `print-sheet` `79-88` (so PDF = image+ledger one artifact), `h-1.5 bg-teal` `83` → `QuoteSingleGallery` → parties `108` → `ledger min-w520px scroll` `123` + total `ochre-soft/60` `161` + disclaimer `179`.
* `QuoteActions` `src/components/quote-actions.tsx:33` `no-print` `primary whatsapp wa.me` `35` `buildWhatsAppLink` `lib/whatsapp.ts` + `window.print` `50` + copy `59`.
* `@media print` `src/app/globals.css:794` hides `no-print`, forces `print-sheet border none` `802`, `ba-slider break-inside:avoid` `809`.

---

## 6. Follow-ups (Out of MVP Scope)

- Client share link (token) + client-facing choice UI (no login)
- Annotate photo for `contractorNotes` ("this wall")
- Multi-angle per tier (3×4) + queue/background job
- Cloudinary/S3 durable storage (Render FS ephemeral `prisma/schema.prisma:3` `PLAN_RENDER_MVP.md:112`)
- Version history for picked edits
- QR proof + verification page
- Persisted per-contractor rate-limit

---

## 7. Verification Checklist (matches PLAN_UI_SAAS.md:43, PLAN_RENDER_MVP.md:116)

- [ ] `npm run typecheck` pass
- [ ] `npm test` (Vitest) pass — `options-prompt` closed-list, `matchTiered` multipliers, `hashRenderInput` tier-aware, `proofHash` stale per tier, `provider-fallback` 429→OpenRouter→mock
- [ ] `npm run build` pass
- [ ] Manual QA viewports 360/390/768/1024: wizard stepper, compare snap, slider drag, print preview includes selected hero only
- [ ] Mock without keys (`DATABASE_URL` absent → `src/lib/db.ts:7` mock, no `GEMINI_API_KEY` → mock `src/lib/ai/index.ts:18`): create 3 options → 3 renders return base (no crash)
- [ ] With key: edit final items after pick → stale? (hash unchanged if quantity only — known gap `src/lib/render-hash.ts` hash excludes qty; document)
- [ ] Hero-only 3 images sequential, one failure doesn't block others `src/actions/renders.ts:110`
- [ ] Arabic RTL digits `tnum dir=ltr` `src/app/globals.css:92` everywhere `src/lib/format.ts:4` + price suffix `دج`

---

## 8. Build Order (for sub-agents, vertical slices)

1. **DB + mock + seed** — `prisma/schema.prisma`, `src/lib/mock-db.ts`, `src/lib/seed.ts`, `data/mock-db.json`, migration + `scripts/migrate-mock-to-neon.mjs:74`
2. **AI types/prompt/openrouter/gemini/mock + matching** — `src/lib/ai/types.ts`, `src/lib/ai/options-prompt.ts`, `src/lib/ai/render-prompt.ts`, `src/lib/ai/gemini.ts`, `src/lib/ai/openrouter.ts`, `src/lib/ai/mock.ts`, `src/lib/matching.ts`, `src/lib/render-hash.ts`
3. **Actions** — `src/actions/estimates.ts`, `src/actions/renders.ts`, `src/actions/options.ts`
4. **Components** — `src/components/consultation-wizard.tsx`, `src/components/material-catalog-editor.tsx`, `src/components/option-compare.tsx`, `src/components/option-render-card.tsx`, `src/app/globals.css` slider/segmented/range styles
5. **Pages wiring** — `src/app/estimates/new/page.tsx`, `src/app/estimates/[id]/page.tsx`, `src/app/estimates/[id]/quote/page.tsx`, `src/app/materials/page.tsx`, `src/app/prices/page.tsx` (kept or merged)
6. **Verify** — typecheck, tests, build, viewports, mock & real key QA

> This file supersedes `PLAN_RENDER_MVP.md` flow for new work (render MVP remains as reference for single-hero pattern), and extends `PRD.md` §4-§5. Keep as persistent context.
