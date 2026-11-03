# Free HTML design studio website template with scroll animations and no libraries

Design studio website template: one free HTML file for a brand, product or digital agency, with ten sections from a one-word greeting to a contact form. The look is black, white and one violet, with giant type and a round photo that travels down the page as you scroll. It moves with plain CSS and no JavaScript libraries, in one file of 31 KB gzipped; AGENTS.md lets Claude Code, Cursor or Codex adapt it.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE) ![one HTML file: no build](https://img.shields.io/badge/one%20HTML%20file-no%20build-orange) ![dependencies: none](https://img.shields.io/badge/dependencies-none-brightgreen)

**[Live demo](https://8bsite.github.io/design-studio-website-template/)** · **[Use this template](https://github.com/new?template_name=design-studio-website-template&template_owner=8bsite)** · **[Download ZIP](https://github.com/8bsite/design-studio-website-template/archive/refs/heads/main.zip)** · **[Template page on 8b.com](https://8b.com/templates/onda/)**

<a href="https://8bsite.github.io/design-studio-website-template/"><img src="previews/desktop.png" alt="Design studio website template: first screen on a desktop" width="76.1%"></a> <a href="https://8bsite.github.io/design-studio-website-template/"><img src="previews/phone.png" alt="Design studio website template: first screen on a phone" width="21.9%"></a>

<p align="center"><a href="https://8bsite.github.io/design-studio-website-template/"><img src="previews/scroll.gif" alt="Design studio website template: scrolling through the first sections" width="40%"></a><br><sub>Scroll animation</sub></p>

## Use it with Claude Code, Cursor or Codex

Download the four files into your project folder (`curl.exe` in Windows PowerShell):

```bash
curl -LO https://raw.githubusercontent.com/8bsite/design-studio-website-template/main/index.html
curl -LO https://raw.githubusercontent.com/8bsite/design-studio-website-template/main/AGENTS.md
curl -LO https://raw.githubusercontent.com/8bsite/design-studio-website-template/main/LICENSE
curl -LO https://raw.githubusercontent.com/8bsite/design-studio-website-template/main/CREDITS.md
```

Then fill in the angle brackets and give your agent this prompt:

```text
Read AGENTS.md, then edit index.html. Make it the site for <your studio: name, what you make and for whom, offices, contacts, client projects and results, long term clients, services, how a project starts and is priced, team and open roles>. Motion is CSS scroll-driven animation plus the inline kit: keep the gate script in the head, the section ids, the data-8b attributes, the classes AGENTS.md lists, each heading's dot span and the length number on Hello and Let's talk; add no animation library. Keep four process steps, five collage photos and one journal photo per story. Never invent clients, results, rates, addresses or contacts; ask me.
```

As a design studio website template for Claude Code, Cursor or Codex, and if you vibe code the site, the first edits are the studio name, the two-line statement, the five case cards and the six long-term clients, because every client and result in the demo is invented. Keep these counts in step: four process steps for the four ring stations, five photos in the desktop collage (each has its own position), and one frame photo per journal story, in the same order. Have the agent ask you for real offices, addresses, phone numbers, team size, rates and open roles instead of guessing.

No agent? Click **[Use this template](https://github.com/new?template_name=design-studio-website-template&template_owner=8bsite)**, edit `index.html` on GitHub and turn on **Settings > Pages**.

## Sections and motion

- **Navigation**: fixed top bar: wordmark, section links, Start a project button; phone menu overlay.
- **First screen**: first screen: a one-word greeting whose full stop is a giant round photo (demo: "Hello"). Smooth wheel scrolling with a mouse; on load Hello rises out of a mask and the round photo swells. Scrolling away carries that photo down into the next heading's dot.
- **We make the things people come back to**: two-line statement of what the studio does, a lead paragraph and an index of links into the page. Tied to scroll, the two heading lines slide up, the dot pops in, and the lead darkens word by word.
- **Selected work**: case studies: five large cards on a horizontal track (demo: five client launches). The stage holds in place while five case cards slide sideways with photos panning inside them, then the cards bend onto a curve as the section ends.
- **Never a one-off**: long-term clients: six cards on a wheel that turns with scroll (demo: years of partnership). On a held stage, six client cards ride the rim of a large wheel that swings into place and turns as you scroll.
- **What we do**: services: five cards that stack as you scroll, each with deliverable badges and a photo. Service cards stick and stack, each shrinking and darkening under the next; photos open from a circle as they appear.
- **How we work**: process: four steps beside a ring the scroll draws round (demo: Listen, Make, Measure, Again). Tied to scroll, a violet arc draws round the sticky ring and each station dot pops as its step brightens.
- **Inside the studio**: team and careers: photo collage that deals out from a pile, with open roles. Tied to scroll, the collage photos start as a tilted pile in the centre and deal out to their places.
- **Ideas and news**: news and articles: four stories beside a sticky photo frame. The photo frame stays put while stories pass; each brightens on arrival and its photo opens in a circle.
- **Fair questions**: questions and answers (native &lt;details&gt;).
- **Let's talk**: violet contact field: big "Let's talk", email, two offices with phones, and a form (placeholders). As the violet section scrolls in, Let's talk grows from regular to extra bold, then its white dot drops in.
- **Footer**: closing greeting "Bye" with the round photo full stop, link columns, newsletter, copyright and the Design: 8B credit. Tied to scroll, Bye rises while its full stop grows from a dot into a large round photo.

## Design

![#0d0c11](https://img.shields.io/badge/-%230d0c11-0d0c11?style=flat-square) near-black bands and text  
![#ffffff](https://img.shields.io/badge/-%23ffffff-ffffff?style=flat-square) white bands, text on black  
![#6c3cff](https://img.shields.io/badge/-%236c3cff-6c3cff?style=flat-square) violet dots, buttons, process ring, contact section  
![#efeef4](https://img.shields.io/badge/-%23efeef4-efeef4?style=flat-square) pale cards for services and the form  
![#aaa7b4](https://img.shields.io/badge/-%23aaa7b4-aaa7b4?style=flat-square) muted text on black  
![#5d5a67](https://img.shields.io/badge/-%235d5a67-5d5a67?style=flat-square) secondary text on white  
![#1f1d26](https://img.shields.io/badge/-%231f1d26-1f1d26?style=flat-square) dark base under photos

**Gabarito**: extra bold, tightly tracked headings; Hello and Bye are single giant words sized in viewport units (Hello also from its character count on phones), and Let's talk is sized from its character count to fill the width. **Onest**: body, labels, buttons and badges (Google Fonts). Black, white and one violet. Every section heading ends in a round violet dot, echoed by the round photo full stops after Hello and Bye and the dot in each pill button. Cards have large rounded corners, studio photos form a scattered collage, and form fields are bare underlines.

## Questions

**Does it work as a design agency website if we do not do AI work?**  
Yes. Case studies, long-term clients, services, process, team and journal suit any agency, so it also works as a digital agency template. Rewrite the hero line, the title and meta description, and delete or rewrite the Applied AI card, then update the Five practices lead.

**Does this version need GSAP, Lenis or any other library?**  
No. The scroll scenes are CSS scroll-driven animations, and a short inline script measures distances and smooths the mouse wheel. The page downloads 31 KB of code gzipped in one file against 76 KB for the GSAP build. Keep the gate script, the data-8b attributes, the heading dots and the --len number on Hello and Let's talk. Type and colour are also [set down as YAML tokens](https://8b.com/templates/design-md/).

**Do the contact form and the newsletter field send anything?**  
No, not yet. Both check what was typed and show a thank-you or error message, but nothing leaves the page until you connect a service such as Formspree or Netlify Forms. Without a service, remove the form together with its script and keep the email link.

## Is it the right base?

Pick this base for a design studio website when the proof is a handful of strong projects and the page itself should feel designed. This is the light build: the same look and scroll behaviour, with no animation library and no script from a CDN, 31 KB of code gzipped in one file where the GSAP version needs 76 KB and three more requests. A creative agency or production house may find the [production house](https://8b.com/templates/sillage/) template nearer. The weak spot is depth: one page cannot hold dozens of projects, and the work section holds for a long sideways scroll.

## Before you publish

- Replace what is marked `data-8b-placeholder` (social preview image, favicon, email, phone, form, social) and the invented demo facts; [AGENTS.md](AGENTS.md) lists them.
- The form sends nothing yet: connect it to Formspree or Netlify Forms, or remove it.

## Tech

No JavaScript libraries: CSS scroll-driven animations and a small inline motion script with its own smooth wheel scrolling, 115 KB, no build step. Chrome and Edge 111+, Safari 16.2+, Firefox 113+ (it uses color-mix(), cascade layers, small/dynamic viewport units). Without scroll-driven animations (Firefox today) the scroll motion and the smooth wheel are off and each section shows its finished layout, while any load-in or looping animation still plays; with "reduce motion" on, the page is complete and nothing moves on its own (hover effects stay).

A GSAP build of the same page is [`index.gsap.html`](index.gsap.html): GSAP 3.13.0, ScrollTrigger, Lenis 1.3.4 from jsDelivr, 137 KB; its scroll motion also plays in Firefox. Use one of the two files.

## License

MIT, see [LICENSE](LICENSE). Photos, fonts and libraries keep their own licences: [CREDITS.md](CREDITS.md). More free templates: [8b.com/templates](https://8b.com/templates/) · [github.com/8bsite](https://github.com/8bsite).
