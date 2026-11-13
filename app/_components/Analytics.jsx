// Google Analytics 4（GA4）。
// アクセス解析は gtag.js でコードから直接配信する（GTM経由にしない）。
// ※GTM 側に GA4 設定タグを作らないこと。作ると二重計測になる。
// GA_ID（site.js）が空のときは何も出力しない。
// ※個人情報・鍵（URLの ?k= など）は送らない。
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
          // シフト入力URL・デジタル会員証のURLに含まれる鍵（?k=…）を解析に送らない。
          // 鍵を取り除いたURLを page_location / page_referrer として渡す。
          function adClean(u){
            try {
              if (!u) return u;
              var x = new URL(u, location.href);
              ['k','token','key'].forEach(function(n){ x.searchParams.delete(n); });
              x.hash = '';
              return x.toString();
            } catch (e) { return location.origin + location.pathname; }
          }
          gtag('config', '${GA_ID}', {
            page_location: adClean(location.href),
            page_referrer: adClean(document.referrer) || undefined
          });
        `}
      </Script>
    </>
  );
}
