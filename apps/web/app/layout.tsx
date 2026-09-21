import type { Metadata, Viewport } from "next";
import "./styles.css";
import { getPublicSiteOrigin } from "../lib/site-origin";

const publicSiteOrigin = getPublicSiteOrigin();

export const metadata: Metadata = {
  ...(publicSiteOrigin ? { metadataBase: new URL(publicSiteOrigin) } : {}),
  title: "ClaimGrid — Find your ground",
  description:
    "Research federal mineral lands and organize a mining claim from map to filing.",
  applicationName: "ClaimGrid",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "ClaimGrid", statusBarStyle: "black-translucent" },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#172018" }
  ],
  colorScheme: "light dark"
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skipLink" href="#main-content">Skip to main content</a>
        <div id="main-content" tabIndex={-1}>{children}</div>
      </body>
    </html>
  );
}
