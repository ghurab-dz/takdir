# تقدير — SaaS UI Upgrade Plan (Mobile-First) — Persistent Context

> Created: 2026-08-27 — Build mode. Recommended + best-practice choices locked.
> Source audit: `src/app/layout.tsx:1`, `src/app/globals.css:1`, `src/app/page.tsx:1`, `src/components/*`, `PRD.md:1`
> Skills applied: `frontend-design` (primary), `theme-factory` tokens, accessibility best-practices.

## Decisions (Recommended)
1. **Navigation:** 3-tab bottom nav + centered elevated FAB (`+` new estimate) on <640px. Desktop keeps header inline button. Chosen over 4-tab flat: FAB gives primary action 2x larger touch target, matches field ergonomic for dusty hands, standard SaaS mobile pattern.
2. **Prices editing:** Bottom sheet (not inline expand). Chosen: sheet gives 16px inputs, full keyboard, swipe dismiss — thumb-reachable vs inline cramped grid.
3. **Paper aesthetic:** Keep warm ledger (`paper #f6f3ec`) for app shell, but quote `print-sheet` stays pure white with stronger ink border for print trust. Best of both.

## Design System — Tokens (extends `globals.css:3`)

```css
--color-paper: #f6f3ec; --color-paper-100:#efece3; --color-card:#fffdf9;
--color-ink:#1d2a2b; --color-ink-soft:#55636a; --color-line:#e2ddd0;
--color-teal:#0e6e64; --color-teal-deep:#0a4f48; --color-teal-soft:#e6f0ee; --color-teal-50:#f0f7f6;
--color-ochre:#b45309; --color-ochre-soft:#f7ead9; --color-danger:#b42318; --color-danger-soft:#fef2f2;
--shadow-card: 0 1px 2px rgba(29,42,43,.06), 0 8px 24px rgba(29,42,43,.06);
--shadow-fab: 0 8px 24px rgba(14,110,100,.35);
--radius-card:12px; --radius-field:10px; --radius-pill:999px;
--font-sans: Tajawal; --font-display:Cairo; --font-brand:Aref Ruqaa;
```

Motion: ruler draw 600ms on enter, card hover 150ms, respect `prefers-reduced-motion`.
A11y: field 16px on mobile, btn min-h 44px, focus-visible ring, label+field pairing.

## Phase 1 — Design System & Shell
- Extend `src/app/globals.css` with tokens, shadows, bottom-nav, FAB, toast, bottom-sheet, safe-area, reduced-motion
- Update `src/app/layout.tsx` to add mobile bottom nav + FAB, sticky header, safe-area footer padding
- Create `src/components/ui.tsx` additions: ToastProvider, BottomSheet, ConfirmDialog
- Add icon system (inline SVG, no extra dep)

## Phase 2 — Dashboard + Prices + New Estimate
- **Dashboard `src/app/page.tsx`:** metrics grid `grid-cols-2` on mobile, icon circles, onboarding progress, list row responsive stack
- **Prices `src/components/price-list-editor.tsx`:** accordion categories, search, card+sheet editing, 44px targets, replace alert/confirm
- **New Estimate `src/components/new-estimate-form.tsx`:** dropzone with camera hint, snap carousel, stepper indicator, sticky CTA, chip helpers

## Phase 3 — Estimate Editor (Critical Mobile Fix)
- `src/components/estimate-editor.tsx`: dual rendering — desktop grid (`min-w-[680px]` kept ≥768px), mobile cards (`<768px` hidden/md:block). Cards have qty stepper [- +], unit/price fields 16px, auto-save debounce, swipe delete, sticky total bar. Unmatched warning becomes actionable.

## Phase 4 — Quote
- `src/components/quote-actions.tsx` + `src/app/estimates/[id]/quote/page.tsx`: hierarchy — primary WhatsApp full-width mobile, secondary row 3 ghosts, toast on copy, QR optional, print CSS unchanged

## Verification Checklist
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass
- [ ] Manual viewport QA: 360, 390, 768, 1024 (Chrome devtools)
- [ ] Touch targets ≥44px, no iOS zoom (field 16px), focus-visible, reduced-motion
- [ ] RTL digits remain `.tnum` isolated, no bidi flip

## Out of Scope (UI-only)
No logic/DB/auth changes. All `src/actions/*` signatures unchanged. Only presentation layer.
