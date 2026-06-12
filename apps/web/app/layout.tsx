import { getLocale } from "@calcom/features/auth/lib/getLocale";
import { loadTranslations } from "@calcom/i18n/server";
import { IconSprites } from "@calcom/ui/components/icon";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { dir } from "i18next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import type React from "react";

import "../styles/globals.css";
import { AppRouterI18nProvider } from "./AppRouterI18nProvider";
import { Providers } from "./providers";
import { SpeculationRules } from "./SpeculationRules";

const interFont = Inter({ subsets: ["latin"], variable: "--font-sans", preload: true, display: "swap" });
const calFont = localFont({
  src: "../fonts/CalSans-SemiBold.woff2",
  variable: "--font-cal",
  preload: true,
  display: "block",
  weight: "600",
});

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#f9fafb",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#1C1C1C",
    },
  ],
};

// basePath prefix: when NEXT_PUBLIC_BASE_PATH is set (e.g.
// "/cal-diy-iframe" for the PM Hub embed), Next.js does NOT auto-prefix
// metadata.icons / metadata.manifest. We have to do it manually so the
// browser resolves these against the cal.diy origin under basePath,
// not against the parent (PM Hub) origin which 401s them.
// vercel/next.js#56687, #61487, #18535.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata = {
  icons: {
    icon: `${BASE_PATH}/api/logo?type=favicon-32`,
    apple: `${BASE_PATH}/api/logo?type=apple-touch-icon`,
    other: [
      {
        rel: "icon-mask",
        url: `${BASE_PATH}/safari-pinned-tab.svg`,
        color: "#000000",
      },
      {
        url: `${BASE_PATH}/api/logo?type=favicon-16`,
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: `${BASE_PATH}/api/logo?type=favicon-32`,
        sizes: "32x32",
        type: "image/png",
      },
    ],
  },
  manifest: `${BASE_PATH}/site.webmanifest`,
  other: {
    "application-TileColor": "#ff0000",
  },
  twitter: {
    site: "@calcom",
    creator: "@calcom",
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const getInitialProps = async () => {
  const h = await headers();
  const isEmbed = h.get("x-isEmbed") === "true";
  const embedColorScheme = h.get("x-embedColorScheme");
  const newLocale = (await getLocale(buildLegacyRequest(await headers(), await cookies()))) ?? "en";
  const direction = dir(newLocale) ?? "ltr";

  return {
    isEmbed,
    embedColorScheme,
    locale: newLocale,
    direction,
  };
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const nonce = h.get("x-csp-nonce") ?? "";

  const country = h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || "Unknown";

  const { locale, direction, isEmbed, embedColorScheme } = await getInitialProps();

  const ns = "common";
  const translations = await loadTranslations(locale, ns);

  return (
    <html
      className="notranslate"
      translate="no"
      lang={locale}
      dir={direction}
      style={embedColorScheme ? { colorScheme: embedColorScheme as string } : undefined}
      suppressHydrationWarning
      data-nextjs-router="app">
      <head nonce={nonce}>
        <style>{`
          :root {
            --font-sans: ${interFont.style.fontFamily.replace(/\'/g, "")};
            --font-cal: ${calFont.style.fontFamily.replace(/\'/g, "")};
          }
        `}</style>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
            data-options='{"activationKey":"Meta+c"}'
          />
        )}
      </head>
      <body
        className="dark:bg-default bg-subtle antialiased"
        style={
          isEmbed
            ? {
                background: "transparent",
                // Keep the embed hidden till parent initializes and
                // - gives it the appropriate styles if UI instruction is there.
                // - gives iframe the appropriate height(equal to document height) which can only be known after loading the page once in browser.
                // - Tells iframe which mode it should be in (dark/light) - if there is a a UI instruction for that
                visibility: "hidden",
                // This in addition to visibility: hidden is to ensure that elements with specific opacity set are not visible
                opacity: 0,
              }
            : {
                visibility: "visible",
                opacity: 1,
              }
        }>
        <IconSprites />
        <SpeculationRules
          // URLs In Navigation
          prerenderPathsOnHover={[
            "/event-types",
            "/availability",
            "/bookings/upcoming",
            "/teams",
            "/apps",
          ]}
        />

        <Providers isEmbed={isEmbed} nonce={nonce} country={country}>
          <AppRouterI18nProvider translations={translations} locale={locale} ns={ns}>
            {children}
          </AppRouterI18nProvider>
        </Providers>
      </body>
    </html>
  );
}
