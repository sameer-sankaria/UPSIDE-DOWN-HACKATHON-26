---
version: alpha
name: "Design studio template by 8B"
description: "A one-page design and brand studio site in black, white and one violet, with giant extra bold headlines ending in a round dot. Free HTML template by 8B, MIT."
colors:
  primary: "#0d0c11"
  secondary: "#5d5a67"
  surface: "#ffffff"
  on-surface: "#0d0c11"
  accent-violet: "#6c3cff"
  neutral: "#efeef4"
  muted-on-dark: "#aaa7b4"
  plate-dark: "#1f1d26"
typography:
  headline-hero:
    fontFamily: Gabarito
    fontSize: 380px
    fontWeight: 800
    lineHeight: 0.8
    letterSpacing: -0.065em
  headline-lg:
    fontFamily: Gabarito
    fontSize: 150px
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: -0.055em
  headline-md:
    fontFamily: Gabarito
    fontSize: 58px
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: -0.04em
  headline-sm:
    fontFamily: Gabarito
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -0.025em
  body-lg:
    fontFamily: Onest
    fontSize: 25px
    fontWeight: 500
    lineHeight: 1.28
    letterSpacing: -0.015em
  body-md:
    fontFamily: Onest
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: Onest
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.01em
  nav-link:
    fontFamily: Onest
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.005em
  button:
    fontFamily: Onest
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.01em
rounded:
  none: 0px
  md: 14px
  lg: 28px
  full: 999px
spacing:
  gutter: 48px
  gutter-phone: 16px
  section-y: 200px
  section-y-min: 96px
  card-gap: 20px
  collage-gap: 12px
  button-height: 48px
components:
  button-primary:
    backgroundColor: "{colors.accent-violet}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: 0 22px 0 18px
    height: "{spacing.button-height}"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: 0 22px 0 18px
    height: "{spacing.button-height}"
  nav-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.full}"
    padding: 0 8px
  card-case:
    backgroundColor: "{colors.plate-dark}"
    textColor: "{colors.surface}"
    typography: "{typography.headline-md}"
    rounded: "{rounded.lg}"
  card-surface:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 34px
  badge:
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 0 12px
    height: 30px
  input-field:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: 10px 0
    height: "{spacing.button-height}"
  heading-dot:
    backgroundColor: "{colors.accent-violet}"
    rounded: "{rounded.full}"
    size: 0.19em
---

# Onda: design studio template

## Overview

Onda is a one-page site for an independent brand, product and design studio. Its one idea is the full stop: every section heading ends in a round violet dot, the first and last words (Hello and Bye) are paired with a giant round photo, and every pill button carries a small dot that grows on hover. Everything else is black, white and very large type. The tone is confident and a little playful, for clients who want to see craft before a pitch. Clients, people and numbers in the demo are invented.

## Colors

Black and white bands alternate; violet is kept for dots, buttons, the process ring, small accents and one full section.

- **Primary (#0d0c11):** a near-black ink for text on white and for the dark bands (hero, work, clients, services, footer), and the hover fill of buttons.
- **Surface (#ffffff):** the white bands (statement, method, studio, journal, questions) and text on black.
- **Accent violet (#6c3cff):** the dot after headings, primary buttons, the process arc and runner, the focus outline, the photo tint, and the whole contact section, where text turns white.
- **Neutral (#efeef4):** a pale lilac-grey for service cards, the contact form panel and the journal photo frame.
- **Secondary (#5d5a67):** a mid grey for descriptions, steps, story text and form labels on light grounds.
- **Muted on dark (#aaa7b4):** supporting text on black: section leads, footer labels, legal line, phone menu footer.
- **Plate dark (#1f1d26):** the base behind case and client photos.

## Typography

Two families. **Gabarito** (weights 400 to 800) carries every headline: extra bold (700 on smaller titles), lines packed at 0.8 to 1.08, tracking pulled tight (-0.04em or tighter on the big sizes), mixed case with no uppercase. **Onest** (400 to 600) carries body, leads, buttons, badges and labels, with slight negative tracking on larger sizes. Sizes are fluid: the hero word is 26.5vw on wide landscape screens (about 380px on a 1440px laptop screen, capped at 43 percent of the viewport height) and elsewhere is sized from its character count (near 40vw on phones), section titles run 40 to 150px, case names 30 to 58px, leads 19 to 25px (up to 34px beside the statement), body is 17px.

## Layout

The page is full width with no max width and a fluid side gutter, 16px on phones up to 48px. Vertical rhythm comes from one token, about 15 percent of viewport height, between 96px and 200px. The breakpoint that matters is 900px: below it the nav pill collapses to a Menu button that opens a full-screen black overlay with huge links; above it sections split into two columns (7/4 statement, 5/6 method and journal, 5/7 questions, 5/6 contact from 1000px). Without the scroll scenes, case cards go from one column to two at 700px and client cards to two at 640px and three at 1000px. On wide screens the studio photos form a placed collage with the open roles list inside it; on phones, a two-column grid. Sections are separated mainly by changing ground.

## Elevation & Depth

Depth is made by stacking and by rounded plates. While the scroll scenes run, service cards are sticky and stack; each carries a soft upward shadow (0 -18px 50px, the ink at 45 percent) so it lifts off the card beneath. The work section sits on a dark plate that, with motion, opens from an inset rounded shape to full bleed as you arrive. Focus uses a 2px violet underline shadow on fields, and the nav call to action has a 2px ink ring. There are no other shadows, and cards have no borders.

## Shapes

Three radii: 28px for cards, the journal frame and the form panel; 14px for photos inside cards and the collage; 999px for everything round. Pills are buttons, badges, nav and icon buttons. Circles are the signature shape: the heading dot (0.19em wide), the round hero and footer photos, a thin orbit ring with a small moon, the process ring with station dots, and circular photo reveals. Form fields are bare underlines in a 1.5px line at 40 percent of the text colour. Photos are cropped to 4:5, 16:11, 16:10, 3:2 or 3:4 with cover fit.

## Components

- **button-primary:** violet pill, 48px tall, white 16px label with a small solid dot before it; on hover devices an ink dot swells behind the label until it fills the button.
- **button-secondary:** the same pill in white with a violet dot, for the phone Menu button.
- **nav-pill:** the brand and the link group float over the page as black pills with white 15px links that underline on hover.
- **card-case:** a large rounded photo card with a tag badge top left and the name and one line at the bottom over a dark fade.
- **card-surface:** pale card with a text column, a row of badges and a photo; the contact form uses the same surface.
- **badge:** outlined pill, 13px, border at 32 percent of the text colour.
- **input-field:** underline only; focus turns the line violet.
- **heading-dot:** an inline violet circle in a `span`.

## Motion

The page loads no animation library. Scroll scenes are CSS scroll-driven animations (`animation-timeline: view()` and named view timelines), written per section in `<style data-8b-part="scene:...">` blocks. A small inline motion kit at the end of the body measures distances into CSS variables (the photo's landing spot, the work track's run, the wheel's size and turn, the collage pile), adds `is-in` to `data-8b-motion` elements as they arrive, splits leads into words, pauses endless loops off screen, and smooths the mouse wheel (fine pointers only; touch scrolls natively). A gate script in the head sets `data-8b-live` on the root only when the browser supports `animation-timeline` and the visitor has no reduced-motion preference; every scroll rule is scoped to it. The motion idea is the dot as a moving object: it drops into headings, a photo flies into the next heading's dot, and the footer photo grows back out of one.

- **Hero:** on load (CSS keyframes), the word rises out of a mask, the round photo swells with a slight overshoot and the lead lifts. The photo turns once per 46 seconds and a thin orbit ring with a small violet moon turns every 13 seconds, both paused when off screen. Scrolling away carries the photo into the statement heading's dot while a violet tint covers it.
- **Headings (rise):** each title slides up from a clipped edge in under a second, then its dot drops in and pops.
- **Leads (ink):** words light up one by one from 16 percent opacity as the paragraph crosses the screen.
- **Work:** the stage sticks to the top (CSS `position: sticky`) and five cards slide sideways, photos panning inside them; as it ends the cards bend onto an arc.
- **Clients:** six cards sit on a large wheel on a sticky stage that swings in and turns with the scroll.
- **Services:** cards stick and stack, each shrinking to 0.9 and darkening under the next; photos open from a circle.
- **Method:** a violet arc draws round a sticky ring as a runner turns once and station dots pop.
- **Studio, journal, contact, footer:** the collage deals out of a tilted pile; story photos open in a circle; Let's talk grows from weight 400 to 800; Bye rises as its dot grows into a round photo.

Hover: links draw an underline over 0.45s, icon buttons fill violet, FAQ marks enlarge their dot. With reduced motion, and in browsers without CSS scroll-driven animations (Firefox today), `data-8b-live` is not set: the smooth wheel and all scroll scenes and entrance effects are off, scrolling is the browser's own, case and client cards sit in grids, the services are a plain list and every section shows its finished layout. The hero's load-in and the turning hero and footer photos are CSS keyframes under `prefers-reduced-motion: no-preference`, so they still play in Firefox and stop with reduced motion. Hover effects remain in both cases. If a scene's script throws, the kit logs an error and switches off that scene's styles, so only its section stays static. Keep `hero` directly above `statement`: the photo's flight measures the statement's dot, and with another section next it stays in place.

## Do's and Don'ts

- Do end every section heading with the violet dot span and keep the dot round.
- Do set headlines in Gabarito extra bold with tight tracking and lines packed close.
- Do alternate black and white bands and save violet for dots, buttons, the ring and the contact section.
- Do use pills for buttons and badges, 28px for cards, bare underlines for fields.
- Don't add gradient backgrounds beyond the dark fade under card text, outlined cards, or shadows beyond the stacked services.
- Don't use uppercase headings, a second display face or icons beyond the simple line arrow and close mark.
- Don't introduce a second accent colour.
- Don't type a full stop after a heading in place of the dot.
