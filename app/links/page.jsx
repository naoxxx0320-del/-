import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { abs } from "../_lib/site";

export const metadata = {
  title: "リンク集",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 のリンク集。求人・メンズエステ関連サイトのご紹介。",
  alternates: { canonical: abs("links/") },
  openGraph: { url: abs("links/"), title: "リンク集｜AROMA DAIAMOND 亀戸" },
};

/* 相互リンク（バナー）。
   banner: バナー画像URL（外部URL可）／ w,h: バナーサイズ／ label: サイト名。
   追加するときはこの配列に1件足すだけ。 */
const LINKS = [
  {
    href: "https://www.fues.jp/job/kanto/ippan/top.html",
    banner: "https://www.fues.jp/upload/banners/job_200.gif",
    w: 200,
    h: 40,
    label: "週刊エステ求人",
  },
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
            AROMA DAIAMOND（亀戸）と関わりのあるサイトをご紹介しています。
          </p>
          <ul className="links-list">
            {LINKS.map((l, i) => (
              <li className="link-item" key={i}>
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.banner && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="link-banner"
                      src={l.banner}
                      alt={l.label}
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
