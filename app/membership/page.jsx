import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { abs } from "../_lib/site";
import cfg from "../../data/membership-config.json";
import { DiamondIcon, CrownIcon, RibbonIcon, MedalIcon, ArrowDown, Glyph } from "./icons";
import RegisterSection from "./RegisterSection";

export const metadata = {
  title: "会員制度・VIP特典",
  description:
    "AROMA DIAMOND（アロマダイヤモンド）亀戸の会員制度「DIAMOND MEMBERSHIP」。オープン記念 OPENING VIP は先着100名様限定・入会金年会費無料。ご来店回数に応じて SILVER・GOLD・DIAMOND の特典が受けられます。",
  alternates: { canonical: abs("membership/") },
  openGraph: {
    url: abs("membership/"),
    title: "会員制度・VIP特典｜AROMA DIAMOND 亀戸",
    description: "OPENING VIP 先着100名様限定。来店するほど、特別な待遇へ。",
  },
};

const RANKS = [
  { key: "silver", name: "SILVER", visits: "1〜2回来店", perk: "会員限定アロマ", Icon: RibbonIcon, color: "#9aa1a8" },
  { key: "gold", name: "GOLD", visits: "3〜5回来店", perk: "キャンセル待ち優先", Icon: MedalIcon, color: "#b49a63" },
  { key: "diamond", name: "DIAMOND", visits: "6回以上来店", perk: "24時間先行予約", Icon: DiamondIcon, color: "#6f9ab8" },
];

const VIP_PERKS = [
  { icon: "clock", t: "24時間先行予約", d: "一般のお客様より24時間早く、対象セラピストのご予約を承ります。" },
  { icon: "camera", t: "写真指名料 1,000円 無料", d: "VIP会員様の2回目のご来店時、写真指名料1,000円を無料にいたします。ご利用は1回限り、他の割引クーポンとの併用はできません。" },
  { icon: "bell", t: "キャンセル枠の優先案内", d: "セラピストのキャンセル枠・空き枠を、優先してご案内いたします。" },
  { icon: "leaf", t: "VIP限定プレミアムアロマ", d: "通常とは異なるプレミアムアロマをお選びいただけます（対象の香りは店舗が指定します）。" },
  { icon: "card", t: "デジタルVIP会員証", d: "先着100名様に、001〜100の固有会員番号入りのデジタル会員証を発行いたします。" },
];

// ランク別特典（上位ランクは下位ランクの特典もすべて利用可）
const COMPARE = [
  { t: "会員限定アロマの選択", r: [1, 1, 1] },
  { t: "会員向けのお知らせ", r: [1, 1, 1] },
  { t: "キャンセル待ち優先案内", r: [0, 1, 1] },
  { t: "誕生月限定特典", r: [0, 1, 1] },
  { t: "セラピストの24時間先行予約", r: [0, 0, 1] },
  { t: "プレミアムアロマサービス", r: [0, 0, 1] },
];

const FAQS = [
  { q: "会員登録は無料ですか？", a: "はい。入会金・年会費ともに無料です。ご登録はニックネームとメールアドレスだけで完了します。" },
  {
    q: "VIP会員と通常ランクの違いは何ですか？",
    a: "OPENING VIP は、オープン記念として先着100名様だけにご用意した期間限定の会員資格です（特典のご利用は2026年12月31日まで）。通常ランク（SILVER・GOLD・DIAMOND）は、直近6か月のご来店回数に応じて決まる制度で、期間の定めなく続きます。2つの制度は並行して適用されますが、同じ内容の特典が重なる場合は1つ分のご提供となります。",
  },
  { q: "VIP会員の有効期限はいつまでですか？", a: `VIP特典のご利用期間は${cfg.benefitLabel}です。期限を過ぎてもVIP会員番号と通常会員としてのご登録はそのまま残り、来店ランク制度を引き続きご利用いただけます。` },
  { q: "来店回数はどのように計算されますか？", a: "有料の施術を完了したご来店のみを数えます。ご予約のみ、キャンセル、無断キャンセルは含まれません。ランクは直近6か月間のご来店回数で判定し、ご来店に応じて自動で更新されます。" },
  { q: "ランクが下がることはありますか？", a: "直近6か月間のご来店回数で判定するため、ご来店の間隔があくと、ランクが下がる場合があります。再びご来店いただくと、回数に応じてランクが上がります。" },
  { q: "他の割引クーポンと併用できますか？", a: "VIP特典の写真指名料無料は、他の割引クーポンとの併用はできません。その他の特典の併用条件は、ご予約時にお気軽にお問い合わせください。" },
  { q: "VIP期間終了後も通常会員として利用できますか？", a: "はい。VIP期間の終了後も通常会員としてご登録は続き、来店ランク（SILVER・GOLD・DIAMOND）の特典をご利用いただけます。" },
];

export default function Membership() {
  return (
    <div className="stage">
      <div className="device" style={{ background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat" }}>
        <Breadcrumbs items={[{ name: "会員制度・VIP特典", path: "membership/" }]} />

        {/* SECTION 01 メインビジュアル */}
        <section className="mb-hero" aria-labelledby="mb-title">
          <div className="mb-hero-icon"><DiamondIcon size={44} color="#3a3a3a" sw={1.2} /></div>
          <p className="mb-brand">AROMA DIAMOND</p>
          <h1 className="mb-title" id="mb-title">DIAMOND MEMBERSHIP</h1>
          <p className="mb-sub">来店するほど、特別な待遇へ。</p>
          <hr className="mb-rule" />

          <div className="mb-vip">
            <CrownIcon size={34} color="#b49a63" />
            <p className="mb-vip-name">OPENING VIP</p>
            <p className="mb-vip-cond">先着100名限定・12月31日まで</p>
            <p className="mb-vip-perks">24時間先行予約・限定会員証・特別特典</p>
          </div>

          <div className="mb-arrow"><ArrowDown color="#8a8a8a" /></div>
          <p className="mb-join">ご来店でランク制度に参加</p>

          <div className="mb-ranks">
            {RANKS.map(({ key, name, visits, perk, Icon, color }) => (
              <div className={`mb-rank mb-rank-${key}`} key={key}>
                <Icon size={32} color={color} />
                <p className="mb-rank-name">{name}</p>
                <p className="mb-rank-visits">{visits}</p>
                <p className="mb-rank-perk">{perk}</p>
              </div>
            ))}
          </div>
          <p className="mb-note">VIP会員資格と来店ランクは別制度です。オープンVIPは期間限定ですが、来店ランク制度はその後も継続します。</p>
        </section>

        {/* SECTION 02 オープンVIP会員限定特典 */}
        <section className="mb-sec" aria-labelledby="mb-s2">
          <p className="mb-sec-en">OPENING VIP</p>
          <h2 className="mb-sec-h" id="mb-s2">先着100名様だけの特別なご案内</h2>
          <p className="mb-sec-lead">オープン記念のVIP会員様だけにご用意した、5つの特典です。</p>
          <ol className="mb-perks">
            {VIP_PERKS.map((p, i) => (
              <li className="mb-perk" key={p.t}>
                <span className="mb-perk-icon"><Glyph name={p.icon} color="#b49a63" /></span>
                <div>
                  <p className="mb-perk-no">特典 {String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mb-perk-t">{p.t}</h3>
                  <p className="mb-perk-d">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <dl className="mb-terms">
            <div><dt>募集人数</dt><dd>先着{cfg.capacity}名（定員に達し次第締切）</dd></div>
            <div><dt>募集期間</dt><dd>{cfg.openLabel}〜{cfg.closeLabel}</dd></div>
            <div><dt>特典のご利用</dt><dd>{cfg.benefitLabel}</dd></div>
            <div><dt>入会金・年会費</dt><dd>無料</dd></div>
          </dl>
        </section>

        {/* SECTION 03 ランク別特典比較 */}
        <section className="mb-sec" aria-labelledby="mb-s3">
          <p className="mb-sec-en">RANK BENEFITS</p>
          <h2 className="mb-sec-h" id="mb-s3">ご来店を重ねるほど、より特別な時間へ</h2>
          <div className="mb-table-wrap">
            <table className="mb-table">
              <thead>
                <tr>
                  <th scope="col"><span className="mb-sr">特典</span></th>
                  {RANKS.map((r) => (
                    <th scope="col" key={r.key} className={`mb-th-${r.key}`}>{r.name}</th>
                  ))}
                </tr>
                <tr className="mb-table-cond">
                  <th scope="row">直近6か月</th>
                  <td>1〜2回</td>
                  <td>3〜5回</td>
                  <td>6回以上</td>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((c) => (
                  <tr key={c.t}>
                    <th scope="row">{c.t}</th>
                    {c.r.map((v, i) => (
                      <td key={i} aria-label={v ? "対象" : "対象外"}>{v ? <span className="mb-dot" /> : <span className="mb-dash">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mb-note">上位のランクでは、下位ランクの特典もすべてご利用いただけます。同じ内容の特典が重なる場合は1つ分のご提供となります。</p>
        </section>

        {/* SECTION 04 会員ランクの仕組み */}
        <section className="mb-sec" aria-labelledby="mb-s4">
          <p className="mb-sec-en">HOW IT WORKS</p>
          <h2 className="mb-sec-h" id="mb-s4">会員ランクの仕組み</h2>
          <ol className="mb-steps">
            <li><span className="mb-step-no">STEP 01</span><h3>無料会員登録</h3><p>ニックネームとメールアドレスで、すぐにご登録いただけます。</p></li>
            <li><span className="mb-step-no">STEP 02</span><h3>ご来店でランクアップ</h3><p>有料の施術を完了したご来店を数え、直近6か月の回数でランクが自動で上がります。</p></li>
            <li><span className="mb-step-no">STEP 03</span><h3>ランクに応じた特典をご利用</h3><p>デジタル会員証で、現在のランクとご来店回数をいつでもご確認いただけます。</p></li>
          </ol>
          <p className="mb-note">ランクは初回ご来店後に付与されます。ご予約のみ・キャンセル・無断キャンセルは回数に含まれません。</p>
        </section>

        {/* SECTION 05 VIP会員登録 */}
        <RegisterSection cfg={cfg} />

        {/* SECTION 06 よくあるご質問 */}
        <section className="mb-sec" aria-labelledby="mb-s6">
          <p className="mb-sec-en">FAQ</p>
          <h2 className="mb-sec-h" id="mb-s6">よくあるご質問</h2>
          <div className="mb-faq">
            {FAQS.map((f) => (
              <details className="mb-faq-item" key={f.q}>
                <summary><span className="mb-q">Q.</span>{f.q}</summary>
                <p><span className="mb-a">A.</span>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <a className="mb-reserve-link" href="../reserve/">ご予約はこちら →</a>

        <NavGrid base="../" />

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
