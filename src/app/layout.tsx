import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import AppShell from "./_shell/AppShell";
import "./globals.css";

// Self-hosted via next/font: removes the render-blocking fonts.googleapis.com
// request. Exposed as CSS variables consumed by the --font/--mono tokens in
// globals.css. This also keeps the strict CSP in next.config.mjs honest —
// there is no external font origin to allow-list.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://prompt.phbeks.com"),
  title: {
    default: "Prompt Composer — local-first prompt engineering",
    template: "%s | Prompt Composer",
  },
  description:
    "A prompt engineering workbench that runs entirely in your browser. Bring your own API key; prompts and keys are encrypted locally and never touch a server. Open source, MIT licensed.",
  keywords: [
    "prompt composer",
    "prompt engineering",
    "local-first",
    "BYOK",
    "open source prompt tool",
    "multi-agent orchestration",
    "AI eval",
  ],
  authors: [{ name: "phbeks" }],
  creator: "phbeks",
  openGraph: {
    type: "website",
    url: "https://prompt.phbeks.com",
    siteName: "Prompt Composer",
    title: "Prompt Composer — local-first prompt engineering",
    description:
      "A prompt engineering workbench that runs entirely in your browser. Bring your own key; nothing is stored on a server.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prompt Composer — local-first prompt engineering",
    description:
      "A prompt engineering workbench that runs entirely in your browser. Bring your own key; nothing is stored on a server.",
  },
  alternates: { canonical: "https://prompt.phbeks.com" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c0f16",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
