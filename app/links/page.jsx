import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { abs } from "../_lib/site";
import banners from "../../data/banners.json";

export const metadata = {
  title: "リンク集",
  description:
    "AROMA DIAMOND（アロマダイヤモンド）亀戸 のリンク集。求人・メンズエステ関連サイトのご紹介。",
  alternates: { canonical: abs("links/") },
  openGraph: { url: abs("links/"), title: "リンク集｜AROMA DIAMOND 亀戸" },
};

/* 相互リンク（バナー）は data/banners.json で管理（トップページと共通）。
   追加するときは banners.json の items に1件足すだけ。 */
const LINKS = banners.items.map((b) => ({ href: b.href, banner: b.src, w: b.w, h: b.h, label: b.label, alt: b.alt, wide: b.wide }));

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
            AROMA DIAMOND（亀戸）と関わりのあるサイトをご紹介しています。
          </p>
          <ul className="links-list">
            {LINKS.map((l, i) => (
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
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
