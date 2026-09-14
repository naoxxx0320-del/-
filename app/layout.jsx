import "./globals.css";

export const metadata = {
  title: "DIAMOND Jewels｜ダイヤモンドジュエルズ｜亀戸 メンズエステ",
  description:
    "宝石のように美しいセラピスト達。極上の癒しと刺激の空間 men's esthetic DIAMOND Jewels（ダイヤモンドジュエルズ）亀戸。",
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
      </head>
      <body>{children}</body>
    </html>
  );
}
