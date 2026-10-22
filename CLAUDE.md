# Build Prompt: MARCIS Frontend (Next.js + Tailwind)

## 1. Role and goal

You are a senior frontend engineer and product designer. Build the **complete web frontend** of **MARCIS (Market Administration, Revenue, Collection & Inventory System)**, a market management and revenue collection system for a Philippine municipality's **public market and seafood market**.

The first deployment is for the **Municipality of Pontevedra, Capiz**, a coastal fisheries town. The users are the **Municipal Treasurer's Office**, the **Market Supervisor**, the **Mayor's Office**, and the **Sangguniang Bayan** (read-only). All LGU branding, markets, sections and fee rules must come from config, so the product can be reused for other LGUs.

**Frontend only.** There is no backend yet. Use typed mock data behind an API service layer so a real REST API (Laravel) can be swapped in later without touching UI components.

**Not in this build:** the collectors' **Android app** (a separate React Native project). This web app shows what collectors record, their sync status and their devices, but collectors do not use it to collect.

The result must feel like a **trustworthy financial system for local government**: precise, calm, easy to scan, and clearly about money and accountability. Every peso must be easy to trace.

---

## 2. Tech stack

- **Next.js** (latest stable, App Router, TypeScript, `src/` directory)
- **Tailwind CSS** (latest stable) with design tokens as CSS variables
- **shadcn/ui** (Radix primitives), restyled to the MARCIS design system below
- **lucide-react** for icons
- **TanStack Query** for data fetching and caching against the mock API
- **TanStack Table** for data tables (sorting, filtering, pagination, column visibility, row selection)
- **react-hook-form + zod** for all forms and validation
- **Recharts** for charts
- **date-fns** and **date-fns-tz** for dates (`Asia/Manila`)
- **next-themes** for light/dark mode
- **cmdk** for the command palette

Do not add a backend, database, real authentication, real SMS or real payments.

---

## 3. Design system: the "Coastal Treasury" look

### 3.1 Mood

- A municipal treasury ledger meets a well-run coastal market at dawn.
- Calm, deep sea colors for structure; a warm sunrise amber for highlights; clear green and red only for money that balances or does not.
- Numbers are the hero: large, aligned, tabular figures; every amount easy to compare down a column.
- Clean lines, generous whitespace, no clutter. Documents (statements of account, collection reports) look like official forms.
- No playful illustrations, no heavy gradients, no glassmorphism, no emoji, no stock photos of fish.

### 3.2 Color tokens (light mode)

| Token | Hex | Use |
|---|---|---|
| `--background` | `#F3F6F5` | App background (sea-salt) |
| `--surface` | `#FFFFFF` | Cards, tables, panels |
| `--surface-muted` | `#E9F0EE` | Table headers, subtle panels |
| `--border` | `#D6E0DD` | Hairlines and dividers |
| `--ink` | `#12201E` | Primary text |
| `--ink-muted` | `#55635F` | Secondary text |
| `--primary` | `#0E5E63` | Deep sea teal: primary buttons, active nav, links |
| `--primary-hover` | `#0B4B4F` | Hover state |
| `--sidebar` | `#0A2A2D` | Sidebar background (harbor at night) |
| `--accent` | `#D4893A` | Sunrise amber: key highlights, today markers, selected stall (use sparingly) |
| `--accent-soft` | `#F7E7D3` | Soft amber backgrounds |
| `--money-in` | `#23784A` | Balanced, collected, paid |
| `--money-short` | `#B83227` | Shortage, overdue, variance |
| `--focus` | `#1F7A8C` | Focus rings |

Provide a matching **dark mode** (deep harbor background around `#081B1D`, surfaces around `#0F2629`, text `#E4ECEA`, amber slightly brightened). All text must meet WCAG AA contrast in both modes.

### 3.3 Status colors (used consistently everywhere)

**Stalls**

| Status | Color | Hex |
|---|---|---|
| Occupied | Teal | `#0E5E63` |
| Vacant | Slate (outlined, not filled) | `#64748B` |
| Reserved | Indigo | `#4C51BF` |
| Under repair | Amber | `#B7791F` |
| Lease expiring (within 30 days) | Amber dot on the stall | `#D4893A` |
| In arrears | Red dot on the stall | `#B83227` |

**Collections and reconciliation**

| Status | Color | Hex |
|---|---|---|
| Pending sync | Slate | `#64748B` |
| Synced | Blue | `#2B6CB0` |
| Reconciled | Green | `#23784A` |
| Variance / shortage | Red | `#B83227` |
| Corrected | Amber | `#B7791F` |

Status badges: small, rounded-md, soft tinted background, solid dot and label in the status color. Never rely on color alone; always show the label (stall map tiles also show a small icon or letter for status).

### 3.4 Typography

- **Headings:** **Plus Jakarta Sans** (semibold), via `next/font`.
- **UI text:** **Public Sans**.
- **Amounts, receipt and ticket serial numbers, stall codes:** **IBM Plex Mono**, with `font-variant-numeric: tabular-nums`. Amounts are always right-aligned in tables.
- Scale: page title 28px, section title 20px, body 15px, table text 14px, captions 12–13px. KPI figures 32–36px.

### 3.5 Visual motifs

- **Stall map:** a clean, schematic floor plan of each market, drawn as an SVG grid of stall tiles grouped by section. It is the signature screen of the product.
- Header lockup: "Republic of the Philippines · Province of Capiz" (small caps, muted) above "Municipal Treasurer's Office · Pontevedra Public Market" (heading font).
- A thin teal rule under page titles.
- **Ledger tables:** zebra striping off; thin row dividers; running totals in a sticky footer row.
- **Official documents** (statement of account, demand notice, daily collection report): white page on sea-salt background, centered, max-width ~800px, LGU header block with seal, form-like layout, signature blocks.
- Subtle: 1px borders, rounded-lg cards, very soft shadows only on overlays.

### 3.6 Family resemblance with ORDINA

MARCIS is a sister product of **ORDINA** (the legislative system by the same developer). Keep the same structure so code can be shared later:
- Same app-shell layout (left sidebar, top bar, breadcrumbs, command palette, user menu, role switcher).
- Same component names and APIs: `PageHeader`, `StatusBadge`, `DataTable`, `KpiCard`, `ChartCard`, `DocumentPage`, `RoleGate`, `EmptyState`.
- Same LGU config pattern (`src/config/lgu.ts`).
- Different palette and fonts (above), so each product has its own identity.

### 3.7 Layout

- **Staff app:** fixed left sidebar (harbor navy) with grouped navigation, top bar with breadcrumbs, a **market switcher** (All markets / Public Market / Seafood Market), a **date context** control (Today / a chosen day), global search (Cmd/Ctrl+K), notifications bell, theme toggle, and user menu with name and role.
- Content max-width ~1360px (wider than usual for ledgers), 24–32px page padding.
- Fully responsive: desktop first, usable on tablet and phone (sidebar becomes a drawer; tables become stacked cards; the stall map pans and zooms).

---

## 4. Users and roles

Implement role-aware UI (hide or disable actions per role). Add a **dev-only role switcher** in the user menu for demos.

| Role | Can do |
|---|---|
| **Municipal Treasurer** | Everything financial: view all, reconcile, approve corrections, close days, run billing, issue demand notices, reports |
| **Treasury Staff** | Reconcile, record remittances, manage accountable forms, prepare statements and notices (not close days or approve corrections) |
| **Market Supervisor** | Stalls, lessees, leases, collectors and assignments, view collections, request corrections, send SMS reminders |
| **Mayor's Office** | Read-only dashboards and reports |
| **Sangguniang Bayan** | Read-only summary reports (collections, occupancy, arrears) |
| **Administrator** | Users and roles, markets and sections, fee schedule, accountable form types, SMS settings, branding, audit log |

Collectors appear as **records** (people with devices and assignments), not as web users.

---

## 5. Routes and screens

### 5.1 Authentication (mock)

- `/login`: email + password, "Remember me," forgot password. Split layout: left panel in harbor navy with the LGU seal, "Pontevedra Public Market & Seafood Market," and "MARCIS" wordmark; right panel with the form.
- `/login/verify`: two-factor code (6-digit) for Treasurer and Administrator.
- `/forgot-password`: mock success state.

### 5.2 Dashboard: `/app`

Content adapts to role. For Treasurer and Market Supervisor:
- Greeting with date and role; market switcher applies to everything.
- **KPI row:** Collected today (vs. same weekday last week), Collected this month (vs. target), Occupancy rate, Total arrears, Open variances.
- **Today by collector:** table of each collector with assigned section, collections count, amount, last sync time (amber if over 2 hours ago), remitted, variance.
- **Collections by section** (bar chart) and **last 30 days trend** (line chart).
- **Arrears aging** summary (Current, 1–30, 31–60, 61–90, Over 90 days).
- **Leases expiring in the next 30 days** list.
- **Alerts:** unsynced devices, unreconciled days, skipped receipt serials, vacant stalls over 60 days.

For Mayor's Office and SB: a summary view with KPIs, monthly trend, collections by section, occupancy and arrears; no action buttons.

### 5.3 Stall map: `/app/stalls`

- **Map view (default):** one floor plan per market, sections labeled (Fish, Meat, Vegetables, Dry Goods, Eateries, Others). Each tile shows the stall code and is colored by status, with dots for expiring lease and arrears.
- Hover: stall code, lessee, monthly rate, balance. Click: opens a **side panel** with stall details, current lessee, lease dates, rate, balance, last 5 payments, and actions (View stall, New lease if vacant, Send reminder, Record stall status).
- Filters: status, section, in arrears, expiring lease. Legend always visible.
- Zoom and pan; keyboard navigation between tiles (arrow keys); each tile has an accessible label.
- **List view** toggle: table with stall code, market, section, size, status, lessee, monthly rate, balance, lease end.
- **Stall detail** `/app/stalls/[id]`: overview, lease history, full payment ledger with running balance, arrears, status history, documents.

### 5.4 Lessees: `/app/lessees`

- Table: name, stalls held, contact (masked except for authorized roles), balance, oldest unpaid month, lease status, SMS opt-in.
- **Lessee detail** `/app/lessees/[id]`: profile, stalls and leases, **statement of account** (charges, payments, penalties, running balance), notices sent, SMS history, documents.
- Create and edit lessee (form with validation; consent checkbox for SMS reminders).

### 5.5 Leases: `/app/leases`

- Tabs: Active, Expiring (next 30/60/90 days), Expired, Terminated.
- **New lease wizard** `/app/leases/new` (4 steps): 1) choose a vacant stall (mini map); 2) choose or create the lessee; 3) terms: start date, term length, monthly rate (pre-filled from the fee schedule, with the ordinance reference shown), deposit, special conditions; 4) review and generate the **lease contract preview** (official document style, printable).
- Renewal and termination flows with reason and effective date.

### 5.6 Collections ledger: `/app/collections`

- A ledger of every collection recorded by collectors: date and time, collector, market, section, stall or transient vendor, type (`daily_fee`, `monthly_rental`, `transient_fee`, `penalty`, `other`), **official receipt or cash ticket serial** (mono), amount, recorded offline at, synced at, status.
- Filters: date range, collector, market, section, type, status, serial range; quick filters for "Today," "Unsynced," "Variance," "Corrected."
- Sticky footer with totals for the filtered rows, by type.
- **Corrections are append-only:** a "Request correction" action creates a linked correcting entry with a required reason. Treasurer approves or rejects. The original row is never edited or deleted; show both, linked, with a "Corrected" badge.
- Every collection row and detail drawer shows the note: "Recorded against the Municipality's official receipt or cash ticket. MARCIS does not issue official receipts."
- **Transient vendors** `/app/collections/transient`: daily list of transient sellers and fees by day, for the seafood market especially.

### 5.7 Remittance and reconciliation: `/app/reconciliation`

- **Daily reconciliation board:** for a chosen day, one row per collector with: collections recorded, amount collected, amount remitted to the Treasury, variance, accountable form serials issued vs. used, skipped or duplicate serials, status (Open, Balanced, Shortage, Overage, Closed).
- Row detail: list of collections, serials used in order (gaps highlighted), remittance entries, notes.
- Actions by role: **Record remittance** (Treasury Staff), **Mark balanced** (when variance is zero), **Flag shortage** with explanation, **Close day** (Treasurer; locks the day; reopening needs a reason and is audited).
- **Report of Collections preview:** a printable daily report per collector in official document style. Keep the form title and layout configurable, since each LGU's Treasurer may use a specific COA format.
- Calendar strip at the top showing each day of the month as Closed, Open or With variance.

### 5.8 Accountable forms: `/app/accountable-forms`

- Registry of receipt and cash ticket series: form type, series start and end, issued to (collector), issued on, used count, remaining, last serial used, status.
- **Issue series** to a collector (form), **return** unused, **report missing** (with reason).
- Alerts for gaps, out-of-order use and duplicates.
- Printable **accountability summary** per collector and month.

### 5.9 Billing and arrears: `/app/billing`

- **Monthly billing run:** choose month, preview charges per lease (rental plus penalties per the fee schedule), then generate (mock). Show a confirmation dialog with totals.
- **Arrears aging** table and stacked bar chart by section: Current, 1–30, 31–60, 61–90, Over 90 days; filter by market and section.
- **Statements of account:** select lessees (single or bulk), preview in official document style ("This is not an official receipt."), print.
- **Demand notices:** generate First, Second and Final notices for overdue accounts, track date issued and response, printable in official style.
- **Penalty settings** reference panel showing the current rate and its ordinance basis (read-only here; edited in Settings).

### 5.10 Messages (SMS reminders): `/app/messages`

- **Send reminders:** choose recipients (overdue lessees, leases expiring, a section, or selected lessees), choose a template, preview with merge fields, schedule or send now (mock).
- **Log:** recipient, template, sent at, status (Queued, Sent, Failed), cost units.
- **Usage meter:** SMS used vs. the yearly allowance (default 5,000), with a warning at 80%.
- Only lessees who consented to SMS appear as recipients.
- If SMS is disabled in settings, show a clear disabled state.

### 5.11 Collectors and devices: `/app/collectors`

- Cards or table: name, assigned market and sections, device model, app version, last sync, unsynced entries count, today's total, status (Active, Suspended).
- Collector detail: assignments (editable by Market Supervisor), accountable forms held, daily totals for the month, variance history, device history.
- Actions: assign sections, suspend collector, **deactivate device** (for lost phones; shows a confirmation explaining unsynced data risk).

### 5.12 Reports: `/app/reports`

- **Daily collection report** (by collector and type)
- **Monthly collections by section and market**
- **Collector performance** (collections, variances, average sync delay)
- **Occupancy and vacancy** (rate over time; vacant stalls and days vacant)
- **Arrears aging**
- **Yearly income trend** (12 months, year over year)
- **Summary for the Sangguniang Bayan** (collections, occupancy, arrears) for fee reviews
- Each report: filters, chart where it helps, table, print preview in official style, export (mock CSV/XLSX/PDF).

### 5.13 Notifications: `/app/notifications`

- Grouped by Today / Earlier: variance found, device not synced, day not closed, lease expiring, billing run complete, SMS failures. Mark as read / mark all as read.

### 5.14 Settings (Administrator, some sections Treasurer): `/app/settings`

- **Users and roles:** table, invite (modal), change role, deactivate.
- **Markets, sections and stalls:** list markets; per market, sections; per section, stalls (code, size, type, grid position). A simple **grid editor** to place stalls on the map.
- **Fee schedule:** rates by market, section and stall type (monthly rental, daily fee, transient fee), penalty rate and rules, **ordinance reference** for each rate, effective dates and rate history. Changing a rate creates a new version; past charges keep the old rate.
- **Accountable form types:** names, prefixes, serial lengths.
- **SMS:** enable/disable, sender name, templates, yearly allowance.
- **Digital payments (Phase 2):** shown as a disabled section, "Available in Phase 2."
- **Branding:** LGU name, province, market names, seal upload (preview).
- **Audit log:** searchable table of all actions (who, what, when, before/after).
- **System status:** last backup, storage used, devices online (display only, mock).

---

## 6. Shared components to build

- App shell (sidebar, top bar with market switcher and date context, breadcrumbs, mobile drawer)
- Command palette (Cmd/Ctrl+K): jump to pages, find stall by code, lessee by name, collection by serial number
- `StatusBadge`, `Amount` (peso format, tabular, right-aligned, red for negative), `SerialNumber` (mono), `StallCode`
- `StallMap` (SVG floor plan, accessible tiles, legend, zoom/pan) and `StallTile`
- `DataTable` (TanStack wrapper: filters, sorting, pagination, column toggle, row selection, sticky totals footer, responsive card mode, empty state)
- `KpiCard` (value, delta vs. comparison period, sparkline), `ChartCard`, `AgingBar`
- `LedgerTable` (running balance column)
- `ReconciliationRow` (expected vs. remitted vs. variance, serial gaps)
- `DocumentPage` (official form styling: LGU header, seal, title, body, signature blocks, "Not an official receipt" footer where relevant)
- `SyncIndicator` (last sync time, unsynced count, stale warning)
- `RoleGate`, `PageHeader`, `EmptyState`, dialogs, sheets, toasts, confirm dialogs, skeleton loaders

---

## 7. Data layer

### 7.1 Types (in `src/types`)

Define complete TypeScript types, at minimum:

- `Market`, `Section`, `Stall` (code, marketId, sectionId, sizeSqm, type, status, grid position, currentLeaseId)
- `Lessee` (name, contact, smsConsent, address)
- `Lease` (stallId, lesseeId, startDate, endDate, monthlyRate, deposit, status, feeScheduleVersionId)
- `FeeSchedule`, `FeeRate` (market, section, stall type, kind, amount, ordinanceRef, effectiveFrom, effectiveTo)
- `Collector`, `Device`, `Assignment`
- `Collection` (id generated on device, collectorId, stallId or transientVendorName, type, amount, receiptSerial, formType, recordedAt, syncedAt, status, correctsCollectionId, correctionReason)
- `Remittance`, `ReconciliationDay` (collectorId, date, expected, remitted, variance, status, closedBy, closedAt)
- `AccountableFormSeries` (formType, start, end, issuedTo, issuedOn, lastUsed, status)
- `Charge` (leaseId, month, kind: rental or penalty, amount), `Payment`
- `StatementLine` (date, description, charge, payment, balance)
- `DemandNotice`, `SmsMessage`, `SmsTemplate`
- `AuditEntry`, `Notification`, `User`, `Role`, `LguConfig`

**Money:** represent amounts as **integer centavos** in all types and mock data; format only for display (`₱1,234.50`). Never use floating-point arithmetic for money.

### 7.2 Mock API (in `src/lib/api`)

- One service per domain (`stalls`, `lessees`, `leases`, `collections`, `reconciliation`, `accountableForms`, `billing`, `messages`, `collectors`, `reports`, `settings`), with an interface per service so a Laravel HTTP implementation can replace the mock by changing one import.
- Simulated latency of 200–600 ms.
- TanStack Query hooks in `src/hooks` (e.g. `useStalls(filters)`, `useReconciliationDay(date)`, `useRecordRemittance()`), with optimistic updates for simple mutations.
- Mutations update in-memory mock state so the demo feels alive (e.g. recording a remittance updates the variance and the dashboard).

### 7.3 Mock data (in `src/lib/mock`)

- **Two markets:** Public Market (about 110 stalls across Meat, Vegetables, Dry Goods, Eateries, Others) and Seafood Market (about 60 stalls, mostly Fish, plus a transient sellers' area).
- About **140 lessees**, **6 collectors** with devices, and **90 days** of collections (daily fees, monthly rentals, transient fees, penalties).
- Realistic but clearly sample amounts (e.g. monthly rentals ₱800 to ₱3,500; daily fees ₱20 to ₱100; transient fees ₱30 to ₱150), with a fee schedule that cites a fictional market ordinance number.
- Include: occupancy around 85%, several vacant stalls (some vacant over 60 days), leases expiring in the next 30 days, accounts in each aging bucket, a few days with shortages and one with an overage, a skipped receipt serial, a duplicate serial attempt, a corrected collection, one collector whose device has not synced for over 2 hours, and failed SMS messages.
- Use **fictional names** for all people; no real names.
- No lorem ipsum anywhere.

### 7.4 Config

`src/config/lgu.ts` holds: municipality, province, region, Treasurer's office address, seal image path, market names, accountable form types, SMS allowance, and feature flags (`digitalPayments: false`). Floor plans for each market live in `src/config/markets.ts` (sections, stall codes and grid positions).

---

## 8. Quality requirements

- **Accessibility:** WCAG 2.1 AA, full keyboard navigation (including the stall map), visible focus rings, ARIA labels on icon buttons, proper heading order, reduced-motion support, and color never the only signal.
- **Responsiveness:** test layouts at 375px, 768px, 1024px, 1440px.
- **States:** every list and page has loading (skeletons), empty and error states.
- **Numbers:** one money formatter (`₱1,234.50`), tabular figures, right-aligned amounts, negative amounts in red with a minus sign, totals that always equal the sum of the rows shown.
- **Dates:** one format (`MMM d, yyyy`; times `h:mm a`), all in `Asia/Manila`.
- **Print:** statements of account, demand notices, lease contracts, daily collection reports and accountability summaries print cleanly as official documents.
- **i18n-ready:** UI strings in one dictionary file (English now; Filipino and Hiligaynon later).
- **Code quality:** strict TypeScript, no `any`, small reusable components, ESLint passing, no console errors.
- **Performance:** server components where sensible; client components only where interactive; lazy-load charts and the stall map; virtualize long ledgers (over 500 rows).

---

## 9. Folder structure (suggested)

```
src/
  app/
    (auth)/login/ ...
    app/                 # staff app routes (dashboard, stalls, lessees, leases, collections, ...)
    layout.tsx
    globals.css          # design tokens
  components/
    ui/                  # shadcn primitives, restyled
    layout/              # shell, sidebar, topbar, page header
    market/              # stall map, stall tile, sync indicator
    finance/             # amount, ledger table, reconciliation row, aging bar
    documents/           # DocumentPage and templates
    charts/
  config/lgu.ts
  config/markets.ts
  hooks/
  lib/api/               # service interfaces + mock implementations
  lib/mock/              # seed data
  lib/money.ts           # centavos helpers and formatting
  lib/utils.ts
  types/
  i18n/en.ts
```

---

## 10. Build order

Work in this order and keep the app running after each step:

1. Project setup, fonts, design tokens, light/dark theme, LGU and market config, money helpers.
2. App shell, navigation, market switcher, date context, role switcher, command palette.
3. Types, mock data, mock API, query hooks.
4. Stall map and stall detail; lessees; leases and the new lease wizard.
5. Collections ledger, corrections flow, transient vendors.
6. Remittance and reconciliation board; accountable forms registry.
7. Billing run, arrears aging, statements of account, demand notices.
8. Dashboard (all roles).
9. Messages (SMS reminders).
10. Collectors and devices.
11. Reports.
12. Settings, fee schedule, map grid editor, audit log, notifications.
13. Accessibility, responsive, print, and empty/loading/error state pass.

---

## 11. Out of scope

- The collectors' Android app (separate React Native project)
- Real authentication, backend, database or file storage
- Real SMS sending and real payments (Phase 2 shows as disabled)
- Issuing official receipts (MARCIS records receipt serials; it never generates official receipts)
- Real PDF generation (use styled HTML previews and print)

---

## 12. Acceptance checklist

- [ ] Every route in Section 5 exists and renders with mock data
- [ ] The stall map shows both markets, filters by status, works with keyboard, and opens a side panel per stall
- [ ] Collections show receipt or ticket serials; corrections are append-only and linked to the original
- [ ] Reconciliation computes variance per collector per day, highlights serial gaps and duplicates, and supports closing a day
- [ ] Billing run, arrears aging, statements of account and demand notices work end to end with mock data
- [ ] All money uses integer centavos; displayed totals always equal the sum of their rows
- [ ] "MARCIS does not issue official receipts" appears on collection views; statements say "This is not an official receipt"
- [ ] Role switcher visibly changes available actions; Mayor and SB views are read-only
- [ ] SMS reminders respect consent, show usage against the allowance, and show a disabled state when off
- [ ] Light and dark mode both meet AA contrast
- [ ] Works at phone, tablet and desktop widths
- [ ] Official documents print cleanly
- [ ] No lorem ipsum, no real names, no TypeScript errors, no console errors