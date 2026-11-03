import Script from "next/script";
import markup from "../components/landing-markup.json";
import { LandingPanel } from "../components/landing-panel";
import { ExtensionDiagnostics } from "../lib/extension-diagnostics";

// Trusted, repository-owned HTML adapted directly from the MIT Onda source.
// Native anchors intentionally load a fresh document when leaving the motion page.
export default function Home() {
  return <>
    <link rel="stylesheet" href="/onda/template.css" />
    <link rel="stylesheet" href="/onda/navi.css" />
    <div dangerouslySetInnerHTML={{ __html: markup.join("\n") }} />
    <LandingPanel />
    <ExtensionDiagnostics />
    <Script src="/onda/motion.js" strategy="afterInteractive" />
  </>;
}
