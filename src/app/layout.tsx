import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Fraunces, JetBrains_Mono, Lexend } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/lib/branding";
import { themeBootScript } from "@/lib/ui-themes";
import { isRevampUi } from "@/lib/ui-flags";
import { readingBootScript } from "@/lib/ui-a11y";

/**
 * Inter — body / UI sans.
 * Stylistic alternates are enabled in globals.css (cv11, ss01, ss03) to
 * push it closer to SF Pro.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Fraunces — display serif. Used for page titles, the wordmark, and
 * editorial moments (lesson titles, course names). Inkwell brand pairing.
 *
 * `opsz` is the optical-size axis — higher values produce more dramatic
 * contrast suitable for large display use. `SOFT` softens the terminals.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Geist and Geist Mono — the revamp's type (REVAMP_UI). `latin-ext` covers
 * Afrikaans and other names with diacritics. Not preloaded: today's UI does
 * not use them, so only revamp pages fetch the files. Inter, Fraunces and
 * JetBrains Mono go when the flag is removed.
 */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

/**
 * Lexend — the dyslexia-friendly reading font (Settings › Reading, #216).
 * Not preloaded: only readers who switch it on fetch it (src/app/a11y.css).
 */
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: {
    title: APP_NAME,
    description: APP_TAGLINE,
    siteName: APP_NAME,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} ${geist.variable} ${geistMono.variable} ${lexend.variable}`}
      data-ui={isRevampUi() ? "revamp" : undefined}
      // The theme script and PreferencesProvider set `dark` / `lang` on the
      // client, so the attributes can legitimately differ from the SSR HTML.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript + readingBootScript }} />
      </head>
      <body className="antialiased">
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
