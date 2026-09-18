import SiteChrome from "../_components/SiteChrome";

export const metadata = {
  title: "料金システム｜AROMA DAIAMOND 亀戸 メンズエステ",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 メンズエステの料金システム・コース・オプション一覧。",
};

const yen = (n) => n.toLocaleString("ja-JP") + "円";
const SHI = "全身オイルトリートメント、全身アロママッサージ、ヘッドマッサージ、ディープリンパ";

// COURSE LIST（表示用の一覧）
const COURSE_ROWS = [
  { nm: "60分コース", pr: yen(15000) },
  { nm: "70分オールあおむけコース", pr: yen(19000) },
  { nm: "90分コース", pr: yen(19000) },
  { nm: "120分コース", pr: yen(24000) },
  { nm: "150分コース", pr: yen(29000) },
  { nm: "延長30分", pr: yen(7000) },
];

const COURSE_NOTES = [
  "※入室後のコース変更はお断りしております。",
  "※延長ご希望の場合はセラピストにお申しつけください。",
  "※150分以上のコースは本指名様のみのコースとなっております。",
];

// 指名・入会
const NOM_ROWS = [
  { nm: "入会金", pr: "2,000円 → 0円" },
  { nm: "写真指名", pr: yen(1000) },
  { nm: "本指名", pr: yen(1000) },
  { nm: "姫予約", pr: yen(2000) },
];

// OPTION menu（名称は当店仕様に変更）
const OPTION_ROWS = [
  { nm: "大量ホットオイル", pr: "無料" },
  { nm: "ディープリンパマッサージ", pr: "無料" },
  { nm: "パウダーマッサージ", pr: yen(1000) },
  { nm: "ホイップトリートメント", pr: yen(2000) },
  { nm: "ダイヤプラス（ディープリンパ）", pr: "1,000円 / 10分" },
  { nm: "ダイヤアップ（衣装チェンジ）", pr: yen(2000) },
];

const TAX_NOTES = [
  "※クレジット決済10%・PayPay決済5%のTAXをいただきます。",
  "※海外製のクレジットカードはご使用できません。",
];

// 各コースの説明（＋1,000版の料金に合わせて表示）
const COURSE_DETAILS = [
  {
    title: "60分コース",
    price: 15000,
    desc: "短いお時間ですが、当店の施術を一通りお楽しみいただけます。あまり「お時間がない方」や「まずはお試し」という方にお勧めのコースです。",
  },
  {
    title: "70分オールあおむけコース",
    price: 19000,
    desc: "うつぶせが苦手なお客様でも最初から最後まで楽しんでいただく事が可能な、オールあおむけコースとなります。",
  },
  {
    title: "90分コース",
    price: 19000,
    desc: "当店の基本となるコースになります。全身アロマ＆リンパマッサージとご希望の箇所を重点的にマッサージするフリーマッサージがつきます。",
  },
  {
    title: "120分コース",
    price: 24000,
    hi: "当店の一番人気",
    desc: "のコースになります。全身アロマ＆リンパマッサージとご希望の箇所を重点的にマッサージするフリーマッサージがつきます。",
  },
  {
    title: "150分コース",
    price: 29000,
    hi: "本指名のセラピストにのみ",
    desc: "ご利用いただける特別なコースです。全身アロマ＆リンパマッサージとご希望の箇所を重点的にマッサージするフリーマッサージがつきます。",
  },
  {
    title: "延長30分",
    price: 7000,
    desc: "担当セラピストに直接お申し出下さい。尚ご予約の都合上お断りさせて頂く場合がございます。",
    note: "※本指名のご予約に限りますが、150分より長いお時間でのご利用も承っております。お問い合わせ時にお気軽にお尋ねください。",
  },
];

function Row({ nm, pr }) {
  return (
    <div className="sys-row">
      <span className="nm">{nm}</span>
      <span className="dots" />
      <span className="pr">{pr}</span>
    </div>
  );
}

function Dia({ cls }) {
  return (
    <svg className={`sys-dia ${cls}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 9 L12 2.5 L19.5 9 L12 21.5 Z" fill="none" stroke="#c8a659" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M4.5 9 H19.5 M9 9 L12 21.5 M15 9 L12 21.5 M9 9 L12 2.5 M15 9 L12 2.5" fill="none" stroke="#c8a659" strokeWidth="0.8" />
    </svg>
  );
}

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
        <div className="page-head">
          <div className="ph-en">System</div>
          <div className="ph-jp">料金システム</div>
        </div>

        <div className="sys-wrap">
          {/* ---- COURSE LIST / 指名 / OPTION ---- */}
          <section className="sys-card">
            <Dia cls="tl" />
            <Dia cls="tr" />
            <Dia cls="bl" />
            <Dia cls="br" />

            <div className="sys-cardhead">
              <div className="en">
                COURSE<small>list</small>
              </div>
            </div>

            <div className="sys-list">
              {COURSE_ROWS.map((r) => (
                <Row key={r.nm} {...r} />
              ))}
            </div>
            <div className="sys-notes">
              {COURSE_NOTES.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>

            <div className="sys-divider" />
            <div className="sys-list">
              {NOM_ROWS.map((r) => (
                <Row key={r.nm} {...r} />
              ))}
            </div>

            <div className="sys-subhead">
              OPTION<small>menu</small>
            </div>
            <div className="sys-list">
              {OPTION_ROWS.map((r) => (
                <Row key={r.nm} {...r} />
              ))}
            </div>
            <div className="sys-notes">
              {TAX_NOTES.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>
          </section>

          {/* ---- 各コースの説明 ---- */}
          <div className="sys-subhead2">
            <span className="en">Course</span>
            <span className="jp">コース詳細</span>
          </div>

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
        </div>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
