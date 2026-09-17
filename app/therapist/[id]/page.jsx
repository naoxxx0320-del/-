import SiteChrome from "../../_components/SiteChrome";
import { photoSrc } from "../../_components/photo";
import roster from "../../../data/roster.json";
import TherapistGallery from "./TherapistGallery";

const BASE = "../../"; // /therapist/[id]/ はルートから2階層下

// 各セラピストを静的ページとして書き出す（/therapist/1/ … の連番）
export function generateStaticParams() {
  return roster.map((_, i) => ({ id: String(i + 1) }));
}

function pick(idx) {
  return roster[idx - 1];
}

export function generateMetadata({ params }) {
  const t = pick(Number(params.id));
  const nm = t?.name || "セラピスト";
  return {
    title: `${nm}｜AROMA DAIAMOND 亀戸 メンズエステ`,
    description: `AROMA DAIAMOND（アロマ ダイアモンド）亀戸 セラピスト「${nm}」のプロフィール。`,
  };
}

// stats(["T.158","B.86(D)",...]) → 表示用の三サイズ行
function sizeRows(t) {
  const val = (p) =>
    (t.stats || []).find((s) => s.startsWith(p + "."))?.slice(p.length + 1) || "";
  return [
    { k: "T", v: t.height ? `${t.height}cm` : val("T") ? `${val("T")}cm` : "" },
    { k: "B", v: val("B") },
    { k: "W", v: val("W") },
    { k: "H", v: val("H") },
  ].filter((r) => r.v);
}

export default function TherapistDetail({ params }) {
  const t = pick(Number(params.id));
  if (!t) return null;

  const photos = (t.photos && t.photos.length
    ? t.photos
    : t.photo
    ? [t.photo]
    : []
  ).map((p) => photoSrc(p, BASE));

  const rows = sizeRows(t);

  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background: "#f4efe7 url(../../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <div className="page-head">
          <div className="ph-en">Therapist</div>
          <div className="ph-jp">セラピスト紹介</div>
        </div>

        <section className="td-wrap">
          <TherapistGallery
            photos={photos}
            name={t.name}
            ribbon={t.ribbon || (t.absent ? null : "出勤")}
            heart={t.heart === "diamond" ? "dia" : "aj"}
            heartLabel={t.heartLabel || "◆"}
          />

          <div className="td-info">
            <div className="td-name">
              <span className="nm">{t.name}</span>
              {t.age && <span className="ag">（{t.age}）</span>}
              {t.isNew && <span className="td-new">新人</span>}
            </div>

            {rows.length > 0 && (
              <div className="td-size">
                {rows.map((r) => (
                  <div className="td-size-item" key={r.k}>
                    <b>{r.k}</b>
                    <span>{r.v}</span>
                  </div>
                ))}
                {t.cup && (
                  <div className="td-size-item">
                    <b>Cup</b>
                    <span>{t.cup}</span>
                  </div>
                )}
              </div>
            )}

            {(t.tags || []).length > 0 && (
              <div className="td-tags">
                {t.tags.map((tag, j) => (
                  <span className="tp-tag" key={j}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {t.sched && (
              <div className="td-sched">
                <span className="clock">🕐</span>
                <span>{t.sched}</span>
                {t.status && (
                  <span
                    className={`td-status ${t.status === "満員" ? "full" : ""}`}
                  >
                    {t.status}
                  </span>
                )}
              </div>
            )}

            {t.profile ? (
              <div className="td-profile">
                <div className="td-profile-h">プロフィール</div>
                <p>{t.profile}</p>
              </div>
            ) : null}

            <a className="td-back" href="../">
              ← セラピスト一覧へ戻る
            </a>
          </div>
        </section>

        <SiteChrome base={BASE} />
      </div>
    </div>
  );
}
