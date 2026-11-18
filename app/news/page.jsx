// お知らせ・ブログ一覧（/news/）。記事は管理画面の「お知らせ」から投稿（data/news.json）。
import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { photoSrc } from "../_components/photo";
import { pageMetadata } from "../_lib/seo";
import { publicPosts, dateLabel, excerpt } from "../_lib/news";

export const metadata = pageMetadata("news");

export default function News() {
  const posts = publicPosts();
  return (
    <div className="stage">
      <div
        className="device"
        style={{ background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat" }}
      >
        <Breadcrumbs items={[{ name: "お知らせ", path: "news/" }]} />

        <div className="page-head">
          <div className="ph-en">News</div>
          <h1 className="ph-jp">お知らせ・ブログ</h1>
        </div>

        <NavGrid base="../" />

        <section className="rec-sec nw-sec">
          {posts.length === 0 && <p className="nw-empty">お知らせは準備中です。</p>}
          <ul className="nw-list">
            {posts.map((p) => (
              <li key={p.id}>
                <a className="nw-item" href={`./${encodeURIComponent(p.id)}/`}>
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="nw-thumb" src={photoSrc(p.image, "../")} alt="" loading="lazy" width="120" height="90" />
                  )}
                  <span className="nw-txt">
                    <time className="nw-date" dateTime={p.date}>
                      {dateLabel(p.date)}
                    </time>
                    <span className="nw-title">{p.title}</span>
                    <span className="nw-ex">{excerpt(p.body, 60)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
