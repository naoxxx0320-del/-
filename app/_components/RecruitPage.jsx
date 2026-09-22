/* スタッフ求人（/careers/）とセラピスト求人（/recruit/）の共通ページ本体。
   role="staff" | "therapist" で内容を切り替える。募集条件は data/recruit-config.json
   から読み込み、未確定（v:null）の項目は「準備中」と明示する（推測で埋めない）。 */
import SiteChrome from "./SiteChrome";
import NavGrid from "./NavGrid";
import Breadcrumbs from "./Breadcrumbs";
import RecruitForm from "./RecruitForm";
import cfg from "../../data/recruit-config.json";

const BASE = "../"; // /careers/ ・ /recruit/ はルートから1階層下

// 各ページ固有の原稿（指示書の原稿案。募集条件そのものは config 側で管理）
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
    flowNote:
      "研修・引き継ぎの具体的な期間や指導担当は、確定後に掲載します。",
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
    heroTitle: "一人ひとりのお客様に、丁寧に向き合う仕事。",
    jobLabel: "セラピスト募集",
    intro:
      "AROMA DAIAMOND では、施術と接客を担当するセラピストを募集しています。報酬の仕組みや勤務条件をご確認いただき、ご希望の働き方をお聞かせください。",
    applyBtn: "セラピスト求人に応募する",
    jobs: [
      { t: "来店時のご案内", d: "ご来店のお客様をお迎えし、リラックスしてお過ごしいただけるようご案内します。" },
      { t: "ご希望の確認", d: "コースやご要望をうかがい、当日の流れをご説明します。" },
      { t: "施術", d: "提供メニューに沿って、丁寧に施術・接客を行います。" },
      { t: "施術後のご案内", d: "お会計やお見送りなど、退店までのご案内を行います。" },
      { t: "室内・備品の準備", d: "タオルや施術用品を整え、次のお客様をお迎えする準備をします。" },
    ],
    workFlowTitle: "勤務の流れ",
    workFlow: ["出勤・準備", "予約確認", "接客・施術", "片付け", "退勤"],
    fit: null,
    flowTitle: "研修・相談体制",
    flowNote:
      "研修内容・担当者・研修中の条件、勤務中の相談先などは、確定後に具体的に掲載します。",
    atmosphereNote:
      "実際の室内・待機場所の写真は準備が整い次第掲載します。スタッフの声や収入実績は、裏付けのある内容のみ掲載します。",
    applyFlow: [
      "ご応募",
      "希望条件の確認",
      "面談・仕事内容のご説明",
      "双方合意のうえ研修または勤務開始",
    ],
    faqs: [
      "未経験でも応募できますか？",
      "研修はありますか？費用や期間中の報酬はどうなりますか？",
      "週何日・何時間から勤務できますか？",
      "他の仕事と両立できますか？",
      "指名料や控除はどのように計算されますか？",
      "写真の掲載や顔出しは必要ですか？",
      "衣装・施術用品は用意が必要ですか？",
      "見学や体験勤務はできますか？",
      "接客中に困った場合は誰に相談できますか？",
    ],
    rewardTitle: "報酬の仕組み",
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
            <td>
              {r.v ? (
                r.v
              ) : (
                <span className="rec-pending">準備中</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RecruitPage({ role }) {
  const c = CONTENT[role];
  const roleCfg = cfg.roles[role];
  const status = roleCfg.status;
  const statusLabel =
    status === "open" ? "募集中" : status === "closed" ? "募集終了" : "準備中";

  return (
    <div className="stage">
      <div
        className="device rec-page"
        style={{
          background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: c.h1, path: `${c.slug}/` }]} />

        {/* 職種切替リンク（冒頭） */}
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

        {/* ヒーロー導入 */}
        <section className="rec-hero">
          <span className={`rec-status ${status}`}>{statusLabel}</span>
          <h2 className="rec-hero-title">{c.heroTitle}</h2>
          <div className="rec-hero-job">{c.jobLabel}</div>
          <p className="rec-hero-intro">{c.intro}</p>
          <a className="rec-cta" href="#apply">
            {c.applyBtn}
          </a>
          <a className="rec-cta-sub" href="#detail">
            仕事内容・募集条件を見る
          </a>
        </section>

        {/* ページ内リンク */}
        <nav className="rec-jump" aria-label="ページ内リンク">
          <a href="#jobs">仕事内容</a>
          <a href="#detail">募集条件</a>
          <a href="#faq">FAQ</a>
          <a href="#apply">応募</a>
        </nav>

        {/* 仕事内容 */}
        <section className="rec-sec" id="jobs">
          <div className="rec-sec-h">
            <span className="rec-sec-en">Work</span>
            <h2 className="rec-sec-jp">仕事内容</h2>
          </div>
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

        {/* セラピスト：報酬の仕組み */}
        {c.reward && (
          <section className="rec-sec" id="reward">
            <div className="rec-sec-h">
              <span className="rec-sec-en">Reward</span>
              <h2 className="rec-sec-jp">{c.rewardTitle}</h2>
            </div>
            <CondTable rows={c.reward} />
            <p className="rec-note-small">
              報酬例は、確定した単価・件数に基づき「想定例」として掲載します。件数や収入を保証するものではありません。
            </p>
          </section>
        )}

        {/* 募集要項 / 働き方・募集条件 */}
        <section className="rec-sec" id="detail">
          <div className="rec-sec-h">
            <span className="rec-sec-en">Requirements</span>
            <h2 className="rec-sec-jp">{c.tableTitle}</h2>
          </div>
          <CondTable rows={c.table} />
          {status !== "open" && (
            <p className="rec-note-small">
              募集条件は準備中です。確定した内容のみを、確定後に掲載します。
            </p>
          )}
        </section>

        {/* 向いている人（スタッフのみ） */}
        {c.fit && (
          <section className="rec-sec">
            <div className="rec-sec-h">
              <span className="rec-sec-en">Fit</span>
              <h2 className="rec-sec-jp">向いている人</h2>
            </div>
            <ul className="rec-fit">
              {c.fit.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </section>
        )}

        {/* 入店後の流れ（スタッフ） / 研修・相談体制（セラピスト） */}
        <section className="rec-sec">
          <div className="rec-sec-h">
            <span className="rec-sec-en">{c.flow ? "Onboarding" : "Support"}</span>
            <h2 className="rec-sec-jp">{c.flowTitle}</h2>
          </div>
          {c.flow ? (
            <ol className="rec-flow">
              {c.flow.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : null}
          <p className="rec-note-small">{c.flowNote}</p>
        </section>

        {/* 職場の雰囲気（セラピスト） */}
        {c.atmosphereNote && (
          <section className="rec-sec">
            <div className="rec-sec-h">
              <span className="rec-sec-en">Atmosphere</span>
              <h2 className="rec-sec-jp">職場の雰囲気</h2>
            </div>
            <p className="rec-note-small">{c.atmosphereNote}</p>
          </section>
        )}

        {/* FAQ */}
        <section className="rec-sec" id="faq">
          <div className="rec-sec-h">
            <span className="rec-sec-en">FAQ</span>
            <h2 className="rec-sec-jp">よくあるご質問</h2>
          </div>
          <div className="rec-faq">
            {c.faqs.map((q, i) => (
              <details className="rec-faq-item" key={i}>
                <summary>{q}</summary>
                <div className="rec-faq-a">
                  募集条件の確定後に掲載します。お急ぎの場合は、下の応募フォームからお気軽にお問い合わせください。
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* 応募の流れ＋フォーム */}
        <section className="rec-sec" id="apply">
          <div className="rec-sec-h">
            <span className="rec-sec-en">Apply</span>
            <h2 className="rec-sec-jp">応募の流れ</h2>
          </div>
          <ol className="rec-flow">
            {c.applyFlow.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <RecruitForm role={role} />
        </section>

        {/* もう一方の求人へ */}
        <a className="rec-otherlink" href={`${BASE}${c.other.slug}/`}>
          <span className="rec-otherlink-note">{c.other.note}</span>
          <span className="rec-otherlink-label">{c.other.label} →</span>
        </a>

        {/* お客様向けの導線（迷い込んだ来店客のため） */}
        <a className="rec-guestlink" href={`${BASE}reserve/`}>
          ご予約・サービスをお探しのお客様はこちら →
        </a>

        <SiteChrome base={BASE} hideFooterbar />
      </div>

      {/* スマホ下部：応募固定バー（来店客用の予約バーとは別） */}
      <div className="rec-applybar">
        <a className="rec-applybar-btn" href="#apply">
          {c.applyBtn}
        </a>
        <a className="rec-applybar-alt" href={`${BASE}reserve/`}>
          ご予約(お客様)
        </a>
      </div>
    </div>
  );
}
