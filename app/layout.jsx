import "./globals.css";
import { SITE, SITE_URL, abs, GTM_ID } from "./_lib/site";
import { PAGES, buildMetadata } from "./_lib/seo";
import Analytics from "./_components/Analytics";
import ClickTracking from "./_components/ClickTracking";
import AiChat from "./_components/AiChat";
import ScrollReveal from "./_components/ScrollReveal";

// スクロール演出の初期状態を最初の描画前に適用（＝チラつき防止）。
// 動きを控える設定のユーザーには付与せず、初期化されなければ自動解除する。
const REVEAL_BOOT = `(function(){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var r=document.documentElement;r.classList.add('reveal-ready');setTimeout(function(){if(!window.__revealInit)r.classList.remove('reveal-ready');},2500);}catch(e){}})();`;

// Google Tag Manager（コンテナIDは site.js で一元管理）。
const GTM_HEAD = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`;

// サイト共通の既定値。各ページは app/_lib/seo.js の pageMetadata() で
// title・description・canonical・OGP をページごとに上書きする。
// canonical はここでは付けない（未設定ページ＝404 等がトップを指す誤りを防ぐ）。
const home = PAGES.home;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: home.title,
    template: `%s｜${SITE.name} ${SITE.area}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  manifest: abs("manifest.webmanifest"),
  icons: {
    icon: [
      { url: abs("favicon.ico"), sizes: "any" },
      { url: abs("icon-192.png"), type: "image/png", sizes: "192x192" },
      { url: abs("icon-512.png"), type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: abs("apple-touch-icon.png"), sizes: "180x180" }],
    shortcut: [{ url: abs("favicon.ico") }],
  },
  openGraph: buildMetadata(home).openGraph,
  twitter: buildMetadata(home).twitter,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // ユーザーの拡大操作を許可（アクセシビリティ）。maximumScale で固定しない。
  themeColor: "#2a0a0d",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" suppressHydrationWarning>
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
        <ClickTracking />
        <ScrollReveal />
      </body>
    </html>
  );
}
