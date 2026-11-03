import { build } from "esbuild";
import { mkdir, copyFile, rm } from "node:fs/promises";
const output = new URL("../dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({
  absWorkingDir: new URL("..", import.meta.url).pathname,
  entryPoints: ["src/background.ts", "src/popup.ts"], outdir: output.pathname,
  bundle: true, format: "esm", platform: "browser", target: "chrome120",
});
for (const name of ["manifest.json", "popup.html"]) {
  await copyFile(new URL(`../${name}`, import.meta.url), new URL(name, output));
}
