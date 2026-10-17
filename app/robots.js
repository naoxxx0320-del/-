// robots.txt を静的生成する。
// 公開ページ・CSS・JS・画像のクロールは妨げない。
// 検索に出したくないページ（/secret/ 等）は各ページの noindex で制御する。
// robots.txt で遮断すると noindex が読まれず URL だけ登録されることがあるため、ここでは遮断しない。
// ※robots.txt はアクセス制限ではない（機密の保護には使わない）。
import { abs } from "./_lib/site";

export const dynamic = "force-static";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: abs("sitemap.xml"),
  };
}
