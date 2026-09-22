import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import { abs } from "../_lib/site";
import Breadcrumbs from "../_components/Breadcrumbs";
import links from "../../data/links.json";

export const metadata = {
  title: "アクセス",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 へのアクセス。JR亀戸駅から徒歩圏内。詳しい所在地はご予約確定後にご案内します。",
  alternates: { canonical: abs("access/") },
  openGraph: { url: abs("access/"), title: "アクセス｜AROMA DAIAMOND 亀戸" },
};

/* 駅からの道案内。 */
const STEPS = [
  { n: "01", t: "JR亀戸駅で下車", d: "JR総武線・東武亀戸線「亀戸駅」が最寄りです。" },
  { n: "02", t: "北口を出る", d: "改札を出て北口方面へ。" },
  { n: "03", t: "徒歩 5分", d: "大通り沿いを進みます。" },
  { n: "04", t: "セブンイレブン亀戸十三間通り店に到着", d: "着きましたらお電話ください。お部屋まで丁寧にご案内します。" },
];

const INFO = [
  ["店名", "AROMA DAIAMOND（アロマ ダイアモンド）"],
  ["エリア", "東京都 江東区 亀戸"],
  ["最寄駅", "JR亀戸駅 北口 徒歩5分"],
  ["営業時間", "10:00〜翌5:00"],
  ["電話受付", "9:30〜翌4:00"],
  ["電話番号", "080-4885-5430"],
  ["お支払い", "現金 / クレジットカード / PayPay"],
  ["定休日", "年中無休"],
];

function GoldDia() {
  return (
    <span className="acc-dia" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M4.5 9 L12 2.5 L19.5 9 L12 21.5 Z" fill="none" stroke="#b18e46" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M4.5 9 H19.5 M9 9 L12 21.5 M15 9 L12 21.5 M9 9 L12 2.5 M15 9 L12 2.5" fill="none" stroke="#b18e46" strokeWidth="0.8" />
      </svg>
    </span>
  );
}

export default function Access() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background:
            "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: "アクセス", path: "access/" }]} />
        <div className="page-head">
          <div className="ph-en">Access</div>
          <h1 className="ph-jp">アクセス</h1>
        </div>

        <NavGrid base="../" />

        <section className="acc">
          <p className="acc-lead">
            <b>東京都 江東区 亀戸</b>／<b>JR亀戸駅</b>より徒歩圏内。
            プライバシー保護のため、詳しい所在地は
            <b>ご予約確定後</b>にお電話・LINEでご案内しております。
          </p>

          {/* ---- 地図（亀戸駅周辺） ---- */}
          <div className="acc-map">
            <iframe
              title="AROMA DAIAMOND 亀戸 周辺マップ（JR亀戸駅）"
              src="https://maps.google.com/maps?q=JR%E4%BA%80%E6%88%B8%E9%A7%85&z=15&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <p className="acc-map-note">※ 地図はJR亀戸駅周辺を表示しています（正確な店舗位置ではありません）。</p>

          {/* ---- 道案内 ---- */}
          <div className="acc-box">
            <div className="acc-box-head">
              <GoldDia />
              駅からの道案内
            </div>
            <ul className="acc-steps">
              {STEPS.map((s, i) => (
                <li key={i}>
                  <span className="as-n">{s.n}</span>
                  <span className="as-txt">
                    <b>{s.t}</b>
                    <small>{s.d}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ---- 店舗情報 ---- */}
          <div className="acc-box">
            <div className="acc-box-head">
              <GoldDia />
              店舗情報
            </div>
            <dl className="acc-info">
              {INFO.map(([k, v], i) => (
                <div className="ai-row" key={i}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="acc-note">
            <GoldDia />
            詳しい所在地・ビル名は、ご予約確定後にLINEまたはお電話でご案内いたします。
            道に迷われた際は、遠慮なくお電話ください。
          </p>

          {/* ---- CTA（3つ横並び・統一デザイン） ---- */}
          <div className="acc-cta">
            <a className="acc-btn" href="tel:08048855430">
              <span className="ab-en">Tel</span>
              <span className="ab-jp">電話する</span>
            </a>
            <a className="acc-btn" href={links.line} target="_blank" rel="noopener noreferrer">
              <span className="ab-en">LINE</span>
              <span className="ab-jp">LINE予約</span>
            </a>
            <a className="acc-btn" href="../reserve/">
              <span className="ab-en">Web</span>
              <span className="ab-jp">WEB予約</span>
            </a>
          </div>
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
