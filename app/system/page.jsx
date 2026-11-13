import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import { photoSrc } from "../_components/photo";
import { SITE } from "../_lib/site";
import Breadcrumbs from "../_components/Breadcrumbs";
import { pageMetadata } from "../_lib/seo";
import price from "../../data/price.json";

export const metadata = pageMetadata("system");

const yen = (n) => n.toLocaleString("ja-JP") + "円";
const SHI = "全身オイルトリートメント、全身アロママッサージ、ヘッドマッサージ、ディープリンパ";

// 料金・指名料・オプションは data/price.json（トップページの料金まとめと共通）から表示する。
// 金額を変えるときは price.json・reserve-config.json・料金表画像をあわせて更新。
const COURSE_DETAILS = [...price.courses, price.extension];
const FEES = price.fees;
const FEE_NOTES = price.feeNotes;
const OPTIONS = price.options;
const OPTION_NOTES = price.optionNotes;

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
          width="1024"
          height="1536"
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
            <li>※{price.taxNote}</li>
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
            width="1000"
            height="281"
            loading="lazy"
            decoding="async"
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
