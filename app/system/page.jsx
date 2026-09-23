import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import { photoSrc } from "../_components/photo";
import { abs } from "../_lib/site";
import Breadcrumbs from "../_components/Breadcrumbs";

export const metadata = {
  title: "料金システム",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 メンズエステの料金システム・コース・オプション一覧。",
  alternates: { canonical: abs("system/") },
  openGraph: { url: abs("system/"), title: "料金システム｜AROMA DAIAMOND 亀戸" },
};

const yen = (n) => n.toLocaleString("ja-JP") + "円";
const SHI = "全身オイルトリートメント、全身アロママッサージ、ヘッドマッサージ、ディープリンパ";

// 各コースの説明（＋1,000版の料金に合わせて表示）
const COURSE_DETAILS = [
  {
    title: "60分コース",
    price: 13000,
    hi: "当日予約・空き枠限定",
    desc: "のコースです。短いお時間ですが、当店の施術を一通りお楽しみいただけます。「お時間がない方」や「まずはお試し」という方にお勧めです。",
  },
  {
    title: "70分あおむけコース",
    price: 18000,
    desc: "うつぶせが苦手なお客様でも最初から最後まで楽しんでいただく事が可能な、オールあおむけコースとなります。",
  },
  {
    title: "90分コース",
    price: 18000,
    desc: "当店の基本となるコースになります。全身アロマ＆リンパマッサージとご希望の箇所を重点的にマッサージするフリーマッサージがつきます。",
  },
  {
    title: "120分コース",
    price: 23000,
    hi: "おすすめ",
    desc: "のコースです。全身アロマ＆リンパマッサージとご希望の箇所を重点的にマッサージするフリーマッサージがつきます。",
  },
  {
    title: "150分コース",
    price: 28000,
    hi: "本指名のセラピストにのみ",
    desc: "ご利用いただける特別なコースです。全身アロマ＆リンパマッサージとご希望の箇所を重点的にマッサージするフリーマッサージがつきます。",
  },
  {
    title: "延長30分",
    price: 6000,
    desc: "担当セラピストに直接お申し出下さい。尚ご予約の都合上お断りさせて頂く場合がございます。",
    note: "※本指名のご予約に限りますが、150分より長いお時間でのご利用も承っております。お問い合わせ時にお気軽にお尋ねください。",
  },
];

export default function System() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background:
            "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: "料金システム", path: "system/" }]} />

        <div className="page-head">
          <div className="ph-en">System</div>
          <h1 className="ph-jp">料金システム</h1>
        </div>

        <NavGrid base="../" />

        {/* ---- 料金表（画像） ---- */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="sys-img"
          src={photoSrc("system-price.jpg", "../")}
          alt="料金システム COURSE LIST／OPTION menu｜AROMA DAIAMOND 亀戸"
        />

        {/* ---- 各コースの説明 ---- */}
        <div className="sys-detail-head">
          <span className="en">Course</span>
          <span className="jp">コース詳細</span>
        </div>

        <section className="sys-courses">
          {COURSE_DETAILS.map((c) => (
            <article className="sys-course" key={c.title}>
              <div className="sys-c-head">
                {c.title} {yen(c.price)}
              </div>
              <div className="sys-c-body">
                <p className="sys-c-desc">
                  {c.hi && <b className="sys-hi">{c.hi}</b>}
                  {c.desc}
                </p>
                {c.note ? (
                  <p className="sys-c-note">{c.note}</p>
                ) : (
                  <p className="sys-c-shi">施術内容：{SHI}</p>
                )}
              </div>
            </article>
          ))}
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
