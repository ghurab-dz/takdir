# PLAN — Quote-Locked Visual Proof (Render MVP) — Locked Decisions

> Created: 2026-09-01 — Build mode. Persistent context so we never lose decisions.
> Source audit: `PRD.md:1`, `src/actions/estimates.ts:29`, `src/lib/ai/types.ts:1`, `prisma/schema.prisma:49`, `src/components/estimate-editor.tsx:82`, `src/app/estimates/[id]/quote/page.tsx:56`
> Skills: `frontend-design` (primary), `vercel-react-best-practices`, `tdd`

## 0. Locked Decisions (user confirmed)

| Question | Decision | Rationale |
|---|---|---|
| **When to generate?** | **(B) on-demand after review when status→final** | Guarantees render = audited quote, no wasted calls on drafts the contractor will edit. Single AI call(s) at end, not per keystroke. |
| **Which base photo?** | **N renders = 1 render per uploaded photo (1…4), auto for ALL photos in MVP** — no per-photo picker in v1 | One angle can't prove a multi-angle room ("this isn't what I pictured" for the other corner). Generating for ALL is simplest UX (no selection UI) and still bounded (max 4). Architecture supports N from day one; selection UI is fast-follow if cost needs trimming. |
| **Visual grounding** | **(a) Generic plausible finish + disclaimer for v1** | `PriceItem {itemName,unit}` has no color/sku today `prisma/schema.prisma:29`. Rendering generic "white matte paint / beige tile" with disclaimer "صورة توضيحية — ليست مطابقة 100%" lets us ship without enriching price list. v2 adds `visualHint` cols. |
| **Image model** | **Gemini free tier image output — same key, same adapter** | Reuse `src/lib/ai/gemini.ts:8` pattern, keep one env var `GEMINI_API_KEY`, free tier covers MVP volume. |
| **Regeneration** | **Yes — stale detection + regenerate** | Editing items after render makes proof invalid; mark stale + CTA `إعادة التوليد`. |
| **Proof placement** | **Hero INSIDE print-sheet on quote page** | Image + ledger must print as one artifact (Ctrl+P / PDF). Image sits at top of `print-sheet` `quote/page.tsx:57`, ledger below, timestamp footer. Digital: before/after slider per angle. |

## 1. What Changes vs Current Pipeline

```
Before (PRD §5):  photo[]+desc → extract → match → review (edit) → final → quote (text table)
After  (MVP):     ... same ... → final → [Generate Renders: photo[i] + final items[] → N images] → quote (image gallery hero + table = timestamped proof)
```

One new step, N AI calls (one per photo), no new app.

## 2. Data Model (one migration)

Add child table, not columns on Estimate (future-proofs N):

```prisma
model EstimateRender {
  id            String   @id @default(uuid())
  estimateId    String   @map("estimate_id")
  basePhotoPath String   @map("base_photo_path")
  renderPath    String?  @map("render_path")
  status        String   @default("pending") // pending|done|failed
  model         String?
  promptHash    String?  @map("prompt_hash")
  promptSnapshot String? @map("prompt_snapshot") @db.Text
  error         String?  @db.Text
  createdAt     DateTime @default(now()) @map("created_at")
  renderedAt    DateTime? @map("rendered_at")
  estimate      Estimate @relation(fields:[estimateId], references:[id], onDelete:Cascade)
  @@index([estimateId])
  @@map("estimate_renders")
}
model Estimate {
  // add
  proofHash     String?   @map("proof_hash") // hash of items at last render
  lastRenderedAt DateTime? @map("last_rendered_at")
  renders       EstimateRender[]
}
```

Update `src/lib/mock-db.ts:26` types + CRUD for `estimateRender`. `data/mock-db.json` persists.

Stale check: `currentHash != estimate.proofHash` → banner "العرض أقدم من التعديل".

## 3. AI Provider Extension

`src/lib/ai/types.ts:34` add:
```ts
interface RenderInput { basePhoto: PhotoInput; items: {itemName, category}[]; roomType: string|null }
interface RenderResult { imageBase64: string; mimeType: string; model: string }
interface AiProvider { extract(...); render(input: RenderInput): Promise<RenderResult> }
```

* `src/lib/ai/render-prompt.ts` (new) — SYSTEM_RENDER: surgical editor, ONLY listed categories, preserve angle/geometry, no furniture/decor, photorealistic. `buildRenderPrompt(items)` serializes closed allow-list. Tests `render-prompt.test.ts`.
* `src/lib/ai/gemini.ts:16` — `render()` uses `ENDPOINT` with `responseModalities:["IMAGE"]`, model `gemini-2.5-flash-image` (env `GEMINI_IMAGE_MODEL`), low temp 0.3. Pass base image as `inline_data` + text prompt. Parse `inlineData` from candidates.
* `src/lib/ai/mock.ts:10` — mock returns base image base64 unchanged (+ optional 1px watermark) with note "وضع المحاكاة".

## 4. Server Actions

New `src/actions/renders.ts`:
- `generateRenders(estimateId)` — loops `estimate.photoPaths` (up to 4), creates pending rows, sequential AI calls (one at a time to respect free-tier rate), writes `public/uploads/<id>/render-<i>.webp`, updates done/failed, sets `proofHash`+`lastRenderedAt`, `revalidatePath` both pages.
- `regenerateRenders(estimateId)` — deletes old done then re-calls.
- `deleteRender(renderId)` — helper.

All respect daily quota check stub (e.g. max 20 renders/day per mock contractor, stored in memory; real DB would count today rows).

Photos reused from `src/actions/estimates.ts:52` storage.

## 5. UI / UX (Mobile-First, keep tokens `src/app/globals.css:9` terracotta)

### Review screen `src/app/estimates/[id]/page.tsx:16` + `estimate-editor.tsx:113`
New component `src/components/estimate-render-card.tsx` inserted between photos card and AI notes:
- Before final: hint "بعد الاعتماد سيُنشأ معاينة نهائية لكل زاوية"
- After final, no renders yet: primary CTA `توليد المعاينة النهائية (N صور)` + secondary `توليد لاحقًا` → calls `generateRenders`, shows per-image progress (skeleton `globals.css:579` + spinner)
- With renders: gallery of tiles per angle (before/after slider), status badges `chip-teal` done / `chip-ochre` pending / `chip-ink` failed, `إعادة التوليد` + `حذف` for failed. Stale banner if edited after.

Action button on sticky total `estimate-editor.tsx:461`: primary "اعتماد وتوليد المعاينة" replaces two-step.

### Quote page `src/app/estimates/[id]/quote/page.tsx:56`
New `src/components/quote-render-gallery.tsx` **inside** `print-sheet` hero slot (after the 1.5px teal header, before parties grid):
- Digital: large After hero (first render) + dot carousel or grid for N>1. Each tile is interactive before/after slider (clip-path, drag handle — no extra dep).
- Caption per tile: `زاوية i — بعد التشطيب (تقريبي)` + tiny `قبل` inset 48px.
- Failed tiles show retry button (no-print excluded? print skips failed).
- Print: `@media print` `globals.css:675` — gallery prints with After images full-width, slider disabled, before insets remain. `no-print` controls hidden.

Footer addition: `تم التوليد YYYY-MM-DD HH:MM — مرجع #XXXX — hash:8char — الصورة توضيحية مطابقة للبنود أعلاه فقط.`

### Global
`src/app/globals.css:1` add slider styles (`.ba-slider`, handle, clip). Keep `terracotta #bf4d28` primary, `paper #f7efe2`.

QuoteActions `src/components/quote-actions.tsx:31` add `تحميل الصور (ZIP)` and `مشاركة مع الصور` (`navigator.share` with files if supported, else fallback to download + wa.me text).

## 6. Follow-ups (Out of MVP Scope)
- Per-photo selection checkboxes (if cost needs control)
- PriceItem visualHint (color/swatch) + reference image grounding
- Version history (keep old renders)
- Cloudinary/S3 durable storage (Render FS is ephemeral)
- QR proof link + items hash verification page
- Rate-limit persisted per contractor

## 7. Verification Checklist (matches PLAN_UI_SAAS.md:43)
- [ ] `npm run typecheck` pass
- [ ] `npm test` (Vitest) pass — `render-prompt` closed-list, `proofHash` stale, quota
- [ ] `npm run build` pass
- [ ] Manual QA viewports 360/390/768/1024: slider drag, print preview includes images
- [ ] Mock mode without GEMINI_API_KEY: renders return base (no crash)
- [ ] With key: edit quote after render → stale → regenerate clears stale
- [ ] Multi-photo (1, 2, 4) all render, failure of one doesn't block others

## 8. Build Order (for sub-agents)
1. DB schema + mock-db
2. AI types/prompt/gemini/mock
3. Actions renders.ts
4. Components (render-card + gallery + slider CSS)
5. Pages wiring
6. Verify

> This file is the single source of truth — read it before any code change.
