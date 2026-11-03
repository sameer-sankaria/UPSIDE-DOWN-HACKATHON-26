import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { extractVisibleText } from "../apps/extension/src/context/extract";

/** Real DOM tree, deterministic layout stubs: jsdom has no rendering/layout engine. */
function extract(html: string, expected = "https://react.dev/learn") {
  const dom = new JSDOM(html, { url: "https://react.dev/learn", runScripts: "outside-only" });
  const w = dom.window;
  const nativeStyle = w.getComputedStyle.bind(w);
  w.getComputedStyle = ((element: Element) => {
    const style = nativeStyle(element);
    return { display: style.display || "block", visibility: style.visibility || "visible", opacity: style.opacity || "1" };
  }) as any;
  w.Range.prototype.getClientRects = function () {
    const el = this.startContainer.nodeType === 3 ? this.startContainer.parentElement : this.startContainer as Element;
    const off = el?.closest("[data-offscreen]");
    return [{ width: 200, height: 20, top: off ? 5000 : 10, bottom: off ? 5020 : 30, left: 10, right: 210 }] as any;
  };
  try {
    // Execute the serialized injection in a separate JS realm, just as Chrome will.
    return w.eval(`(${extractVisibleText.toString()})(${JSON.stringify(expected)})`) as { text: string; blocked: boolean };
  } finally { w.close(); }
}
test("extracts relevant visible main text from serialized function", () => {
  const result = extract("<nav>Ignore nav</nav><main><h1>React hooks</h1><p>Use TypeScript components.</p></main>");
  assert.equal(result.blocked, false); assert.ok(result.text.includes("React hooks")); assert.ok(result.text.includes("TypeScript"));
  assert.equal(result.text.includes("Ignore nav"), false);
});
test("excludes inputs, forms, contenteditable regions, private containers, hidden and offscreen text", () => {
  const result = extract(`<main><p>React documentation</p>
    <form><p>private form text</p><input value="secret-input"></form>
    <textarea>private textarea</textarea><select><option>private option</option></select>
    <div contenteditable="true">private editor</div><div role="textbox">private textbox</div>
    <div data-private>private profile</div><div data-sensitive>private sensitive</div>
    <div hidden>private hidden</div><div aria-hidden="true">private aria</div>
    <div style="display:none">private display</div><div style="opacity:0">private opacity</div>
    <div data-offscreen>private offscreen</div><iframe>private frame</iframe></main>`);
  assert.equal(result.blocked, false); assert.equal(result.text.includes("private"), false); assert.equal(result.text.includes("secret-input"), false);
  assert.ok(result.text.includes("React documentation"));
});
for (const field of ['<input type="password" value="super-secret">', '<input autocomplete="one-time-code" value="123456">', '<input name="otp" value="123456">']) {
  test(`blocks entire credential/OTP page ${field}`, () => {
    const result = extract(`<main><p>React</p>${field}</main>`); assert.equal(result.blocked, true); assert.equal(result.text, "");
  });
}
test("redacts rendered email addresses, OTP numbers, bearer tokens and labeled secrets", () => {
  const result = extract(`<main><p>React email alice@example.org</p><p>123456</p><p>ghp_abcdefghijklmnopqrstuvwxyz123456</p><p>Password: do-not-include</p></main>`);
  for (const secret of ["alice@example.org", "123456", "abcdefghijklmnopqrstuvwxyz", "do-not-include"]) assert.equal(result.text.includes(secret), false);
  assert.ok(result.text.includes("React"));
});
test("navigation URL race returns no text and excessive DOM output is bounded", () => {
  assert.deepEqual(extract("<main>private new page</main>", "https://react.dev/old").text, "");
  const result = extract(`<main>${"<p>React components examples documentation </p>".repeat(1000)}</main>`);
  assert.ok(result.text.length <= 8000);
});
