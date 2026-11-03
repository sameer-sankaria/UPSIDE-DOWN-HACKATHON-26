import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const lines = JSON.parse(readFileSync(new URL("apps/web/src/components/landing-markup.json", root), "utf8")) as string[];
const markup = lines.join("\n");
const motion = readFileSync(new URL("apps/web/public/onda/motion.js", root), "utf8");

test("landing navigation resolves and contains no agency placeholders or inert forms", () => {
  const dom = new JSDOM(markup);
  const doc = dom.window.document;
  for (const link of doc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    assert.ok(doc.getElementById(link.hash.slice(1)), `Missing target: ${link.hash}`);
  }
  assert.equal(doc.querySelectorAll("[data-8b-placeholder],form").length, 0);
  assert.doesNotMatch(doc.body.textContent ?? "", /Northwind|Halden|Lisbon|Brooklyn|Onda|hello@|newsletter/i);
  assert.ok(doc.querySelector('a[href="/dashboard"]'));
  assert.ok(doc.querySelector('#studio').textContent.includes('NAVI_EXTENSION_ID'));
  assert.match(doc.querySelector(".case:last-child")!.textContent!, /not implemented/);
  dom.window.close();
});

test("template fixed-count motion groups retain their required items and scene anchors", () => {
  const dom = new JSDOM(markup);
  const doc = dom.window.document;
  for (const group of doc.querySelectorAll<HTMLElement>("[data-8b-fixed]")) {
    assert.equal(group.querySelectorAll(group.getAttribute("data-8b-items")!).length, Number(group.dataset["8bFixed"] ?? group.getAttribute("data-8b-fixed")));
  }
  for (const selector of [".hero__aperture", ".hero__orbit", ".statement__dot", ".work__stage", ".work__window", ".work__track", ".again__wheel", ".studio__collage", ".footer__aperture", ".footer__period"]) assert.ok(doc.querySelector(selector), selector);
  assert.equal(doc.querySelectorAll(".shot").length, 5);
  dom.window.close();
});

for (const [name, reduced, support, viewport] of [
  ["reduced motion", true, "complete", true],
  ["unsupported scroll timelines", false, "none", true],
  ["partial scroll timeline support", false, "view-only", true],
  ["short viewport", false, "complete", false]
] as const) {
  test(`motion script is safe with ${name}; mobile menu opens, closes and supports Escape`, () => {
    const dom = new JSDOM(markup, { runScripts: "outside-only", url: "http://localhost:3000" });
    const w = dom.window;
    Object.defineProperty(w, "matchMedia", {
      value: (query: string) => ({
        matches: query === "(prefers-reduced-motion: no-preference)" ? !reduced
          : query === "(min-height: 560px)" ? viewport
          : false
      })
    });
    Object.defineProperty(w, "CSS", {
      value: {
        supports: (condition: string) => support === "complete"
          || (support === "view-only" && condition === "animation-timeline: view()")
      }
    });
    w.eval(motion);
    assert.equal(w.document.documentElement.hasAttribute("data-8b-live"), false);
    const toggle = w.document.querySelector<HTMLButtonElement>(".nav__menu")!;
    const menu = w.document.querySelector<HTMLElement>(".menu")!;
    toggle.click(); assert.equal(menu.hidden, false); assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.equal(w.document.activeElement, menu.querySelector(".menu__close"));
    menu.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(menu.hidden, true); assert.equal(w.document.activeElement, toggle);
    toggle.click(); menu.querySelector<HTMLAnchorElement>("a")!.click(); assert.equal(menu.hidden, true);
    dom.window.close();
  });
}
