import type { Metadata, Viewport } from "next";
import { Inter, Archivo_Black, JetBrains_Mono } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const archivoBlack = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://yellowline.example"),
  title: "Yellow Line Taxi — 24/7 Local Cabs & Airport Transfers",
  description:
    "Licensed local taxi service in Riverside since 1998. Fixed airport fares, 24/7 dispatch, card payment in every cab. Book online or call for a cab in minutes.",
  openGraph: {
    type: "website",
    title: "Yellow Line Taxi — 24/7 Local Cabs & Airport Transfers",
    description:
      "Licensed local taxi service. Fixed airport fares, 24/7 dispatch, card payment in every cab.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0b",
};

/** Local-business structured data so the firm can surface in local search. */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TaxiService",
  name: site.name,
  telephone: site.phone,
  email: site.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: "142 Depot Street",
    addressLocality: "Riverside",
  },
  openingHours: "Mo-Su 00:00-23:59",
  areaServed: "Riverside and surrounding villages",
  foundingDate: site.since,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The head script adds `.anim` before hydration, so the server and
      // client class lists differ by design.
      suppressHydrationWarning
      className={`${inter.variable} ${archivoBlack.variable} ${jetbrainsMono.variable} min-h-full antialiased`}
    >
      <head>
        {/*
          Runs before first paint so the page never flashes the wrong
          experience: `anim` gates the CSS animations, `drive-3d` gates the
          first-person drive. The drive is only switched on when motion is
          welcome, WebGL actually works, and the visitor hasn't already asked
          to skip it this session.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,m=!matchMedia('(prefers-reduced-motion: reduce)').matches;if(m){d.classList.add('anim')}var g=false;try{var c=document.createElement('canvas');g=!!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(e){}var s=false;try{s=sessionStorage.getItem('yl-drive')==='off'}catch(e){}if(m&&g&&!s){d.classList.add('drive-3d')}}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-ink text-cream flex min-h-full flex-col">
        <a
          href="#main"
          className="font-display sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:border-2 focus:border-ink focus:bg-yellow focus:px-5 focus:py-3 focus:text-ink"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
