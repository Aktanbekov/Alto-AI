---
name: Altovisas
description: F-1 interview preparation set in paper and ink, with a security-print signature.
colors:
  paper: "#E7ECE6"
  paper-2: "#F3F6F1"
  page-white: "#FFFFFF"
  ink: "#16233B"
  ink-deep: "#0E1729"
  ink-soft: "#4A5568"
  ink-muted: "#5B6577"
  guilloche: "#7C6BA8"
  ok: "#2F6B4F"
  bad: "#A33556"
  rule: "rgba(22, 35, 59, .16)"
  rule-soft: "rgba(22, 35, 59, .08)"
  control: "#7D8796"
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
    fontSize: "clamp(32px, 5.4vw, 56px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(21px, 3vw, 28px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-.022em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-.012em"
  lede:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(17px, 2vw, 20px)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  body-reading:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: ".08em"
  figure:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "64px"
    fontWeight: 600
    lineHeight: 0.82
    letterSpacing: "-.05em"
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
  page-max: "1120px"
  gap: "20px"
  card: "22px"
  section: "56px"
  section-phone: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.hairline}"
    padding: "15px 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.paper}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.hairline}"
    padding: "15px 24px"
  button-oauth:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hairline}"
    padding: "12px 16px"
    height: "48px"
  input:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
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
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.nav-row}"
    padding: "12px 16px"
  nav-item-hover:
    backgroundColor: "{colors.paper-2}"
  nav-item-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  pill-ok:
    backgroundColor: "rgba(47, 107, 79, .12)"
    textColor: "{colors.ok}"
    rounded: "{rounded.hairline}"
    padding: "3px 9px"
  pill-bad:
    backgroundColor: "rgba(163, 53, 86, .10)"
    textColor: "{colors.bad}"
    rounded: "{rounded.hairline}"
    padding: "3px 9px"
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

Altovisas is set like the papers an applicant carries to the window: cool green-grey paper, navy ink, hairline rules, and one security-print panel engraved with a guilloche rosette. The system is quiet on purpose. Almost everything sits on white with ink type and thin rules; the tinted paper band and the foil panel are spent sparingly, so the one document-like object on a screen reads as the thing that matters (a sample verdict on the home page, the applicant's own verdict on the report).

Density follows the surface. Public pages under the page typography scope are generous and editorial: large Inter headings, a reading measure of 54 to 68 characters, rules between items instead of cards. Working surfaces (the corpus dashboard, the profile check, the access flow) are tighter and table-like, with the same tokens and only the density changed. Honesty is part of the layout, not an annotation: caveats about the self-reported corpus are bordered panels in the flow, the sample card says "Sample report" where the eye lands, and preview screens carry their own label.

One family does every job. Inter carries display, headings, body and labels; the only other face is the system monospace on the passport machine-readable strip, because that strip is printed in an OCR face in life.

**Key Characteristics:**
- Paper and ink: white page, navy ink, green-grey paper tint for one band and for panels.
- One security-print panel per screen, engraved with the guilloche rosette.
- Hairline geometry: 1px rules, 2 to 4px corners.
- Inter for everything; monospace only on the machine-readable strip.
- Caveats and preview labels are structural parts of the page.
- Near-flat: depth only on the foil panel, the dialog, the mobile drawer and a pressed-button lift.

## Colors

A cool, low-chroma document palette: navy ink on white and green-grey paper, with a muted violet reserved for the engraving and for focus.

### Primary
- **Consular Ink** (ink): every heading and body line, the primary button fill, the 1px heavy rule that opens a report section or a FAQ list. Pressed and hovered primary buttons darken to **Night Ink** (ink-deep).

### Secondary
- **Engraving Violet** (guilloche): the rosette strokes and every focus ring (2px outline, 2px offset; fields use a 3px violet halo at 30%). It never fills a surface or colours text.

### Tertiary
- **Approval Green** (ok) and **Refusal Rose** (bad): verdict words, outcome pills, the "fix" panel and the refusal caveat, each used as text colour or as a 5 to 14% tint behind it. Refusal Rose also sets the sample card's headline figure.
- **Chart series** (series-pos, series-neg, series-alt, series-none): blue for approved/positive, rose for refused/negative, violet for 221(g) and other outcomes, grey-green for not stated. These four were run through a colour-blind validator against white and are the only colours charts may use.

### Neutral
- **Page White** (page-white): the ground for every page, every field, the dialog and the caveat panel.
- **Paper** (paper): the single tinted band on the home page (hero plus the three-cell strip, and the closing band), the active sidebar row, chart tracks, neutral pills.
- **Paper Light** (paper-2): cards, readouts, the ledger, the scoring panel, hover fill on rows and quiet buttons.
- **Soft Ink** (ink-soft): secondary text, ledes, small uppercase labels (6.3:1 on paper).
- **Muted Ink** (ink-muted): the tertiary floor; hints, placeholders, counts, inert "Soon" rows (4.9:1 on paper). Nothing lighter carries text.
- **Rule** (rule) and **Soft Rule** (rule-soft): borders on cards and panels, and the hairlines between list items and readout rows.
- **Control Edge** (control): the border on inputs, selects, textareas and the OAuth button, at 3:1 so a field edge is visible as a control.

### Status
- **Warning** (warn, warn-bg, warn-rule): one message type only - something went partly wrong and the person can still act, such as an account created whose verification email did not send. Text in warn on warn-bg inside a warn-rule border. Never decoration, never a chart series.

### Named Rules
**The One Band Rule.** Paper tint is a band, not a wallpaper. On the home page only the hero-and-strip block and the closing band are tinted; everything else sits on white.

**The Violet Is Engraving Rule.** Engraving Violet appears in the rosette and in focus rings, nowhere else. It is how keyboard focus looks on every surface.

**The Validated Series Rule.** Charts draw only from the four series tokens. A new chart category maps onto one of them or is not drawn.

## Typography

**Display Font:** Inter (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Inter (same stack)
**Label/Mono Font:** Inter for labels; ui-monospace stack (the mrz token) for the passport strip only.

**Character:** One family, set tight at the top and open in the body. Headings are semibold (600) with negative tracking that increases with size; body is regular (400) at a generous leading, so the voice stays plain and candid rather than designed.

### Hierarchy
- **Display** (display): the page h1 on public pages. Reading pages and the account gate cap it slightly lower (clamp(30px, 4.4vw, 46px)); the profile check sets its h1 at clamp(26px, 3.4vw, 34px).
- **Headline** (headline): section h2s on public pages. Reading pages use 21px; the report's verdict is a larger headline at clamp(30px, 4.6vw, 44px) in ok or bad.
- **Title** (title): h3s, the officer's question on the profile check, gate list headings, card values (16 to 18px).
- **Lede** (lede): the paragraph under an h1, in Soft Ink, at a 54ch measure.
- **Body** (body): 15px everywhere; reading pages step up to 16px at 1.65 and a 68ch measure (body-reading).
- **Label** (label): small uppercase keys on readouts, tiles, the foil panel, the ledger and the sidebar group names. 12px, tracked .06 to .08em, in Soft Ink. Fieldset legends and the table-of-contents head use the same treatment at 13px.
- **Figure** (figure): the foil panel's headline number. Numbers in tiles, the report's meta strip and counts use tabular figures.
- **Machine-readable strip** (mrz): the single monospace line along the bottom of the sample card, 12px, .12em tracking, at 72% ink.

### Named Rules
**The One Family Rule.** Inter sets every role. Do not introduce a display face; hierarchy comes from size, weight and tracking.

**The Monospace Is a Passport Rule.** Monospace exists for the machine-readable strip and nothing else.

**The 12px Floor Rule.** No text renders below 12px, and body weight is 400, never 300.

## Layout

Two frames share one content width. Public pages use a centred wrapper (page-max, with page-pad gutters that tighten to page-pad-phone below 900px); reading pages narrow to 720px plus gutters. The app shell puts a 298px sticky rail on the left, divided from the main column by a single rule; below 900px the rail becomes a right-anchored drawer (min(298px, 86vw)) opened from a 44px menu button in the header, and the brand moves into the header row.

Rhythm: sections breathe at 56px vertically (40px on phones); hero and closing bands run 64 to 72px. Grids are two-up at 30px gaps and collapse to one column at 900px; the three-cell strip is drawn as cells separated by 1px rule-coloured gaps rather than cards. Working surfaces use a 20px gap, auto-fit tile grids (min 168px) and paired charts that stack below 760px. Primary buttons go full width below 560px. Breakpoints in use: 560, 640, 760 and 900px.

Reading pages are one column with headings that lead and rules between items, not cards. FAQ and the report open each list with a 1px ink rule and separate items with 1px rules.

## Elevation & Depth

The system is flat and draws depth from tone and rules: white page, Paper Light panels, 1px borders. Shadows are reserved for four situations, each tinted with ink rather than black.

### Shadow Vocabulary
- **Foil lift** (`0 1px 0 rgba(255,255,255,.7) inset, 0 14px 34px -22px rgba(22,35,59,.55)`): the security-print panel only, on the home hero and the report header. Dropped in print.
- **Press lift** (`0 10px 20px -12px rgba(22,35,59,.55)`): primary button hover, paired with a 1px rise; removed on active.
- **Dialog** (`0 30px 60px -24px rgba(22,35,59,.5)`): the sign-in dialog over a 45% ink scrim.
- **Drawer** (`-18px 0 40px -24px rgba(22,35,59,.45)`): the open mobile rail.

### Named Rules
**The Flat Page Rule.** Cards, caveats, tiles and readouts never cast a shadow. If a surface needs separation, it gets a border or a tint.

## Shapes

Hairline geometry: 1px borders and very small corners. Buttons, inputs, pills and inline panels use 2px (hairline); cards, caveats, tiles and the foil panel use 3px (panel); the dialog and the on-page auth panel use 4px (dialog). Chart bars round only their growing end (4px). The one deliberate exception is the sidebar: its rows keep 12px corners and its "Soon" badge is fully round, taken from the user-supplied "Sunflower" reference. Those are intended; do not normalise them.

Rules do structural work: a 1px ink rule opens a report section or a FAQ list; 1px rule or soft rule separates items within it; dashed rules mark a "before" state in comparisons.

## Components

### Buttons
Plain, heavy and square-shouldered.
- **Shape:** hairline corners (2px).
- **Primary:** Consular Ink fill, Paper text, 600 weight, 15 to 16px, at least 48px tall. On the home page it carries a small knocked-out "Free" tag (12px, uppercase, .06em) inside the fill.
- **Hover / Focus:** Night Ink fill or a 1px rise with the press lift (removed on active); disabled drops to 50 to 55% opacity. Focus is the violet ring.
- **Ghost:** transparent with ink text and border; hover adds a 5% ink tint.
- **OAuth / secondary:** white, Control Edge border, 500 weight; hover fills with Paper Light.
- **Text actions:** underlined ink links with a rule-coloured underline that turns solid on hover, 44px hit area ("Skip" in the survey is one of these and is a real choice).

### Chips
- **Outcome pills:** 12 to 12.5px, 2px corners, ok or bad text on a 10 to 14% tint of itself; neutral pills sit on Paper.
- **Preview chip:** "Preview · not wired up yet", 12px uppercase on Paper Light with a rule border, placed at the top of every unbuilt screen.
- **Soon badge:** 12px on Paper Light, fully round, on inert sidebar rows.

### Cards / Containers
- **Corner Style:** 3px (panel).
- **Background:** Paper Light; caveats and tiles sit on white.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Rule. The refusal variant of a caveat or banner uses a 35% Refusal Rose border on a 5% tint.
- **Internal Padding:** 20 to 22px for cards; 12 to 16px for caveats and tiles.

### Inputs / Fields
- **Style:** white field, 1px Control Edge border, 2px corners, 16px text, at least 44px tall; labels 14px/500 in ink above, hints 13px in Muted Ink below.
- **Focus:** the border turns ink and a 3px violet halo (30%) appears.
- **Error / Disabled:** errors are a bordered rose panel above the form (6% tint, 35% border), never a red-only field.

### Navigation
- **Sidebar rail:** 298px, transparent on white, grouped under 12px uppercase labels ("Explore", "Learn"). Rows are 15px/400 with a 21px line icon, 12px corners; hover fills Paper Light, active fills Paper and goes to 500 weight. Unbuilt screens are inert rows (aria-disabled, Muted Ink, no hover) with a "Soon" badge. Sign-out is a row in Refusal Rose. Footer: legal links at 13px, underlined, separated by middots.
- **Header:** white with a bottom rule, 70px (60px below 900px). Signed-out on wide screens it carries "Log in" (quiet) and "Create account" (primary); signed-in on wide screens it collapses entirely.

### Security-Print Panel (signature)
The home page's sample card and the report header are the same object. A diagonal pale green-to-lilac-to-blue gradient (152deg, #DCE7E0, #E8E2EE, #DDE6EC), the guilloche rosette symbol drawn at 32 to 38% opacity behind the content, a 28% ink border, 3px corners and the foil lift. Inside: a header row of uppercase 12px data (on the sample, a boxed "Sample report" tag), the headline figure or verdict, then a white-washed meta strip of key/value pairs ruled off from the body. The sample card ends in the monospace machine-readable strip. The report header is the hero card made real: same panel, the applicant's verdict in place of a sample.

### Scoring Panel and the Rosette Turn
While a check scores, a Paper Light panel shows the applicant's answers read back, and the rosette turns slowly behind it (one revolution every 14s, linear). This is the system's one looping, authored motion; it stops under reduced motion.

### Charts
Horizontal bars, a stacked outcome bar and a diverging delta chart, all on white within the working-surface scope, drawn only from the series tokens on a Paper track. Values sit in Soft Ink with tabular figures, just past the end of their own bar. Every chart is preceded or accompanied by a caveat panel about self-reported, correlational data.

## Do's and Don'ts

### Do:
- **Do** set every surface in Inter at 400 body weight and 600 for headings, with labels no smaller than 12px.
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
- **Don't** add shadows to cards, tiles or caveats.
- **Don't** colour charts outside the four validated series tokens.
- **Don't** treat the legacy chat flow (`pages/Chat.tsx`, `ChooseLevels.jsx` and the components only they use) or the admin panel (`components/admin/*`, `pages/AdminPage.jsx`) as part of this system. They still carry the older indigo/stone Tailwind look and are not yet migrated.
