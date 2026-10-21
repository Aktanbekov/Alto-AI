---
name: Altovisas
description: F-1 interview preparation set in paper and ink, with a security-print signature.
colors:
  paper: "#E7ECE6"
  paper-2: "#F3F6F1"
  page-white: "#FFFFFF"
  ink: "#16233B"
  ink-deep: "#0E1729"
  ink-soft: "#3A4558"
  ink-muted: "#4F5A6C"
  guilloche: "#7C6BA8"
  ok: "#2F6B4F"
  bad: "#A33556"
  rule: "rgba(22, 35, 59, .16)"
  rule-soft: "rgba(22, 35, 59, .08)"
  control: "#7D8796"
  band-ink-soft: "rgba(231, 236, 230, .82)"
  band-ink-muted: "rgba(231, 236, 230, .7)"
  band-ink-rule: "rgba(231, 236, 230, .2)"
  band-ink-rule-soft: "rgba(231, 236, 230, .1)"
  band-ink-paper: "rgba(231, 236, 230, .14)"
  band-ink-paper-2: "rgba(231, 236, 230, .07)"
  band-ink-control: "rgba(231, 236, 230, .5)"
  series-pos: "#24609E"
  series-neg: "#A33556"
  series-alt: "#6E54B5"
  series-none: "#C3CBC6"
  warn: "#6B4A12"
  warn-bg: "#FBF6EA"
  warn-rule: "#E2CF9F"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(36px, 5.8vw, 64px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(26px, 3.4vw, 40px)"
    fontWeight: 600
    lineHeight: 1.18
    letterSpacing: "-.022em"
  headline-decision:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(30px, 4vw, 50px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-.022em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-.014em"
  subtitle:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-.022em"
  lede:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(19px, 2.1vw, 23px)"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  body-reading:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.65
  meta:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "\"tnum\""
  control:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.15
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: ".08em"
  figure:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "64px"
    fontWeight: 600
    lineHeight: 0.82
    letterSpacing: "-.05em"
    fontFeature: "\"tnum\""
  price:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "48px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-.035em"
    fontFeature: "\"tnum\""
  mrz:
    fontFamily: "ui-monospace, SF Mono, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace"
    fontSize: "12px"
    fontWeight: 400
    letterSpacing: ".12em"
rounded:
  hairline: "2px"
  panel: "3px"
  dialog: "4px"
  nav-row: "12px"
spacing:
  page-pad: "28px"
  page-pad-phone: "18px"
  page-max: "1240px"
  reading-column: "760px"
  gap: "20px"
  card: "22px"
  section: "80px"
  section-phone: "52px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.hairline}"
    padding: "16px 26px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.paper}"
  button-primary-on-ink:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.hairline}"
    padding: "16px 26px"
  button-primary-on-ink-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.hairline}"
    padding: "16px 26px"
  button-quiet:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hairline}"
    padding: "14px 18px"
    height: "52px"
  button-oauth:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.hairline}"
    padding: "12px 16px"
    height: "48px"
  input:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.hairline}"
    padding: "10px 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.card}"
  caveat:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.panel}"
    padding: "12px 16px"
  review-card:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
    padding: "30px 0 34px"
  review-avatar:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    size: "44px"
  review-star-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page-white}"
    rounded: "{rounded.hairline}"
    size: "22px"
  review-star-off:
    backgroundColor: "{colors.rule}"
    textColor: "{colors.page-white}"
    rounded: "{rounded.hairline}"
    size: "22px"
  tier-card:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "30px 24px 24px"
  tier-badge:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.hairline}"
    padding: "3px 8px"
  tier-badge-cover:
    backgroundColor: "{colors.ok}"
    textColor: "{colors.page-white}"
  tier-cover:
    backgroundColor: "rgba(47, 107, 79, .07)"
    textColor: "{colors.ok}"
    rounded: "{rounded.hairline}"
    padding: "10px 12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.nav-row}"
    padding: "12px 16px"
  nav-item-hover:
    backgroundColor: "{colors.paper-2}"
  nav-item-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  pill-ok:
    backgroundColor: "rgba(47, 107, 79, .14)"
    textColor: "{colors.ok}"
    typography: "{typography.label}"
    rounded: "{rounded.hairline}"
    padding: "4px 8px"
  pill-bad:
    backgroundColor: "rgba(163, 53, 86, .12)"
    textColor: "{colors.bad}"
    typography: "{typography.label}"
    rounded: "{rounded.hairline}"
    padding: "4px 8px"
  dialog:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "32px 28px 24px"
    width: "420px"
---

# Design System: Altovisas

## Overview

**Creative North Star: "The Consular Document"**

Altovisas is set like the papers an applicant carries to the window: cool green-grey paper, navy ink, hairline rules, and one security-print panel engraved with a guilloche rosette. The system is quiet but not blank. Public pages are set large and dark enough to read comfortably on a laptop and a phone alike, and a long page is broken into bands of paper, white and solid ink so the scroll reads as distinct chapters. The foil panel is still spent once, so the one document-like object on a screen reads as the thing that matters (a sample verdict on the home page, the applicant's own verdict on the report).

Density follows the surface. Public pages under the page typography scope are generous and editorial: large Inter headings that balance across lines, a 17px body, a reading measure of 54 to 68 characters, rules between items instead of cards. Working surfaces (the corpus dashboard, the profile check, the access flow) are tighter and table-like, with the same tokens and only the density changed. Honesty is part of the layout, not an annotation: caveats about the self-reported corpus are bordered panels in the flow, the sample card says "Sample report" where the eye lands, and preview screens carry their own label.

One family does every job. Inter carries display, headings, body and labels; the only other face is the system monospace on the passport machine-readable strip, because that strip is printed in an OCR face in life.

**Key Characteristics:**
- Paper and ink: white page, navy ink, green-grey paper and solid ink bands that alternate down a long page.
- Large, dark public type: 17px body, 18px reading pages, a 13px floor for labels.
- One security-print panel per screen, engraved with the guilloche rosette.
- Hairline geometry: 1px rules, 2 to 4px corners.
- Inter for everything; monospace only on the machine-readable strip.
- Caveats and preview labels are structural parts of the page.
- Near-flat: depth only on the foil panel, the dialog, the mobile drawer and a pressed-button lift.

## Colors

A cool, low-chroma document palette: navy ink on white and green-grey paper, with a muted violet reserved for the engraving and for focus.

### Primary
- **Consular Ink** (ink): every heading and body line, the primary button fill, the 1px heavy rule that opens a report section, a FAQ list or the review list, and the ground of the ink bands. Pressed and hovered primary buttons darken to **Night Ink** (ink-deep).

### Secondary
- **Engraving Violet** (guilloche): the rosette strokes and every focus ring (2px outline, 2px offset; fields use a 3px violet halo at 30%). It never fills a surface or colours text.

### Tertiary
- **Approval Green** (ok) and **Refusal Rose** (bad): verdict words, outcome pills, the "fix" panel and the refusal caveat, each used as text colour or as a 5 to 14% tint behind it. Refusal Rose also sets the sample card's headline figure. Approval Green also marks the pricing check icons, the top tier's cover panel (7% tint, 30% border) and its badge, the one place it fills solid.
- **Chart series** (series-pos, series-neg, series-alt, series-none): blue for approved/positive, rose for refused/negative, violet for 221(g) and other outcomes, grey-green for not stated. These four were run through a colour-blind validator against white and are the only colours charts may use.

### Neutral
- **Page White** (page-white): the ground for every page, every field, the dialog, the caveat panel and the pricing tier cards.
- **Paper** (paper): the paper bands on the home page, the active sidebar row, chart tracks, neutral pills, the review initials tile on white, and the default highlight behind marked words.
- **Paper Light** (paper-2): cards, readouts, the ledger, the scoring panel, hover fill on rows and quiet buttons.
- **Soft Ink** (ink-soft): secondary text, ledes, review quotes, small uppercase labels (8.2:1 on paper).
- **Muted Ink** (ink-muted): the tertiary floor; hints, placeholders, counts, dates, per-interview prices, inert "Soon" rows (6.1:1 on paper). Nothing lighter carries text.
- **Rule** (rule) and **Soft Rule** (rule-soft): borders on cards and panels, the hairlines between list items and readout rows, and the empty tiles of a star rating.
- **Control Edge** (control): the border on inputs, selects, textareas and the OAuth button, at 3:1 so a field edge is visible as a control.

### Ink Band
Inside an ink band the palette tokens are re-pointed rather than each element restyled: ink becomes Page White, and Soft Ink, Muted Ink, the rules, both papers and Control Edge take their band-ink values (Paper at 82%, 70%, 20%, 10%, 14%, 7% and 50% on Consular Ink). Anything that reads those tokens turns light on its own. The primary button is the one element that inverts explicitly (button-primary-on-ink).

### Status
- **Warning** (warn, warn-bg, warn-rule): one message type only - something went partly wrong and the person can still act, such as an account created whose verification email did not send. Text in warn on warn-bg inside a warn-rule border. Never decoration, never a chart series.

### Named Rules
**The Band Rhythm Rule.** A long public page is a sequence of full-width bands, not one white sheet. Bands come in three grounds: paper, white and solid ink. Adjacent bands never share a ground, and ink is reserved for the argument and the close. The home page runs paper (hero and steps), white (stakes), ink (why us), white (the data), paper (reviews), white (pricing), paper (limits), ink (close).

**The Re-Pointed Band Rule.** An ink band changes the tokens, not the components. Never hand-colour text inside an ink band; read the tokens and let the band supply them.

**The Highlight Steps Up Rule.** A paper highlight vanishes on a paper band, so on paper bands marked words and the review initials tiles step up to Page White.

**The Violet Is Engraving Rule.** Engraving Violet appears in the rosette and in focus rings, nowhere else. It is how keyboard focus looks on every surface.

**The Validated Series Rule.** Charts draw only from the four series tokens. A new chart category maps onto one of them or is not drawn.

## Typography

**Display Font:** Inter (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Inter (same stack)
**Label/Mono Font:** Inter for labels; ui-monospace stack (the mrz token) for the passport strip only.

**Character:** One family, set tight at the top and open in the body. Headings are semibold (600) with negative tracking that increases with size and balanced line breaks; body is regular (400) at a generous leading, so the voice stays plain and candid rather than designed.

### Hierarchy
- **Display** (display): the page h1 on public pages. The home hero sets it a step larger (clamp(42px, 4.4vw, 64px) at 1.08); reading pages cap it at clamp(34px, 4.8vw, 52px) and the account gate at clamp(32px, 4.8vw, 50px).
- **Headline** (headline): section h2s on public pages. Reading pages use 24px (21px for FAQ questions); the report's verdict is a larger headline at clamp(30px, 4.6vw, 44px) in ok or bad.
- **Decision Headline** (headline-decision): the h2 of the closing action band, a step above the section headline and capped at 24ch (the shared close band outside the home page sets it at clamp(28px, 3.8vw, 44px)). The pricing heading is the other decision moment; in the build it currently renders at the section headline size, carrying its weight with a second, highlighted line instead.
- **Title** (title): h3s, step and reason headings, pricing tier names, the officer's question on the profile check (19 to 22px).
- **Subtitle** (subtitle): h4s.
- **Lede** (lede): the paragraph under an h1 or a section h2, in Soft Ink, at a 54ch measure.
- **Body** (body): 17px on every public page; review quotes and tier features use it. Reading pages step up to 18px at 1.65 in a 760px column with a 68ch measure (body-reading). The lead review's quote is set larger, clamp(20px, 2vw, 25px) at 1.5.
- **Meta** (meta): supporting lines that follow a heading or an action, in Soft Ink with tabular figures (14.5 to 16px for review places, dates and the pricing trust line).
- **Control** (control): fields, the OAuth button and sidebar rows, 16px.
- **Button** (button): 17px/600; full-width buttons below 560px drop to 16px.
- **Label** (label): small uppercase keys on readouts, tiles, the foil panel, the ledger, pills, tier badges and the sidebar group names. 13px, tracked .06 to .08em, in Soft Ink.
- **Figure** (figure) and **Price** (price): the foil panel's headline number, and the tier price at 48px. Numbers in tiles, the report's meta strip, prices and counts use tabular figures.
- **Machine-readable strip** (mrz): the single monospace line along the bottom of the sample card, 12px, .12em tracking, at 72% ink.

### Named Rules
**The One Family Rule.** Inter sets every role. Do not introduce a display face; hierarchy comes from size, weight and tracking.

**The Monospace Is a Passport Rule.** Monospace exists for the machine-readable strip and nothing else.

**The 13px Floor Rule.** On public pages no text renders below 13px, and body weight is 400, never 300. 12px survives only inside the dense working-surface scope, on the sidebar "Soon" badge and on the passport strip.

**The Balanced Heading Rule.** Every public heading balances its lines (text-wrap: balance); a two-line h2 never leaves a single word on its second line.

## Layout

Two frames share one content width. Public pages use a centred wrapper (page-max, with page-pad gutters that tighten to page-pad-phone below 900px); reading pages narrow to the reading column (760px) plus gutters. The app shell puts a 298px sticky rail on the left, divided from the main column by a single rule; below 900px the rail becomes a right-anchored drawer (min(298px, 86vw)) opened from a 44px menu button in the header, and the brand moves into the header row.

Rhythm: sections breathe at 80px vertically (52px on phones); the home page's argument bands (stakes, why us) run 96px, and the close band 80 to 88px (52 to 60px on phones). Bands are full-bleed; the wrapper sits inside them. Grids are two-up at 30 to 64px gaps and collapse to one column at 900px; the three-cell strip is drawn as cells separated by 1px rule-coloured gaps rather than cards. The home hero is 1.2fr to 1fr and stacks at 1150px. Working surfaces use a 20px gap, auto-fit tile grids (min 168px) and paired charts that stack below 760px. Primary buttons go full width below 560px. Breakpoints in use: 560, 640, 760, 900 and 1150px.

Some components size to their own section rather than the viewport, because the rail takes a different share at every width: pricing is a container, with four tier columns that fall to two at 980px and one at 560px of section width.

Reading pages are one column with headings that lead and rules between items, not cards. FAQ, the report and the review list open with a 1px ink rule and separate items with 1px rules.

## Elevation & Depth

The system is flat and draws depth from tone and rules: white page, Paper Light panels, 1px borders, and the alternating bands. Shadows are reserved for four situations, each tinted with ink rather than black.

### Shadow Vocabulary
- **Foil lift** (`0 1px 0 rgba(255,255,255,.7) inset, 0 14px 34px -22px rgba(22,35,59,.55)`): the security-print panel only, on the home hero and the report header. Dropped in print.
- **Press lift** (`0 10px 20px -12px rgba(22,35,59,.55)`): primary button hover, paired with a 1px rise; removed on active. On an ink band it deepens to Night Ink (`0 10px 20px -12px rgba(14,23,41,.6)`).
- **Dialog** (`0 30px 60px -24px rgba(22,35,59,.5)`): the sign-in dialog over a 45% ink scrim.
- **Drawer** (`-18px 0 40px -24px rgba(22,35,59,.45)`): the open mobile rail.

### Named Rules
**The Flat Page Rule.** Cards, caveats, tiles, readouts, review cards and pricing tiers never cast a shadow. If a surface needs separation, it gets a border, a tint or a band.

## Shapes

Hairline geometry: 1px borders and very small corners. Buttons, inputs, pills, star tiles, tier badges and inline panels use 2px (hairline); cards, caveats, tiles, review initials tiles, pricing tiers and the foil panel use 3px (panel); the dialog and the on-page auth panel use 4px (dialog). Chart bars round only their growing end (4px). Step numbers are circles. The one deliberate exception is the sidebar: its rows keep 12px corners and its "Soon" badge is fully round, taken from the user-supplied "Sunflower" reference. Those are intended; do not normalise them.

Rules do structural work: a 1px ink rule opens a report section, a FAQ list or the review list; 1px rule or soft rule separates items within it; dashed rules mark a "before" state in comparisons.

## Components

### Buttons
Plain, heavy and square-shouldered.
- **Shape:** hairline corners (2px).
- **Primary:** Consular Ink fill, Paper text, button type, at least 48px tall. On the home page it carries a small knocked-out "Free" tag (13px, uppercase, .06em) inside the fill.
- **Hover / Focus:** Night Ink fill or a 1px rise with the press lift (removed on active); disabled drops to 50 to 55% opacity. Focus is the violet ring.
- **On an ink band:** the primary inverts to a white fill with ink text and border; hover fills with Paper and takes the Night Ink press lift; the "Free" tag becomes a 10% ink tint.
- **Ghost:** transparent with ink text and border; hover adds a 5% ink tint.
- **Quiet:** Paper Light with a rule border and ink text; hover fills with Paper, no lift. Used for the non-recommended pricing tiers.
- **OAuth / secondary:** white, Control Edge border, 500 weight; hover fills with Paper Light.
- **Text actions:** underlined ink links with a rule-coloured underline that turns solid on hover, 44px hit area ("Skip" in the survey is one of these and is a real choice).

### Chips
- **Outcome pills:** label type, 2px corners, ok or bad text on a 12 to 14% tint of itself; neutral pills sit on Paper.
- **Preview chip:** "Preview · not wired up yet", 13px uppercase on Paper Light with a rule border, placed at the top of every unbuilt screen.
- **Soon badge:** 12px on Paper Light, fully round, on inert sidebar rows.

### Cards / Containers
- **Corner Style:** 3px (panel).
- **Background:** Paper Light; caveats and tiles sit on white.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Rule. The refusal variant of a caveat or banner uses a 35% Refusal Rose border on a 5% tint.
- **Internal Padding:** 20 to 22px for cards; 12 to 18px for caveats and tiles.

### Inputs / Fields
- **Style:** white field, 1px Control Edge border, 2px corners, 16px text, at least 44px tall; labels 15px/500 in ink above, hints in Muted Ink below.
- **Focus:** the border turns ink and a 3px violet halo (30%) appears.
- **Error / Disabled:** errors are a bordered rose panel above the form (6% tint, 35% border), never a red-only field.

### Navigation
- **Sidebar rail:** 298px, transparent on white, grouped under 13px uppercase labels ("Explore", "Learn"). Rows are 16px/400 on a 24px line with a 21px line icon, 12px corners; long labels wrap onto a second line (1.3 leading) rather than truncate. Hover fills Paper Light, active fills Paper and goes to 500 weight. Unbuilt screens are inert rows (aria-disabled, Muted Ink, no hover) with a "Soon" badge. Sign-out is a row in Refusal Rose. Footer: legal links at 14px, underlined, separated by middots.
- **Header:** white with a bottom rule, 70px (60px below 900px). Signed-out on wide screens it carries "Log in" (quiet) and "Create account" (primary), both 16px; signed-in on wide screens it collapses entirely.

### Security-Print Panel (signature)
The home page's sample card and the report header are the same object. A diagonal pale green-to-lilac-to-blue gradient (152deg, #DCE7E0, #E8E2EE, #DDE6EC), the guilloche rosette symbol drawn at 32 to 38% opacity behind the content, a 28% ink border, 3px corners and the foil lift. Inside: a header row of uppercase 13px data (on the sample, a boxed "Sample report" tag), the headline figure or verdict, then a white-washed meta strip of key/value pairs ruled off from the body. The sample card ends in the monospace machine-readable strip. The report header is the hero card made real: same panel, the applicant's verdict in place of a sample.

### Review Card
A testimonial set as a ruled list entry, not a boxed card. The list opens with a 1px ink rule and lays reviews out three across with 48px column gaps; the first (lead) review spans two of the three columns, and the rest are ruled off with 1px rules. Two across below 1150px, one below 640px, where the lead review drops its span.
- **Who:** a 44px initials tile (two letters, 14px/600, 3px corners, Paper fill, white on a paper band) beside the first name and last initial (17px/600) and a Soft Ink line of place · programme.
- **Rating:** five square star tiles in a row, 22px with a 16px white star; filled tiles are ink, empty tiles are Rule. A month-and-year date sits beside them in Muted Ink with tabular figures. The tiles carry one accessible label ("4 out of 5 stars").
- **Quote:** body type in Soft Ink at a 62ch measure. The line the applicant found most useful is marked: ink, 500 weight, on the highlight (Paper, or white on a paper band), 2px corners.
- **Lead review:** 52px tile, 26px star tiles, 18px name, and the quote at clamp(20px, 2vw, 25px).

### Pricing Tier Card
Four one-time plans as white panels side by side. Each card is a subgrid spanning four rows (head, price, features, action), so names, prices, lists and buttons line up across a row however long one of them runs.
- **Shape:** 3px corners, 1px border at 22% ink, white fill, 30px 24px 24px padding; no shadow.
- **Head:** title-type name with a Soft Ink line icon, then a 16px Soft Ink description.
- **Price:** the price figure (48px, tabular), a Soft Ink term ("one-time") beside it, and the per-interview figure below in Muted Ink.
- **Features:** opened by a soft rule; body-type lines each led by an Approval Green check, with an optional Soft Ink note under a line.
- **Action:** a full-width button at the foot of the card, 52px tall. The recommended tier gets the primary button; the others get the quiet button.
- **Badge:** a label-type tag straddling the top edge (centred on the border, 18px from the left). Ink fill on the recommended tier, which also takes a full ink border. The top tier's badge is Approval Green with a shield icon, its border is 50% Approval Green, and it carries a cover panel above the action: Approval Green text on a 7% tint inside a 30% border, 2px corners.
- **Around it:** a Soft Ink trust line of icon-led facts above the tiers and a Soft Ink footnote below.

### Scoring Panel and the Rosette Turn
While a check scores, a Paper Light panel shows the applicant's answers read back, and the rosette turns slowly behind it (one revolution every 14s, linear). This is the system's one looping, authored motion; it stops under reduced motion.

### Charts
Horizontal bars, a stacked outcome bar and a diverging delta chart, all on white within the working-surface scope, drawn only from the series tokens on a Paper track. Values sit in Soft Ink with tabular figures, just past the end of their own bar. Every chart is preceded or accompanied by a caveat panel about self-reported, correlational data.

### Placeholder content (not system rules)
The review copy, the "2,000+ applicants prepped" figure in the pricing trust line and the paid tiers' /checkout links are placeholders the user approved for this release. They are content, not design: a future surface should not copy the review wording or the figure, and the checkout target is configured in one place in the pricing constants.

## Do's and Don'ts

### Do:
- **Do** set every surface in Inter at 400 body weight and 600 for headings, with a 17px public body and labels no smaller than 13px.
- **Do** break a long public page into paper, white and ink bands, never two of the same ground in a row.
- **Do** colour an ink band by re-pointing the palette tokens, and invert only the primary button.
- **Do** step marks and initials tiles up to white on a paper band.
- **Do** keep primary actions as ink-filled, paper-text, 2px-cornered buttons at least 48px tall.
- **Do** use the violet ring (2px outline, 2px offset, or a 3px 30% halo on fields) for every focus state.
- **Do** put the self-reported-data caveat in the layout as a bordered panel next to the numbers it qualifies.
- **Do** label preview screens with the preview chip and make their controls inert; mark unbuilt nav rows "Soon".
- **Do** reuse the security-print panel for the document that matters on a screen, and only that one.
- **Do** keep the sidebar's 12px row corners; they come from the user's reference.

### Don't:
- **Don't** give callouts a coloured side-stripe border; a caveat is a fully bordered panel.
- **Don't** put eyebrow or kicker labels above headings; a supporting line follows the heading.
- **Don't** use emoji as icons; icons are inline line SVGs in ink.
- **Don't** use monospace outside the machine-readable strip, or add a second display family.
- **Don't** use corners above 4px outside the sidebar.
- **Don't** add shadows to cards, tiles, caveats, review cards or pricing tiers.
- **Don't** colour charts outside the four validated series tokens.
- **Don't** set public text below 13px or lighten secondary text past Muted Ink.
- **Don't** treat the legacy chat flow (`pages/Chat.tsx`, `ChooseLevels.jsx` and the components only they use) or the admin panel (`components/admin/*`, `pages/AdminPage.jsx`) as part of this system. They still carry the older indigo/stone Tailwind look and are not yet migrated.
