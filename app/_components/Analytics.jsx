// Google Analytics 4（GA4）。測定ID（NEXT_PUBLIC_GA_ID）が設定されている
// ときだけタグを出力する。未取得のうちは何もレンダリングしないため無害。
// 取得後の設定手順は README の「アクセス解析（GA4）」を参照。
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
