import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import { photoSrc } from "../_components/photo";
import { SITE } from "../_lib/site";
import Breadcrumbs from "../_components/Breadcrumbs";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata("system");

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

// 入会金・指名料／オプション（料金表画像と同じ内容をテキストでも掲載。金額を変えるときは画像も更新）
const FEES = [
  ["入会金", "無料"],
  ["写真指名", 1000],
  ["本指名", 1000],
  ["姫指名", 2000],
];
const FEE_NOTES = ["姫指名はセラピスト経由のご予約です。", "姫指名と本指名の料金は重複しません。"];
const OPTIONS = [
  ["パウダートリートメント", 1000],
  ["ホイップトリートメント", 2000],
  ["衣装チェンジ", 3000],
];
const OPTION_NOTES = [
  "ホットオイル・リンパトリートメントはコースに含まれます（追加料金なし）。",
  "オプションはコース時間内での対応となります。",
  "対応可能なオプションは担当者により異なります。",
];

// 特定商取引法に基づく表示（法定表示）
const TOKUSHO = [
  ["事業者名", "アロマダイヤモンド"],
  ["運営責任者", "馬渡 俊輔"],
  ["所在地", "〒136-0071 東京都江東区亀戸5丁目15-13"],
  ["電話番号", SITE.telephoneDisplay],
  ["メールアドレス", "aromadiamond00@gmail.com"],
  ["販売価格", "本ページに記載の料金表をご参照ください"],
  [
    "サービスの引き渡し時期",
    "お支払い確認後、24時間以内にお電話もしくはメールにてご案内",
  ],
  ["お支払い時期", "前払いのみ"],
  ["お支払い方法", "現金、クレジットカード"],
  [
    "返品規約",
    "サービスの特性上、お支払いいただいた料金の返金には応じられません。",
  ],
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
        <Breadcrumbs items={[{ name: "料金・コース案内", path: "system/" }]} />

        <div className="page-head">
          <div className="ph-en">System</div>
          <h1 className="ph-jp ph-long">亀戸メンズエステの料金・コース案内</h1>
        </div>

        <NavGrid base="../" />

        {/* ---- 料金表（画像） ---- */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="sys-img"
          src={photoSrc("system-price.jpg", "../")}
          alt="料金表：60分13,000円、70分あおむけ18,000円、90分18,000円、120分23,000円、150分28,000円、延長30分6,000円。指名料・オプションは下記に記載｜AROMA DIAMOND 亀戸"
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

        {/* ---- 指名料・オプション（テキスト版） ---- */}
        <section className="rec-sec sys-fees" aria-labelledby="sys-fees-h">
          <div className="rec-sec-h">
            <span className="rec-sec-en">Fee &amp; Option</span>
            <h2 className="rec-sec-jp" id="sys-fees-h">指名料・オプション料金</h2>
          </div>
          <div className="sys-fee-group">
            <div className="sys-fee-gh">入会金・指名料</div>
            <dl className="sys-fee-list">
              {FEES.map(([k, v]) => (
                <div className="sys-fee-row" key={k}>
                  <dt>{k}</dt>
                  <dd>{typeof v === "number" ? yen(v) : v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <ul className="sys-fees-notes">
            {FEE_NOTES.map((n) => (
              <li key={n}>※{n}</li>
            ))}
          </ul>
          <div className="sys-fee-group">
            <div className="sys-fee-gh">オプション</div>
            <dl className="sys-fee-list">
              {OPTIONS.map(([k, v]) => (
                <div className="sys-fee-row" key={k}>
                  <dt>{k}</dt>
                  <dd>{yen(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <ul className="sys-fees-notes">
            {OPTION_NOTES.map((n) => (
              <li key={n}>※{n}</li>
            ))}
            <li>※表示価格はすべて税込です。</li>
          </ul>
          <a className="sys-reserve-link" href="../reserve/">
            料金を確認してWEB予約へ進む →
          </a>
        </section>

        {/* ---- お支払いについて（クレジット決済バナー） ---- */}
        <section className="sys-pay">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="sys-pay-img"
            src={photoSrc("payment-credit.jpg", "../")}
            alt="クレジット決済可能（VISA／Mastercard／JCB／AMERICAN EXPRESS／Diners Club／Clickで決済）。決済前は必ずお電話にて金額をお確かめください｜AROMA DIAMOND 亀戸"
          />
          <p className="sys-pay-note">
            現金・各種クレジットカードがご利用いただけます。
          </p>
        </section>

        {/* ---- 特定商取引法に基づく表示 ---- */}
        <section className="rec-sec tokusho" id="tokusho">
          <div className="rec-sec-h">
            <span className="rec-sec-en">Legal</span>
            <h2 className="rec-sec-jp">特定商取引法に基づく表示</h2>
          </div>
          <table className="rec-table tokusho-table">
            <tbody>
              {TOKUSHO.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tokusho-note">
            その他、ご不明な点がございましたらお問い合わせください。
          </p>
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
