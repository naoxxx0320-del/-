/* スタッフ求人（/careers/）とセラピスト求人（/recruit/）の共通ページ本体。
   role="staff" | "therapist" で内容を切り替える。募集条件は data/recruit-config.json
   から読み込み、未確定（v:null）の項目は「準備中」と明示する（推測で埋めない）。
   セラピスト求人は指示書に沿い「報酬」を仕事内容より前に配置する。 */
import SiteChrome from "./SiteChrome";
import NavGrid from "./NavGrid";
import Breadcrumbs from "./Breadcrumbs";
import RecruitForm from "./RecruitForm";
import { photoSrc } from "./photo";
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
      "AROMA DIAMOND の受付や予約管理など、店舗運営を支えるお仕事です。仕事内容と募集条件をご確認のうえ、ご応募ください。",
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
    heroTitle: "オープニングセラピスト募集。",
    jobLabel: "セラピスト募集（オープニング）",
    banner: "recruit-therapist-hero.jpg",
    catch: "✨11月亀戸OPEN！歩合60〜75％＆指名・OP料全額バック✨",
    intro:
      "2026年11月中旬、亀戸にオープン予定の AROMA DIAMOND。アロマオイルを使ったトリートメントと、お客様へのご案内・接客をお願いします。お店のスタートを一緒に盛り上げてくださるオープニングセラピストを募集します。未経験の方も、デビュー前に施術と接客を丁寧にお伝えします。",
    applyBtn: "セラピスト求人に応募する",
    chips: [
      "歩合 60〜75%",
      "指名・OP料 100%バック",
      "入店祝金 5万円",
      "亀戸・2026.11 OPEN",
    ],
    // 報酬（仕事内容より前に配置）
    rewardHeading: "報酬は、計算方法まで明確に。",
    rewardRate: "コース料金の60〜75%（業務委託）",
    rewardExample:
      "例）コース料金 18,000円 × 60% → 報酬 10,800円（指名料・オプション料は別途100%バック）",
    incomeImage: "",
    incomeNote:
      "※歩合率60〜75%の適用条件・各料金の計算方法は、面談時に具体的にご案内します（確定後に本ページへ追記します）。",
    benefits: [
      { t: "入店祝い金 5万円", d: "オープニングセラピストとしてご入店された方に、入店祝金5万円をお支払いします（支給条件は面談時にご案内）。" },
      { t: "指名料・オプション料 100%バック", d: "指名料・オプション料は全額（100%）をバックします。" },
      { t: "オープニング特別歩合", d: "オープニングセラピストには特別歩合をご用意しています（適用条件は面談時にご案内）。" },
      { t: "充実の待機環境", d: "個室で待機OK。エステ機器・美顔器・Netflix・Amazon・Wi-Fi 完備。待機中の飲食費も支給します。" },
      { t: "未経験も安心の研修", d: "デビュー前に施術の技術と接客の流れを丁寧にお伝えします。制服は無料で貸与します。" },
      { t: "柔軟な働き方", d: "シフトは希望に合わせて相談OK。ノルマなし、他店との掛け持ちも可能です。" },
      { t: "交通費・紹介金", d: "面接時の交通費を全額支給（証明書の提示が必要）。紹介金制度もあります。" },
      { t: "応募しやすい環境", d: "お子様連れでの面接、お友達同士での応募も歓迎。宿泊についても相談可能です。" },
    ],
    jobs: [
      { t: "来店時のご案内", d: "ご来店のお客様をお迎えし、リラックスしてお過ごしいただけるようご案内します。" },
      { t: "ご希望の確認", d: "コースやご要望をうかがい、当日の流れをご説明します。" },
      { t: "アロマトリートメント", d: "アロマオイルを使ったトリートメントを、店舗で定めた内容に沿って丁寧に行います。施術の範囲や準備は、開始前に具体的にお伝えします。" },
      { t: "お見送り・次の準備", d: "お会計やお見送りのあと、タオルや施術用品を整え、次のお客様をお迎えする準備をします。" },
    ],
    workFlowTitle: "勤務の流れ",
    workFlow: ["来店時のご案内", "ご希望の確認", "アロマトリートメント", "お見送りと次の準備"],
    reasons: [
      { t: "高めの歩合", d: "コース料金の60〜75%。指名料・オプション料は100%バック。計算方法は面談で明確にお伝えします。" },
      { t: "オープニング募集", d: "新しいお店を一緒にスタート。働き方の不安も相談しながら、安心して始められる環境づくりを大切にしています。" },
      { t: "未経験も歓迎", d: "デビュー前に施術と接客を丁寧にレクチャー。経験よりも、お客様を大切にする気持ちを重視します。" },
    ],
    message: [
      "はじめまして！アロマダイヤモンド亀戸は、2026年11月中旬にオープン予定のリラクゼーションサロンです💎",
      "今回は、お店のスタートを一緒に盛り上げてくださるオープニングセラピストを募集します！",
      "新しいお店だからこそ、働き方やお仕事への不安も一つずつ相談しながら、安心してスタートできる環境をつくっていきたいと考えています。未経験の方には、デビュー前に施術と接客を丁寧にお伝えします。",
      "歩合はコース料金の60〜75％。指名料・オプション料は100％バック！「お客様に喜んでいただきながら、自分の頑張りも報酬につなげたい」という方をお待ちしています✨",
      "まずはお店の雰囲気や働き方について、お話しするところからでも大歓迎です。お気軽にご応募ください！",
    ],
    safetyNote:
      "当店はリラクゼーションサービスを提供する店舗です。性的サービスは行いません。施術内容や写真の公開範囲、勤務中に困った場合の連絡方法を、働き始める前に確認します。施術中に不適切な要求があった場合の中断・ご相談の手順も、事前にご説明します。写真の公開範囲はご本人と相談のうえ決定します。",
    applyFlow: [
      "仕事内容・条件を確認",
      "ご質問・ご応募",
      "面談で条件確認",
      "双方合意・研修",
      "開業後に勤務開始",
    ],
    faqs: [
      { q: "未経験でも応募できますか？", a: "未経験・経験者ともに大歓迎です。デビュー前に施術と接客を丁寧にお伝えします。まずはお気軽にお問い合わせください。" },
      { q: "歩合はどれくらいですか？", a: "コース料金の60〜75%です（経験・実績に応じてアップ）。指名料・オプション料は100%バック。適用条件・計算方法は面談時に具体的にご案内します。" },
      { q: "入店祝い金はありますか？", a: "はい。オープニングセラピストとして入店された方に、入店祝金5万円をご用意しています（支給条件は面談時にご案内）。" },
      { q: "シフトはどのくらいから入れますか？", a: "希望に合わせてシフト相談OK。週1日〜など、面談時にご希望をお聞かせください。他店との掛け持ちも可能です。" },
      { q: "写真の公開（顔出し）は必要ですか？", a: "写真の公開範囲は、ご本人と相談のうえ決定します。" },
      { q: "性的なサービスはありますか？", a: "当店はリラクゼーションサービスを提供する店舗です。性的サービスは行いません。" },
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
      {role === "therapist" && (
        <div className="rec-extapply">
          <div className="rec-extapply-h">求人サイトからもご応募いただけます</div>
          <a
            href="https://mensesthe.cocoa-job.jp/8/shop/43761/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="rec-extapply-img"
              src="https://cocoa-job.jp/assets/img/user/pc/link/64080_cocoa_mensesthe_cp.gif"
              width={640}
              height={80}
              alt="「アロマダイヤモンド」への応募はココア求人！ココアご利用でもらえるお仕事応援キャンペーン中♪"
              loading="lazy"
            />
          </a>
          <p className="rec-note-small">
            ココア求人では「お仕事応援キャンペーン」を実施中です（内容・条件はココア求人のページでご確認ください）。
          </p>
        </div>
      )}
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

        {/* 求人バナー */}
        {c.banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="rec-banner"
            src={photoSrc(c.banner, BASE)}
            alt={`${c.h1}｜${c.catch || c.heroTitle}`}
            width="1200"
            height="800"
          />
        )}

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
              {c.incomeImage && (
                <div className="rec-income">
                  <span className="rec-income-label">収入イメージ</span>
                  <span className="rec-income-num">{c.incomeImage}</span>
                </div>
              )}
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

            {/* お店よりメッセージ */}
            {c.message && (
              <section className="rec-sec">
                <SecHead en="Message" jp="お店よりメッセージ" />
                <div className="rec-message">
                  {c.message.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            )}

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
