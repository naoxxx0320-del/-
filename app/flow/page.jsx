import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { SITE, abs } from "../_lib/site";

export const metadata = {
  title: "ご利用の流れ",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 のご利用の流れ。ご予約からご来店、駅からの道順、退店までを分かりやすくご案内します。",
  alternates: { canonical: abs("flow/") },
  openGraph: { url: abs("flow/"), title: "ご利用の流れ｜AROMA DAIAMOND 亀戸" },
};

const TEL = SITE.telephone; // 実運用の予約番号（既存実装より）
const TEL_DISP = SITE.telephoneDisplay;

// 電話アイコン（ゴールド）
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M6.5 3.5c.6 0 1.1.4 1.3 1l.8 2.7c.2.6 0 1.2-.5 1.6l-1.2.9c1 2.1 2.7 3.8 4.8 4.8l.9-1.2c.4-.5 1-.7 1.6-.5l2.7.8c.6.2 1 .7 1 1.3v2.6c0 .8-.7 1.5-1.5 1.4C11.1 20.6 3.4 12.9 3.1 5.4 3 4.6 3.7 4 4.5 4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    t: "お電話でご予約",
    body: "お電話で、ご希望の日時・コース・オプションをお伝えください。担当者が空き状況を確認し、ご予約内容とご来店時の案内をお伝えします。",
    note: "ご希望を伺った段階では予約確定ではありません。当店から日時と内容を確認してご案内した時点で確定となります。",
    phone: { label: "お電話でご予約する", aria: "電話をかけてご予約する" },
  },
  {
    n: "02",
    t: "亀戸駅からお越しください",
    body: "亀戸駅北口を出て、亀戸十三間通りをまっすぐお進みください。",
    highlight:
      "セブン-イレブン亀戸十三間通り店に着きましたら、お電話ください。そこからお部屋までご案内いたします。",
    note: "ご予約時にご案内した時刻に合わせてお越しください。道に迷われた場合も、お電話でお知らせください。",
    phone: {
      label: "お店に電話する（到着のご連絡）",
      aria: "到着をお知らせする電話をかける",
    },
  },
  {
    n: "03",
    t: "ご案内・コース内容の確認",
    body: "お部屋でご予約内容と料金をご確認いただきます。施術について気になることや、触れてほしくない箇所などがあれば、遠慮なくお伝えください。",
  },
  {
    n: "04",
    t: "お着替え・施術",
    body: "お着替えなどの準備をしていただいた後、コースに沿って施術いたします。力加減や室温など、ご希望があればその場でお申し付けください。",
  },
  {
    n: "05",
    t: "お支度・お帰り",
    body: "施術後はお支度をしていただき、お忘れ物がないかご確認のうえお帰りいただきます。ご利用ありがとうございました。",
  },
];

export default function Flow() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: "ご利用の流れ", path: "flow/" }]} />

        <div className="page-head">
          <div className="ph-en">Flow</div>
          <h1 className="ph-jp">ご利用の流れ</h1>
        </div>

        <NavGrid base="../" />

        <p className="flow-intro">
          初めてのお客様も安心してお越しいただけるよう、ご予約からお帰りまでの流れをご案内します。
          ご不明な点はお電話でお気軽にお尋ねください。
        </p>

        <div className="flow-steps">
          {STEPS.map((s) => (
            <section className="flow-step" key={s.n}>
              <div className="flow-step-head">
                <span className="flow-step-n">{s.n}</span>
                <h2 className="flow-step-t">{s.t}</h2>
              </div>
              <div className="flow-step-body">
                <p className="flow-step-text">{s.body}</p>

                {s.highlight && (
                  <div className="flow-highlight">
                    <span className="flow-highlight-badge">
                      <PhoneIcon />
                      到着したらお電話ください
                    </span>
                    <p className="flow-highlight-text">{s.highlight}</p>
                  </div>
                )}

                {s.phone && (
                  <a className="flow-tel" href={`tel:${TEL}`} aria-label={s.phone.aria}>
                    <span className="flow-tel-ic">
                      <PhoneIcon />
                    </span>
                    <span className="flow-tel-tx">
                      {s.phone.label}
                      <small>{TEL_DISP}</small>
                    </span>
                  </a>
                )}

                {s.note && <p className="flow-note">{s.note}</p>}
              </div>
            </section>
          ))}
        </div>

        <p className="flow-outro">
          ご予約・ご不明点は、お電話でお気軽にお問い合わせください。
        </p>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
