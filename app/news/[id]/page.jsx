// お知らせ・ブログの記事ページ（/news/<id>/）。静的に書き出すため、公開中の記事だけページを作る。
import { notFound } from "next/navigation";
import SiteChrome from "../../_components/SiteChrome";
import NavGrid from "../../_components/NavGrid";
import Breadcrumbs from "../../_components/Breadcrumbs";
import { photoSrc } from "../../_components/photo";
import { buildMetadata } from "../../_lib/seo";
import { SITE, SITE_URL, abs } from "../../_lib/site";
import { publicPosts, findPost, dateLabel, excerpt, parseBody } from "../../_lib/news";

export const dynamicParams = false;

// 記事が0件でも書き出しが止まらないよう、ダミーの id（検索に出さない空ページ）を1つ用意する
const EMPTY_ID = "none";

export function generateStaticParams() {
  const posts = publicPosts();
  return posts.length ? posts.map((p) => ({ id: p.id })) : [{ id: EMPTY_ID }];
}

export function generateMetadata({ params }) {
  const p = findPost(params.id);
  if (!p) return buildMetadata({ path: `news/${params.id}/`, title: "お知らせ｜AROMA DIAMOND 亀戸", description: "", index: false });
  return buildMetadata({
    path: `news/${p.id}/`,
    title: `${p.title}｜お知らせ｜AROMA DIAMOND 亀戸`,
    // 記事ごとの説明文（description）があればそれを使い、無ければ本文の冒頭から作る
    description: p.description || excerpt(p.body, 110),
    image: p.image || undefined,
  });
}

export default function NewsPost({ params }) {
  const p = findPost(params.id);
  if (!p) notFound();
  const blocks = parseBody(p.body);
  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    datePublished: p.date,
    dateModified: String(p.updatedAt || p.date).slice(0, 10),
    mainEntityOfPage: abs(`news/${p.id}/`),
    ...(p.image ? { image: abs(p.image) } : {}),
    author: { "@type": "Organization", name: SITE.name, url: SITE_URL },
    publisher: { "@id": `${SITE_URL}#business` },
  };
  return (
    <div className="stage">
      <div
        className="device"
        style={{ background: "#f4efe7 url(../../bg-marble.jpg) top center / 100% auto repeat" }}
      >
        <Breadcrumbs
          items={[
            { name: "お知らせ", path: "news/" },
            { name: p.title, path: `news/${p.id}/` },
          ]}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

        <NavGrid base="../../" />

        <article className="rec-sec nw-article">
          <time className="nw-date" dateTime={p.date}>
            {dateLabel(p.date)}
          </time>
          <h1 className="nw-h1">{p.title}</h1>
          {p.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="nw-photo" src={photoSrc(p.image, "../../")} alt={p.title} decoding="async" />
          )}
          <div className="nw-body">
            {blocks.map((lines, i) =>
              lines.heading ? (
                <h2 className="nw-h2" key={i}>
                  {lines.map((parts) => parts.map((x) => x.text).join("")).join(" ")}
                </h2>
              ) : (
              <p key={i}>
                {lines.map((parts, j) => (
                  <span key={j}>
                    {parts.map((x, k) =>
                      x.href ? (
                        <a key={k} href={x.href} {...(x.href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                          {x.text}
                        </a>
                      ) : (
                        <span key={k}>{x.text}</span>
                      )
                    )}
                    {j < lines.length - 1 && <br />}
                  </span>
                ))}
              </p>
              )
            )}
          </div>
          <div className="hp-links">
            <a className="hp-link" href="../">お知らせ一覧</a>
            <a className="hp-link hp-link-dark" href="../../reserve/">WEB予約へ進む</a>
          </div>
        </article>

        <SiteChrome base="../../" />
      </div>
    </div>
  );
}
