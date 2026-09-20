// robots.txt を静的生成する。/secret はクロール対象外にする。
// ※GitHub のプロジェクトページ（/-/ 配下）では robots.txt がサイト直下に
//   置けないため検索エンジンには読まれない。独自ドメイン導入後に有効化される。
import { abs, SITE_URL } from "./_lib/site";

export const dynamic = "force-static";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/secret/"],
    },
    sitemap: abs("sitemap.xml"),
    host: SITE_URL,
  };
}
