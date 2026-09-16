import SiteChrome from "../_components/SiteChrome";

export const metadata = {
  title: "セラピスト｜AROMA DAIAMOND 亀戸 メンズエステ",
  description: "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 在籍セラピスト一覧。",
};

/* 在籍セラピスト（プレースホルダー：後で編集できます） */
const THERAPISTS = [
  {
    name: "柊 雫",
    age: 22,
    height: 154,
    cup: "C",
    heart: "aj",
    ribbon: false,
    fgn: true,
    tags: ["ピュア妹系", "スレンダー美女", "透明感抜群", "愛情たっぷり"],
    bg: "linear-gradient(160deg,#e7dac2 0%,#d4c09e 55%,#c8b58c 100%)",
  },
  {
    name: "早乙女 せいら",
    age: 28,
    height: 165,
    cup: "E",
    heart: "dia",
    ribbon: true,
    fgn: false,
    tags: ["超絶美女", "高身長", "高リピート率", "大人の魅力"],
    bg: "linear-gradient(160deg,#efe6d6 0%,#ddccb0 55%,#cebf9f 100%)",
  },
  {
    name: "月森 りん",
    age: 24,
    height: 158,
    cup: "D",
    heart: "dia",
    ribbon: false,
    fgn: true,
    tags: ["清楚系", "美脚", "小顔美人", "癒やし上手"],
    bg: "linear-gradient(160deg,#e9dcc6 0%,#d0bd97 55%,#c4b184 100%)",
  },
  {
    name: "神崎 りりな",
    age: 21,
    height: 160,
    cup: "C",
    heart: "aj",
    ribbon: true,
    fgn: false,
    tags: ["モデル系", "明るい性格", "テク抜群", "指名多数"],
    bg: "linear-gradient(160deg,#efe7d8 0%,#dccdb2 55%,#ccbd9c 100%)",
  },
  {
    name: "白雪 おと",
    age: 23,
    height: 162,
    cup: "D",
    heart: "dia",
    ribbon: false,
    fgn: true,
    tags: ["色白美肌", "おっとり", "包容力", "リピート必至"],
    bg: "linear-gradient(160deg,#e6d9c1 0%,#cfbc94 55%,#c3b082 100%)",
  },
  {
    name: "音羽 みみ",
    age: 20,
    height: 156,
    cup: "B",
    heart: "aj",
    ribbon: true,
    fgn: false,
    tags: ["新人", "ロリ可愛い", "純真無垢", "甘えん坊"],
    bg: "linear-gradient(160deg,#eee6d4 0%,#dbcaad 55%,#cbbb98 100%)",
  },
];

function Heart({ kind }) {
  return (
    <div className={`tp-heart ${kind}`}>
      <svg className="tp-heart-bg" viewBox="0 0 32 29" aria-hidden="true">
        <path d="M16 28C6 20.5 1.5 14.6 1.5 9.2 1.5 5.2 4.6 2.5 8.3 2.5c2.6 0 5 1.4 6.2 3.6l1.5 2.6 1.5-2.6c1.2-2.2 3.6-3.6 6.2-3.6 3.7 0 6.8 2.7 6.8 6.7 0 5.4-4.5 11.3-14.5 18.8z" />
      </svg>
      {kind === "aj" ? (
        <span className="tp-heart-txt">AJ</span>
      ) : (
        <svg className="tp-heart-dia" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 9 L12 2.5 L19.5 9 L12 21.5 Z" fill="none" stroke="#8a1f2d" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M4.5 9 H19.5 M9 9 L12 21.5 M15 9 L12 21.5 M9 9 L12 2.5 M15 9 L12 2.5" fill="none" stroke="#8a1f2d" strokeWidth="0.9" />
        </svg>
      )}
    </div>
  );
}

export default function Therapist() {
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
          <div className="ph-en">Therapist</div>
          <div className="ph-jp">セラピスト</div>
        </div>

        <section className="tp-grid">
          {THERAPISTS.map((t, i) => (
            <article className="tp-card" key={i}>
              <div className="tp-photo" style={{ background: t.bg }}>
                {t.ribbon && <span className="tp-ribbon">出勤</span>}
                <Heart kind={t.heart} />
                <div className="tp-badges">
                  {t.fgn && <span className="tp-badge fgn">FGN</span>}
                  <span className="tp-badge b02">02</span>
                  <span className="tp-badge brk">R</span>
                </div>
              </div>
              <div className="tp-body">
                <div className="tp-name">{t.name}</div>
                <div className="tp-sub">
                  {t.age}歳 {t.height}cm ({t.cup})
                </div>
                <div className="tp-tags">
                  {t.tags.map((tag, j) => (
                    <span className="tp-tag" key={j}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
