// パンくずリストの構造化データ（BreadcrumbList JSON-LD）。
// 検索結果にサイト階層を表示させ、下層ページの見え方を改善する。
// 表示上のパンくずは出さず、SEO用のメタ情報のみを出力する。
// items: [{ name, path }]（path はルート相対 例 "system/"）。先頭にホームを自動付与。
import { SITE_URL, abs } from "../_lib/site";

export default function Breadcrumbs({ items = [] }) {
  const list = [
    { name: "ホーム", url: SITE_URL },
    ...items.map((i) => ({ name: i.name, url: abs(i.path) })),
  ];
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: list.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.name,
      item: x.url,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
