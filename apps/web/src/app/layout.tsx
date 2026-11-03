import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "NAVI OS — Your browser. Your AI. Your control.",
  description: "A browser intelligence assistant with contextual suggestions, opt-in Ghost Mode, and explicit permissions. Your browser stays in your control.",
  generator: "8B Templates",
  openGraph: { title: "NAVI OS", description: "Your browser. Your AI. Your control.", type: "website" },
  twitter: { card: "summary", title: "NAVI OS", description: "Your browser. Your AI. Your control." },
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
