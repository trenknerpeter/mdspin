# Pricing Page Design

## Context

MDSpin is currently free with usage limits (3 spins/day for guests, 20/day for signed-in users). There is no paid tier yet, but a Pro plan (1,000 spins/month) is being considered for the future. The site has an existing Stripe "buy me coffee" tip jar integration that currently appears after a successful conversion and in the footer.

The goal is to add a `/pricing` page to the top navigation (between Use Cases and Resources) that:
1. Transparently communicates the free tier and its limits
2. Promotes the tip jar as a way to support the project
3. Teases the upcoming Pro plan
4. Includes a personal maker message

## Page Structure

### Navigation Placement

Add "Pricing" as a direct link (not a dropdown) in the top nav between Use Cases and Resources:

```
Product (dropdown) → Use Cases → Pricing → Resources (dropdown) → Try It
```

Also add a "Pricing" link to the footer's Product or Resources column.

Update both desktop and mobile nav in `components/site-nav.tsx`, and the footer in `components/site-footer.tsx`.

### Page Layout

Follow the existing page pattern used by `/use-cases`, `/overview`, etc.:
- Server component with `Metadata` export for SEO
- Uses `SiteNav`, `SiteFooter`, `GrainOverlay` components
- Dark theme: `bg-[#0C0C0C]`, `text-[#F0EDE8]`, accent `#FF4800`
- Container: `max-w-5xl` (wider than content pages to fit 3 cards side-by-side)
- Spacing: `pt-32 pb-24`
- JSON-LD structured data (WebPage + BreadcrumbList)

### Section 1: Page Header

- **Headline:** "Simple, transparent pricing"
- **Subheadline:** "MDSpin is free to use. No credit card required, no hidden fees."
- Centered text, consistent with other page headers

### Section 2: Three Pricing Cards

Responsive grid: 3 columns on desktop (`md:grid-cols-3`), stacked on mobile. Cards use the same dark card style as the rest of the site (`border-[#2A2A2A]`, `bg-[#161616]` or similar).

#### Card 1: Free

- **Badge:** "Current plan" — small pill with accent color background
- **Price:** $0 /month
- **Subtitle:** "Free forever"
- **Feature list** (with checkmark icons):
  - 3 conversions per day (guest)
  - 20 conversions per day (signed in)
  - PDF, DOCX, PPTX support
  - AI-ready Markdown output
- **CTA button:** "Get started" → links to `/#converter`
- Style: Standard card, solid border

#### Card 2: Support

- **Visual emphasis:** Slightly elevated appearance — subtle accent border or glow to draw attention
- **Icon/emoji:** Coffee emoji or small icon
- **Price:** $2.99 — one-time
- **Subtitle:** "Buy me a coffee"
- **Personal message** (2-3 lines): A short note from the maker about why MDSpin is free and what tips help with (server costs, continued development, keeping the tool accessible)
- **CTA button:** Reuse the existing `<BuyCoffee />` component from `components/buy-coffee.tsx` — styled larger/more prominent for this context (or wrap it with additional styling)
- Style: Highlighted card with accent border

#### Card 3: Pro (Coming Soon)

- **Badge:** "Coming soon" — muted pill (gray/dimmed)
- **Price:** TBD /month
- **Subtitle:** "For power users"
- **Feature list** (dimmed/lower opacity):
  - 1,000 conversions per month
  - Priority processing
  - (placeholder for future features)
- **CTA:** Disabled button saying "Coming soon" or "Notify me" (optionally wired to the existing `/api/waitlist` endpoint to collect emails)
- Style: Lower opacity (0.5-0.6), muted borders, grayed out to signal unavailability

### Section 3: FAQ

Below the cards, a simple Q&A section. Not an accordion — just stacked question/answer blocks to keep it simple and match the minimal page style.

**Questions:**

1. **"Is MDSpin really free?"**
   Yes — MDSpin is completely free. Guests get 3 conversions per day, and signed-in users get 20 per day. No credit card, no trial, no hidden fees.

2. **"Why the daily limit?"**
   To keep the service running smoothly for everyone. If you need more capacity, a Pro plan with higher limits is coming soon.

3. **"What does 'Buy me a coffee' do?"**
   It's a one-time tip to support MDSpin's development. You won't get extra features — it's simply a way to say thanks and help keep the project going.

4. **"When is the Pro plan launching?"**
   We're working on it. Stay tuned for updates.

### Section 4: Footer

Standard `<SiteFooter />` — no changes to footer content beyond adding the Pricing link.

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `app/pricing/page.tsx` — New pricing page |
| Modify | `components/site-nav.tsx` — Add Pricing link in desktop nav + mobile nav |
| Modify | `components/site-footer.tsx` — Add Pricing link to footer |

## Components to Reuse

- `<SiteNav />` from `components/site-nav.tsx`
- `<SiteFooter />` from `components/site-footer.tsx`
- `<GrainOverlay />` from `components/grain-overlay.tsx`
- `<BuyCoffee />` from `components/buy-coffee.tsx` (for the Support card CTA)
- SEO constants from `lib/seo.ts` (`SITE_URL`, `SITE_NAME`)
- Page layout pattern from `app/use-cases/page.tsx`

## SEO

- **Title:** "Pricing — Free Document to Markdown Conversion | MDSpin"
- **Description:** "MDSpin is free to use with generous daily limits. See what's included, support the project, and learn about upcoming Pro features."
- **Canonical:** `https://mdspin.app/pricing`
- **JSON-LD:** WebPage schema + BreadcrumbList (Home → Pricing)
- **OpenGraph:** Title, description, URL matching above

## Design Notes

- The `<BuyCoffee />` component is a client component (`"use client"`). Since the pricing page is a server component (for metadata), the BuyCoffee import will work fine as a client island within the server page.
- The personal maker message on the Support card should be hardcoded directly in the page — no need for a separate component or CMS.
- The "Coming soon" card's Notify Me functionality is optional. A simple disabled button is the minimum; wiring to `/api/waitlist` is a nice-to-have.
- Card widths should be equal. On mobile, stack vertically in Free → Support → Pro order for narrative consistency.
