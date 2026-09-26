import "./globals.css";
import { SITE, SITE_URL, abs } from "./_lib/site";
import StructuredData from "./_components/StructuredData";
import Analytics from "./_components/Analytics";
import AiChat from "./_components/AiChat";
import ScrollReveal from "./_components/ScrollReveal";

// スクロール演出の初期状態を最初の描画前に適用（＝チラつき防止）。
// 動きを控える設定のユーザーには付与せず、初期化されなければ自動解除する。
const REVEAL_BOOT = `(function(){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var r=document.documentElement;r.classList.add('reveal-ready');setTimeout(function(){if(!window.__revealInit)r.classList.remove('reveal-ready');},2500);}catch(e){}})();`;

// Google Tag Manager コンテナID（aroma-daiamond.com 用）
const GTM_ID = "GTM-M4CPNNDT";
const GTM_HEAD = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`;

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
  manifest: abs("manifest.webmanifest"),
  icons: {
    icon: [{ url: abs("icon.svg"), type: "image/svg+xml" }],
    apple: [{ url: abs("icon.svg") }],
  },
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
  themeColor: "#2a0a0d",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        {/* Google Tag Manager（なるべく head 上部） */}
        <script dangerouslySetInnerHTML={{ __html: GTM_HEAD }} />
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
        <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
        {/* JS無効時は隠し状態を無効化して全内容を表示 */}
        <noscript>
          <style>{`.reveal-ready [class]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body>
        {/* Google Tag Manager (noscript) — body 直後 */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
          }}
        />
        {children}
        <AiChat />
        <Analytics />
        <ScrollReveal />
      </body>
    </html>
  );
}
