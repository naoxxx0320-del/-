import "./globals.css";
import { SITE, SITE_URL, abs } from "./_lib/site";
import StructuredData from "./_components/StructuredData";
import Analytics from "./_components/Analytics";

const siteTitle = `${SITE.name}｜${SITE.nameJa}｜${SITE.area} メンズエステ`;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: siteTitle,
    template: `%s｜${SITE.name} ${SITE.area}`,
  },
  description: SITE.description,
  keywords: [
    "メンズエステ",
    SITE.area,
    "亀戸 メンズエステ",
    "アロマ",
    "リラクゼーション",
    SITE.name,
    SITE.nameJa,
  ],
  applicationName: SITE.name,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    siteName: SITE.name,
    title: siteTitle,
    description: SITE.description,
    url: SITE_URL,
    images: [
      {
        url: abs(SITE.ogImage),
        width: 1200,
        height: 630,
        alt: `${SITE.name}（${SITE.nameJa}）${SITE.area}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: SITE.description,
    images: [abs(SITE.ogImage)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Progressive enhancement: elegant serifs load when available,
            otherwise strong system serif fallbacks defined in globals.css apply. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Shippori+Mincho:wght@400;500;600;700;800&family=Zen+Old+Mincho:wght@400;500;600;700;900&display=swap"
          rel="stylesheet"
        />
        <StructuredData />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
