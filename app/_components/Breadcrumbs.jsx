// パンくずリスト。画面上の表示と構造化データ（BreadcrumbList JSON-LD）を
// 同じ items から出力し、内容を必ず一致させる。
// items: [{ name, path }]（path はルート相対 例 "system/"）。先頭にホームを自動付与。
// visible={false} のときは JSON-LD だけ、jsonld={false} のときは画面表示だけを出す
// （クライアント描画のページでは JSON-LD をサーバー側レイアウトから出すため）。
import { SITE_URL, abs } from "../_lib/site";

export default function Breadcrumbs({ items = [], visible = true, jsonld = true }) {
  const list = [
    { name: "ホーム", path: "", url: SITE_URL },
    ...items.map((i) => ({ name: i.name, path: i.path, url: abs(i.path) })),
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
    <>
      {visible && (
        <nav className="crumbs" aria-label="パンくずリスト">
          <ol>
            {list.map((x, i) =>
              i < list.length - 1 ? (
                <li key={i}>
                  <a href={`/${x.path}`}>{x.name}</a>
                </li>
              ) : (
                <li key={i} aria-current="page">
                  {x.name}
                </li>
              )
            )}
          </ol>
        </nav>
      )}
      {jsonld && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      )}
    </>
  );
}
