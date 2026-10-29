import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import banners from "../../data/banners.json";
import RelaxiTimeline from "../_components/RelaxiTimeline";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata("links");

/* 相互リンク（バナー）は data/banners.json で管理（トップページと共通）。
   追加するときは banners.json の items に1件足すだけ。 */
const LINKS = banners.items.map((b) => ({ href: b.href, banner: b.src, w: b.w, h: b.h, label: b.label, alt: b.alt, wide: b.wide, group: b.group }));

// お客様向けと求人向けを分けて表示（group 未設定は「その他」）
const GROUPS = [
  { key: "guest", h: "お客様向け（店舗情報・メンズエステ情報サイト）", lead: "AROMA DIAMOND の店舗情報や、亀戸・錦糸町エリアのメンズエステ情報を掲載しているサイトです。" },
  { key: "recruit", h: "セラピスト求人向け（求人情報サイト）", lead: "AROMA DIAMOND のセラピスト求人を掲載している求人情報サイトです。" },
  { key: "other", h: "その他のリンク", lead: "" },
];

export default function Links() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background:
            "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: "リンク集", path: "links/" }]} />
        <div className="page-head">
          <div className="ph-en">Link</div>
          <h1 className="ph-jp">リンク集</h1>
        </div>

        <NavGrid base="../" />

        <section className="links">
          <p className="links-lead">
            AROMA DIAMOND（亀戸）を掲載している情報サイト・求人サイトをご紹介しています。
          </p>
          {GROUPS.filter((g) => LINKS.some((l) => (l.group || "other") === g.key)).map((g) => (
            <div className="links-group" key={g.key}>
              <h2 className="links-group-h">{g.h}</h2>
              {g.lead && <p className="links-lead">{g.lead}</p>}
              <ul className="links-list">
                {LINKS.filter((l) => (l.group || "other") === g.key).map((l, i) => (
                  <li className={`link-item${l.wide ? " wide" : ""}`} key={i}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.banner && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="link-banner"
                          src={l.banner}
                          alt={l.alt || l.label}
                          width={l.w}
                          height={l.h}
                          loading="lazy"
                        />
                      )}
                      <span className="link-label">{l.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <RelaxiTimeline />

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
