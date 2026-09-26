/* スタッフ求人（/careers/）とセラピスト求人（/recruit/）の共通ページ本体。
   role="staff" | "therapist" で内容を切り替える。募集条件は data/recruit-config.json
   から読み込み、未確定（v:null）の項目は「準備中」と明示する（推測で埋めない）。
   セラピスト求人は指示書に沿い「報酬」を仕事内容より前に配置する。 */
import SiteChrome from "./SiteChrome";
import NavGrid from "./NavGrid";
import Breadcrumbs from "./Breadcrumbs";
import RecruitForm from "./RecruitForm";
import cfg from "../../data/recruit-config.json";

const BASE = "../"; // /careers/ ・ /recruit/ はルートから1階層下

const CONTENT = {
  staff: {
    slug: "careers",
    en: "STAFF RECRUITMENT",
    h1: "スタッフ求人",
    heroTitle: "お店の心地よさを、運営から支える。",
    jobLabel: "受付・店舗運営スタッフ募集",
    intro:
      "AROMA DAIAMOND の受付や予約管理など、店舗運営を支えるお仕事です。仕事内容と募集条件をご確認のうえ、ご応募ください。",
    applyBtn: "スタッフ求人に応募する",
    jobs: [
      { t: "予約受付", d: "電話やLINEなどのお問い合わせに対応し、ご希望の日時を確認します。" },
      { t: "予約・出勤管理", d: "予約状況とセラピストの出勤予定を確認し、ご案内を調整します。" },
      { t: "店内の準備", d: "備品の確認や補充など、営業に必要な準備を行います。" },
      { t: "情報更新", d: "出勤情報やお知らせなど、決められた内容を更新します。" },
      { t: "運営サポート", d: "店舗の運営に関わる確認や連絡を行います。" },
    ],
    fit: [
      "相手の話を聞き、落ち着いて対応できる方",
      "日時や予約内容を丁寧に確認できる方",
      "チーム内で必要な情報を共有できる方",
      "店内の清潔さや準備に気を配れる方",
    ],
    flowTitle: "入店後の流れ",
    flow: ["業務説明", "受付方法の確認", "予約管理の練習", "担当業務を開始"],
    flowNote: "研修・引き継ぎの具体的な期間や指導担当は、確定後に掲載します。",
    applyFlow: ["ご応募", "担当者からご連絡", "面談・条件確認", "合意後に勤務開始"],
    faqs: [
      "未経験でも応募できますか？",
      "必要なパソコン操作や資格はありますか？",
      "週何日から勤務できますか？",
      "深夜勤務は必須ですか？",
      "清掃や売上管理も担当しますか？",
      "面接に必要なものは何ですか？",
    ],
    tableTitle: "募集要項",
    table: cfg.roles.staff.requirements,
    other: { slug: "recruit", label: "セラピスト求人", note: "施術・接客のお仕事はこちら" },
  },
  therapist: {
    slug: "recruit",
    en: "THERAPIST RECRUITMENT",
    h1: "セラピスト求人",
    heroTitle: "丁寧な施術が、選ばれる理由になる。",
    jobLabel: "セラピスト募集",
    intro:
      "2026年11月15日、亀戸にオープン予定の AROMA DAIAMOND。落ち着いたプライベートサロンで、一人ひとりのお客様に丁寧に向き合うセラピストを募集します。",
    applyBtn: "セラピスト求人に応募する",
    chips: [
      "報酬：コース料金の60%",
      "亀戸・プライベートサロン(1室)",
      "業務委託",
      "2026.11.15 開業予定",
    ],
    // 報酬（仕事内容より前に配置）
    rewardHeading: "報酬は、計算方法まで明確に。",
    rewardRate: "コース料金の60%（業務委託）",
    rewardExample: "例）120分コース お客様料金 23,000円 → 報酬 13,800円",
    incomeImage: "1日 50,000〜100,000円",
    incomeNote:
      "※ご予約状況により変動します。収入を保証するものではなく、新規オープンのため実績に基づく平均でもありません。ご予約が重なった日の想定イメージです。",
    benefits: [
      { t: "入店祝い金 10万円", d: "ご入店された方に祝い金10万円をお支払いします（支給条件の詳細は面談時にご案内）。" },
      { t: "待機保証", d: "ご予約が無い待機時間も、手当を支給します。" },
      { t: "交通費支給", d: "通勤にかかる交通費を支給します。" },
      { t: "待機環境が充実", d: "エステ機器・Netflix 等を完備。待機中の飲食費も支給します。" },
      { t: "女性店長が在籍", d: "店長は女性。相談しやすく、安心して働ける環境づくりを大切にしています。" },
      { t: "堅実な運営", d: "無理のない堅実な運営方針。腰を据えて長く働ける環境を整えています。" },
    ],
    jobs: [
      { t: "来店時のご案内", d: "ご来店のお客様をお迎えし、リラックスしてお過ごしいただけるようご案内します。" },
      { t: "ご希望の確認", d: "コースやご要望をうかがい、当日の流れをご説明します。" },
      { t: "施術", d: "店舗で定めた内容に沿って、丁寧に施術・接客を行います。施術の範囲や担当する準備は、開始前に具体的にお伝えします。" },
      { t: "お見送り・次の準備", d: "お会計やお見送りのあと、タオルや施術用品を整え、次のお客様をお迎えする準備をします。" },
    ],
    workFlowTitle: "勤務の流れ",
    workFlow: ["来店時のご案内", "ご希望の確認", "決められたコースでの施術", "お見送りと次の準備"],
    reasons: [
      { t: "明瞭な報酬", d: "コース料金の60%と待機保証。計算方法を事前にお伝えします。" },
      { t: "落ち着いた1室", d: "亀戸のプライベートサロン。一人ひとりのお客様に丁寧に向き合えます。" },
      { t: "安心のサポート", d: "女性店長が在籍。困ったときの相談・対応の手順を事前に確認します。" },
    ],
    safetyNote:
      "施術内容や写真の公開範囲、勤務中に困った場合の連絡方法を、働き始める前に確認します。施術中に不適切な要求があった場合の中断・ご相談の手順も、事前にご説明します。写真の公開範囲はご本人と相談のうえ決定します。",
    applyFlow: [
      "仕事内容・条件を確認",
      "ご質問・ご応募",
      "面談で条件確認",
      "双方合意・研修",
      "開業後に勤務開始",
    ],
    faqs: [
      { q: "未経験でも応募できますか？", a: "ご経験は問いません。まずはお気軽にお問い合わせください。詳しい流れは面談時にご案内します。" },
      { q: "予約が無い待機時間の報酬は？", a: "待機保証があり、ご予約が無い待機時間も手当を支給します。" },
      { q: "写真の公開（顔出し）は必要ですか？", a: "写真の公開範囲は、ご本人と相談のうえ決定します。" },
      { q: "接客中に困ったときは？", a: "施術の中断・ご相談の手順を勤務開始前に確認します。女性店長が在籍し、相談しやすい環境です。" },
      { q: "応募したら必ず採用ですか？", a: "面談は採用を確約するものではありません。仕事内容と条件をご確認のうえ、双方合意のうえ進めます。" },
    ],
    rewardTitle: "報酬の詳細",
    reward: cfg.roles.therapist.reward,
    tableTitle: "働き方・募集条件",
    table: cfg.roles.therapist.conditions,
    other: { slug: "careers", label: "スタッフ求人", note: "受付・店舗運営のお仕事はこちら" },
  },
};

// 条件表：確定値があれば表示、未確定（null）は「準備中」バッジ
function CondTable({ rows }) {
  return (
    <table className="rec-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.k}>
            <th>{r.k}</th>
            <td>{r.v ? r.v : <span className="rec-pending">準備中</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SecHead({ en, jp }) {
  return (
    <div className="rec-sec-h">
      <span className="rec-sec-en">{en}</span>
      <h2 className="rec-sec-jp">{jp}</h2>
    </div>
  );
}

function Jobs({ c }) {
  return (
    <section className="rec-sec" id="jobs">
      <SecHead en="Work" jp="仕事内容" />
      <div className="rec-jobs">
        {c.jobs.map((j) => (
          <div className="rec-job" key={j.t}>
            <div className="rec-job-t">{j.t}</div>
            <p className="rec-job-d">{j.d}</p>
          </div>
        ))}
      </div>
      {c.workFlow && (
        <div className="rec-flow-wrap">
          <div className="rec-flow-title">{c.workFlowTitle}</div>
          <ol className="rec-flow">
            {c.workFlow.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function Faq({ faqs }) {
  return (
    <section className="rec-sec" id="faq">
      <SecHead en="FAQ" jp="よくあるご質問" />
      <div className="rec-faq">
        {faqs.map((item, i) => {
          const q = typeof item === "string" ? item : item.q;
          const a =
            typeof item === "string"
              ? "募集条件の確定後に掲載します。お急ぎの場合は、下の応募フォームからお気軽にお問い合わせください。"
              : item.a;
          return (
            <details className="rec-faq-item" key={i}>
              <summary>{q}</summary>
              <div className="rec-faq-a">{a}</div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function ApplySec({ c, role }) {
  return (
    <section className="rec-sec" id="apply">
      <SecHead en="Apply" jp="応募の流れ" />
      <ol className="rec-flow">
        {c.applyFlow.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <RecruitForm role={role} />
    </section>
  );
}

export default function RecruitPage({ role }) {
  const c = CONTENT[role];
  const status = cfg.roles[role].status;
  const accepting = status === "open";
  const statusLabel =
    status === "open" ? "募集中" : status === "closed" ? "募集終了" : "準備中";
  const isTh = role === "therapist";

  return (
    <div className="stage">
      <div
        className="device rec-page"
        style={{
          background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: c.h1, path: `${c.slug}/` }]} />

        {/* 職種切替リンク */}
        <div className="rec-switch">
          <span className="rec-switch-cur">{c.h1}</span>
          <a className="rec-switch-alt" href={`${BASE}${c.other.slug}/`}>
            {c.other.label}はこちら →
          </a>
        </div>

        <div className="page-head">
          <div className="ph-en">{c.en}</div>
          <h1 className="ph-jp">{c.h1}</h1>
        </div>

        <NavGrid base={BASE} />

        {/* ヒーロー */}
        <section className="rec-hero">
          <span className={`rec-status ${status}`}>{statusLabel}</span>
          <h2 className="rec-hero-title">{c.heroTitle}</h2>
          <div className="rec-hero-job">{c.jobLabel}</div>
          <p className="rec-hero-intro">{c.intro}</p>
          {c.chips && (
            <div className="rec-chips">
              {c.chips.map((ch) => (
                <span className="rec-chip" key={ch}>
                  {ch}
                </span>
              ))}
            </div>
          )}
          {accepting ? (
            <a className="rec-cta" href="#apply">
              {c.applyBtn}
            </a>
          ) : (
            <span className="rec-cta rec-cta-off" aria-disabled="true">
              応募受付は準備中です
            </span>
          )}
          <a className="rec-cta-sub" href={isTh ? "#reward" : "#detail"}>
            {isTh ? "報酬・仕事内容・条件を見る" : "仕事内容・募集条件を見る"}
          </a>
        </section>

        {/* ページ内リンク */}
        <nav className="rec-jump" aria-label="ページ内リンク">
          {isTh && <a href="#reward">報酬</a>}
          {isTh && <a href="#benefits">待遇</a>}
          <a href="#jobs">仕事内容</a>
          <a href="#detail">募集条件</a>
          <a href="#faq">FAQ</a>
          <a href="#apply">応募</a>
        </nav>

        {isTh ? (
          <>
            {/* 報酬（仕事内容より前） */}
            <section className="rec-sec" id="reward">
              <SecHead en="Reward" jp={c.rewardHeading} />
              <div className="rec-reward-rate">
                <span className="rec-reward-rate-label">報酬率</span>
                <span className="rec-reward-rate-val">{c.rewardRate}</span>
                <span className="rec-reward-ex">{c.rewardExample}</span>
              </div>
              <div className="rec-income">
                <span className="rec-income-label">収入イメージ</span>
                <span className="rec-income-num">{c.incomeImage}</span>
              </div>
              <p className="rec-note-small">{c.incomeNote}</p>
              <div className="rec-subtable">
                <div className="rec-subtable-h">報酬の内訳</div>
                <CondTable rows={c.reward} />
                <p className="rec-note-small">
                  未確定の項目は「準備中」と表示しています。確定した内容のみを掲載します。
                </p>
              </div>
            </section>

            {/* 待遇・環境 */}
            <section className="rec-sec" id="benefits">
              <SecHead en="Benefits" jp="待遇・働く環境" />
              <div className="rec-benefits">
                {c.benefits.map((b) => (
                  <div className="rec-benefit" key={b.t}>
                    <div className="rec-benefit-t">{b.t}</div>
                    <p className="rec-benefit-d">{b.d}</p>
                  </div>
                ))}
              </div>
            </section>

            <Jobs c={c} />

            {/* 選ばれる理由 */}
            <section className="rec-sec">
              <SecHead en="Reasons" jp="選ばれる理由" />
              <div className="rec-jobs">
                {c.reasons.map((r) => (
                  <div className="rec-job" key={r.t}>
                    <div className="rec-job-t">{r.t}</div>
                    <p className="rec-job-d">{r.d}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 働き方・募集条件 */}
            <section className="rec-sec" id="detail">
              <SecHead en="Requirements" jp={c.tableTitle} />
              <CondTable rows={c.table} />
              {!accepting && (
                <p className="rec-note-small">
                  一部の条件は準備中です。確定した内容のみを、確定後に掲載します。
                </p>
              )}
            </section>

            {/* 安心して働くために */}
            <section className="rec-sec">
              <SecHead en="Support" jp="安心して働くために" />
              <p className="rec-safety">{c.safetyNote}</p>
            </section>

            <Faq faqs={c.faqs} />
            <ApplySec c={c} role={role} />
          </>
        ) : (
          <>
            <Jobs c={c} />

            <section className="rec-sec" id="detail">
              <SecHead en="Requirements" jp={c.tableTitle} />
              <CondTable rows={c.table} />
              {!accepting && (
                <p className="rec-note-small">
                  募集条件は準備中です。確定した内容のみを、確定後に掲載します。
                </p>
              )}
            </section>

            {c.fit && (
              <section className="rec-sec">
                <SecHead en="Fit" jp="向いている人" />
                <ul className="rec-fit">
                  {c.fit.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rec-sec">
              <SecHead en="Onboarding" jp={c.flowTitle} />
              <ol className="rec-flow">
                {c.flow.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p className="rec-note-small">{c.flowNote}</p>
            </section>

            <Faq faqs={c.faqs} />
            <ApplySec c={c} role={role} />
          </>
        )}

        {/* もう一方の求人へ */}
        <a className="rec-otherlink" href={`${BASE}${c.other.slug}/`}>
          <span className="rec-otherlink-note">{c.other.note}</span>
          <span className="rec-otherlink-label">{c.other.label} →</span>
        </a>

        {/* お客様向けの導線 */}
        <a className="rec-guestlink" href={`${BASE}reserve/`}>
          ご予約・サービスをお探しのお客様はこちら →
        </a>

        <SiteChrome base={BASE} hideFooterbar />
      </div>

      {/* スマホ下部：応募固定バー（来店客用の予約バーとは別） */}
      <div className="rec-applybar">
        {accepting ? (
          <a className="rec-applybar-btn" href="#apply">
            {c.applyBtn}
          </a>
        ) : (
          <a className="rec-applybar-btn rec-applybar-off" href="#apply">
            応募受付は準備中（詳細を見る）
          </a>
        )}
        <a className="rec-applybar-alt" href={`${BASE}reserve/`}>
          ご予約(お客様)
        </a>
      </div>
    </div>
  );
}
