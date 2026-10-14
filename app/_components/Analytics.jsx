// Google Analytics 4（GA4）。
// アクセス解析は gtag.js でコードから直接配信する（GTM経由にしない）。
// ※GTM 側に GA4 設定タグを作らないこと。作ると二重計測になる。
// GA_ID（site.js）が空のときは何も出力しない。
import Script from "next/script";
import { GA_ID } from "../_lib/site";

export default function Analytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
