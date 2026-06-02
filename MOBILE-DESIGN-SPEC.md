# Ledger — Mobile Responsive Spec (2026-06)

Branch: `ledger-iteration-2026-06`. Goal: make every page usable on a phone (~390px)
**without changing the desktop look at all.**

## The one inviolable rule: desktop must render pixel-identical

Tailwind is mobile-first. Today's classes are *unprefixed*, so they currently apply at
**every** width — that is exactly why mobile is broken (240px sidebar pinned, grids of 5
cards, tables overflowing).

To fix mobile while freezing desktop, rewrite each class string as:

```
<mobile-base>  lg:<today's-desktop-value>
```

- Author the NEW mobile style as the unprefixed base.
- Re-pin TODAY'S EXACT value at `lg:` (and `sm:`/`md:` only where noted).
- Never remove a desktop value — move it behind `lg:`.

Example: `px-12 py-10` → `px-4 py-6 lg:px-12 lg:py-10`.
Example: `grid-cols-5` → `grid-cols-2 lg:grid-cols-5`.

**Breakpoint for the shell switch = `lg` (1024px).** Below `lg` = mobile shell. At/above
`lg` = today's sidebar layout, untouched. (Tablets in portrait get the mobile shell — fine.)

### Verification gate (every page, every chunk)
Screenshot at **1280px** and **390px**, before and after.
- 1280px after == 1280px before (pixel-identical). Any desktop drift = bug, fix before merge.
- 390px after: no horizontal page overflow, no clipped numbers, all actions reachable.

---

## 1. App shell & navigation — `App.tsx`

Desktop (`lg+`): unchanged. Sidebar `aside` stays exactly as today.

Mobile (`<lg`):
- Hide the `aside` (`hidden lg:flex`).
- Add a **sticky top bar** (`lg:hidden`), height 56px, `bg-base`, bottom border `--border-faint`,
  containing: hamburger button (left, 44px tap), "Ledger" wordmark (display serif, ~20px),
  and on the right the live clock + settings gear (reuse `MyClock` + the gear `NavLink`).
- **Drawer**: hamburger toggles a left slide-in panel (width ~260px) over a dimmed scrim
  (`bg-black/60`). The drawer body is the EXISTING nav markup (`NavGroup`/`NavItem`) reused
  verbatim — do not fork the nav. Tapping a nav item, the scrim, or Escape closes it.
  Animate with a transform transition (`-translate-x-full` → `translate-x-0`).
- Lock body scroll while the drawer is open.
- Main content container: `px-4 py-6 lg:px-12 lg:py-10`. Keep `max-w-[1280px] mx-auto`.

State: local `useState` for drawer open/close in `AppShell`. Close on route change
(`useLocation`).

---

## 2. Page chrome — `components/ui.tsx`

`PageIntro`:
- header: `flex-col gap-4 mb-6  lg:flex-row lg:items-start lg:justify-between lg:gap-6 lg:mb-10`
- title `h1`: `text-[28px] lg:text-[36px]`
- action wrapper stays; on mobile it sits below the title (full natural width, left-aligned).

`SectionHeading`: keep, but allow it to wrap: `flex-wrap gap-2`.

`StatCard`:
- value `text-[24px] lg:text-[28px]` (prevents clipping in 2-col mobile grids).
- padding `p-4 lg:p-5`.

Hero/oversized numbers (e.g. Dashboard NET PROFIT, currently very large) must shrink on
mobile so they never clip — cap around `text-[40px]` on mobile, today's size at `lg:`.

---

## 3. Stat-card grids (responsive prefixes only)

- `grid-cols-5` → `grid-cols-2 lg:grid-cols-5`
- `grid-cols-4` → `grid-cols-2 lg:grid-cols-4`
- `grid-cols-3` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- `grid-cols-2` → `grid-cols-1 lg:grid-cols-2` (forms/cards) — keep 2-up only if the cells are
  tiny stat tiles, then `grid-cols-2`.

Keep existing `gap-*`.

---

## 4. Tables → mobile card lists (the real work)

Every data `<table>` lives inside a wrapper today. The pattern:

```tsx
{/* Desktop table */}
<div className="hidden lg:block overflow-x-auto"> <table> … </table> </div>

{/* Mobile cards */}
<ul className="lg:hidden flex flex-col gap-2">
  {rows.map(r => (
    <li key={r.id} className="rounded-lg p-4 ..."  /* same surface tokens as AppCard */>
      {/* primary line: title + status/amount */}
      {/* secondary lines: label/value pairs from the meaningful columns */}
      {/* inline row action (e.g. Mark paid) as a real 44px button */}
    </li>
  ))}
</ul>
```

Rules:
- The mobile card surfaces the SAME data the table row shows — don't drop columns silently.
  Pick a primary line (the thing you scan for) and stack the rest as label/value pairs.
- Preserve every row action (mark-paid, edit, open) as a ≥44px tap target.
- Keep status colors/badges (`StatusBadge`, overdue amber row state) on the card.
- Row tap navigates where the table row did (e.g. project/client → detail).

Apply card-list conversion to:
- **Projects** list (`Projects.tsx`)
- **Costs** subscriptions / one-time / investments tables (`Costs.tsx`)
- **Clients** list (`Clients.tsx`)
- **ProjectDetail** milestones table (`ProjectDetail.tsx`) — keep mark-paid quick action

Keep as edge-bleed horizontal scroll (NOT cards) — dense matrices where scanning across is
the point. Wrap in `-mx-4 px-4 lg:mx-0 lg:px-0 overflow-x-auto`:
- **Monthly P&L** breakdown matrix (`Monthly.tsx`)
- **Settings** exchange-rate / platform reference tables (`Settings.tsx`)

---

## 5. Forms & modals — `components/Modal.tsx` + page forms  (CONFIRMED round 2)

`Modal` — **full-screen on mobile** (chosen over bottom-sheet):
- Mobile (`<lg`): the panel covers the whole viewport. Outer wrapper `p-0 lg:p-4`. Panel
  `h-full w-full max-w-none rounded-none  lg:h-auto lg:w-full lg:max-w-* lg:rounded-lg`.
  Layout as a flex column: header (`shrink-0`, flush at top, title + × close), body
  (`flex-1 overflow-y-auto`). On desktop (`lg`) it is EXACTLY as today: centered, `items-center`,
  `max-w-*`, `max-h-[70vh]` body scroll, rounded.
- **Sticky action bar on mobile**: the form's existing Cancel/Submit button row (the
  `flex justify-end gap-* ` row at the end of each form) gets, on mobile only,
  `sticky bottom-0 -mx-6 px-6 py-4 border-t border-[--border-faint] bg-[--bg-elevated]` so it
  pins to the bottom of the full-screen sheet; reset all of that at `lg:` so desktop is unchanged.
- Backdrop/scrim unchanged on desktop.

Form field grids inside modals/pages: collapse on mobile. `grid-cols-3` → `grid-cols-2 lg:grid-cols-3`
(or `grid-cols-1` where two-up is still too tight, e.g. selects with long labels); `grid-cols-2`
→ `grid-cols-1 lg:grid-cols-2`. Inputs already `w-full`. The goal: no clipped labels, no tiny
squished selects/date inputs on a phone.

**Clients page parity (CONFIRMED):** `Clients.tsx` currently renders its Add-Client form
(around line 87, gated by `showForm`) and the client-detail Edit form (around line 236, gated by
`editing`) INLINE, which pushes the page down. Convert BOTH to use the `Modal` component, matching
the exact shape Projects/Costs/ProjectDetail already use (Modal + form + Cancel/Submit footer row).
Keep the same fields, validation, and submit handlers — only the presentation moves into a Modal.

---

> §4 table treatment CONFIRMED round 2: **summary cards** (the card-list pattern above), not
> horizontal scroll, for Projects / Clients / Costs / ProjectDetail-milestones.

## 7. PWA — installable as a mobile app  (CONFIRMED round 2)

Make the app installable to a phone home screen. Prod is HTTPS (Traefik) so install criteria are met.
- Use `vite-plugin-pwa` (registerType `autoUpdate`, generateSW/Workbox default precache of the built
  assets — this is an offline-capable SPA shell; API calls stay network-first / not precached).
- Web app manifest: `name "Freelance Ledger"`, `short_name "Ledger"`, `display "standalone"`,
  `background_color "#0c0d11"`, `theme_color "#0c0d11"` (matches `--bg-base`), `start_url "/"`,
  `scope "/"`, orientation `portrait`.
- Icons: a Ledger app icon — serif "L" mark, `--bg-base` field, `--accent` (#6ba299) glyph. Provide
  192×192 and 512×512 PNGs plus a 512×512 **maskable** variant (safe-zone padding). hrolbot will
  generate/commit the source icon PNGs into `frontend/public/`; the build wires them into the manifest.
- Add the `theme-color` meta + apple-touch-icon + manifest link to `frontend/index.html`.
- Verify the production `vite build` emits `manifest.webmanifest` + `sw.js` and the manifest lists the
  icons. (Local dev over http won't actually install — that's expected; prod HTTPS will.)

## 6. Touch & misc
- Interactive list rows and icon buttons: ≥44px tap height on mobile.
- Year nav `‹ 2026 ›` arrows: 44px tap targets on mobile; keep compact on desktop.
- Any `overflow-x-auto` scroller on mobile gets `-mx-4 px-4` edge bleed so content reaches
  the screen edges cleanly, reset at `lg:`.

---

## Execution order (chunks, all on this branch)

1. **Foundation** — DONE (merged 55b11ef): shell, page padding, PageIntro/StatCard/Modal base.
2. **Modal full-screen on mobile** (`Modal.tsx`, §5) — shared; land before per-page form work.
3. **PWA** (§7) — independent files (vite.config, index.html, public/, package.json); parallel-safe.
4. **Projects** — table→cards, stat/form grids responsive, sticky mobile footer.
5. **ProjectDetail** — grid-cols-5→2, milestones table→cards, hero number cap, form grids.
6. **Costs + Clients** — 3 cost tables→cards + grid-cols-4; Clients table→cards + grid-cols +
   inline-forms→Modal; form grids; sticky footers.
7. **Dashboard + Monthly + Settings** — hero number, grid-cols-3 responsive, Monthly matrix +
   Settings tables as edge-bleed horizontal scroll.

Chunks 4–7 each touch distinct page files, so they can run in parallel (frontend max_parallel 3),
but each merges + verifies independently. Workers run **Codex single-dispatch** (the Sonnet frontend
worker has a stale-cred dispatch failure to fix separately).

Each chunk: build → screenshot 1280 + 390 before/after → desktop pixel-identical, mobile clean →
Hrolgar eyeballs at http://10.69.1.100:5179 → next chunk. Nothing to `main` until the whole
set is done and approved.
