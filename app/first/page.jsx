import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { abs } from "../_lib/site";
import links from "../../data/links.json";

export const metadata = {
  title: "はじめての方へ",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 をはじめてご利用の方へ。ご予約・お問い合わせ方法と、安心してお過ごしいただくためのご案内。",
  alternates: { canonical: abs("first/") },
  openGraph: { url: abs("first/"), title: "はじめての方へ｜AROMA DAIAMOND 亀戸" },
};

const POINTS = [
  ["完全予約制・完全個室", "落ち着いたプライベート空間で、ごゆっくりお過ごしいただけます。"],
  ["明朗会計", "表示価格はすべて税込。無理な延長・オプションの強要は一切ございません。"],
  ["丁寧なご案内", "はじめての方には、コースやお時間の目安を分かりやすくご説明します。"],
  ["ご相談はお気軽に", "ご不明な点は、LINE・お電話・AIチャットからお気軽にお問い合わせください。"],
];

export default function FirstVisit() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: "はじめての方", path: "first/" }]} />

        <div className="page-head">
          <div className="ph-en">First Visit</div>
          <h1 className="ph-jp">はじめての方へ</h1>
        </div>

        <NavGrid base="../" />

        <section className="first-page">
          <p className="first-lead">
            AROMA DAIAMOND（アロマ ダイアモンド／亀戸）へようこそ。
            はじめてのご利用でも安心してお過ごしいただけるよう、
            ご予約からご来店までを丁寧にご案内いたします。
          </p>

          <div className="terms-band">ご予約・お問い合わせ</div>
          <div className="acc-cta">
            <a className="acc-btn" href={links.line} target="_blank" rel="noopener noreferrer">
              <span className="ab-en">LINE</span>
              <span className="ab-jp">LINE予約</span>
            </a>
            <a className="acc-btn" href="../reserve/">
              <span className="ab-en">Web</span>
              <span className="ab-jp">WEB予約</span>
            </a>
            <a className="acc-btn" href="tel:0000000000">
              <span className="ab-en">Tel</span>
              <span className="ab-jp">電話</span>
            </a>
          </div>

          <div className="terms-band">はじめてでも安心のポイント</div>
          <ul className="first-points">
            {POINTS.map(([t, d], i) => (
              <li key={i}>
                <span className="fp-mark" aria-hidden="true">◆</span>
                <span className="fp-txt">
                  <b>{t}</b>
                  <small>{d}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
