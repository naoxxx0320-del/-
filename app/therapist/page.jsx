import SiteChrome from "../_components/SiteChrome";
import { photoSrc } from "../_components/photo";
import roster from "../../data/roster.json";

export const metadata = {
  title: "セラピスト｜AROMA DAIAMOND 亀戸 メンズエステ",
  description: "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 在籍セラピスト一覧。",
};

// 在籍セラピスト一覧（「本日の出勤」シートから紐づけ）
const THERAPISTS = roster.map((t, i) => ({
  id: t.id ?? i + 1,
  name: t.name,
  age: t.age,
  height: t.height || (t.stats?.[0] || "").replace("T.", ""),
  cup: t.cup || "",
  heart: t.heart === "diamond" ? "dia" : "aj",
  ribbon: !!t.ribbon,
  fgn: (t.sns || []).includes("fgn"),
  tags: t.tags || [],
  photo: t.photo,
  bg: t.photoBg,
}));

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

        {THERAPISTS.length === 0 ? (
          <p className="therapists-empty">セラピスト情報は準備中です。</p>
        ) : (
          <section className="tp-grid">
            {THERAPISTS.map((t, i) => (
              <a className="tp-card" href={`${t.id}/`} key={i}>
                <div className="tp-photo" style={{ background: t.bg }}>
                  {t.ribbon && <span className="tp-ribbon">出勤</span>}
                  {t.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="tp-photo-img"
                      src={photoSrc(t.photo, "../")}
                      alt={t.name}
                    />
                  ) : (
                    <Heart kind={t.heart} />
                  )}
                  <div className="tp-badges">
                    {t.fgn && <span className="tp-badge fgn">FGN</span>}
                    <span className="tp-badge b02">02</span>
                    <span className="tp-badge brk">R</span>
                  </div>
                </div>
                <div className="tp-body">
                  <div className="tp-name">{t.name}</div>
                  <div className="tp-sub">
                    {t.age && `${t.age}歳 `}
                    {t.height && `${t.height}cm `}
                    {t.cup && `(${t.cup})`}
                  </div>
                  {t.tags.length > 0 && (
                    <div className="tp-tags">
                      {t.tags.map((tag, j) => (
                        <span className="tp-tag" key={j}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </section>
        )}

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
