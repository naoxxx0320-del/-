// Google Analytics 4（GA4）。
// アクセス解析は原則 Google Tag Manager（GTM）に一本化する。
// GTM が有効なあいだ（既定）は、この独立GA4タグは出力しない＝二重計測を防ぐ。
// GA4 は GTM の管理画面で設定する想定。GTM を外した場合に限り、
// NEXT_PUBLIC_GA_ID が設定されていればこの単独タグで計測する（保険）。
import Script from "next/script";
import { GA_ID, GTM_ID } from "../_lib/site";

export default function Analytics() {
  // GTM があればそちらに集約（二重計測防止）。GA_ID 未設定でも何も壊れない。
  if (GTM_ID) return null;
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
