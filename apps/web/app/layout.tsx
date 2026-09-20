import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "ClaimGrid — Find your ground",
  description:
    "Research federal mineral lands and organize a mining claim from map to filing.",
  applicationName: "ClaimGrid",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
