import type { Metadata, Viewport } from "next";
import { LeoShell } from "@/components/sites/leoparpeix/shell/LeoShell";
import "./globals.css";

const description =
  "Portfolio of Peanutto, fullstack software engineer. Front end, back end, load balancing, AWS cloud, machine learning, deep learning and computer vision projects.";

export const metadata: Metadata = {
  title: "Peanutto — Fullstack, Cloud & ML engineer",
  description,
  applicationName: "Peanutto",
  authors: [{ name: "Peanutto" }],
  robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Peanutto",
    title: "Peanutto — Fullstack, Cloud & ML engineer",
    description,
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  themeColor: "#083D2A",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/sites/leoparpeix/assets/fonts/monumentgrotesk-regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/sites/leoparpeix/assets/fonts/avantt-variable.ttf" as="font" type="font/ttf" crossOrigin="" />
      </head>
      <body>
        <LeoShell>{children}</LeoShell>
      </body>
    </html>
  );
}
