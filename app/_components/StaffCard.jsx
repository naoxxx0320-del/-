/* 従業員紹介カード（トップ「本日の出勤」／セラピスト一覧／出勤情報で共用）。
   角丸ゴールド二重フレーム＋上部コーナー装飾＋斜めリボン＋ワイン地の情報パネル
   （名前・ダイヤ＋年齢・T/B/W/H）＋ゴールドのハート。
   出勤情報ページ用に sched（出勤時間）/ status（空き状況）/ reserveHref（予約）を任意で表示。 */
import { photoSrc } from "./photo";

// 表示するリボン（優先度：本日出勤 > 人気 > おすすめ > 新人）
export function ribbonOf(t) {
  const tags = t.tags || [];
  if (!t.absent) return { label: "本日出勤", cls: "today" };
  if (tags.includes("人気")) return { label: "人気", cls: "pop" };
  if (tags.includes("おすすめ")) return { label: "おすすめ", cls: "rec" };
  if (t.isNew) return { label: "新人", cls: "new" };
  return null;
}

// 空き状況 → 色分けクラス（空きあり=緑 / 残りわずか=橙 / 満員=灰）
function statusClass(status) {
  const s = String(status || "");
  if (s.includes("満")) return "full";
  if (s.includes("わずか") || s.includes("残")) return "few";
  if (s.includes("空き") || s.includes("受付")) return "ok";
  return "ok";
}

// 上部コーナーのゴールド装飾
function Corner({ pos }) {
  return (
    <span className={`staff-corner ${pos}`} aria-hidden="true">
      <svg viewBox="0 0 46 46" width="34" height="34">
        <path
          d="M3 44 L3 17 Q3 3 17 3 L44 3"
          fill="none"
          stroke="#e6cd8c"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10 44 L10 19 Q10 10 19 10 L44 10"
          fill="none"
          stroke="#caa25a"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M3 17 L10 10"
          fill="none"
          stroke="#e6cd8c"
          strokeWidth="1"
        />
      </svg>
    </span>
  );
}

export default function StaffCard({
  t,
  href,
  base = "",
  sched,
  status,
  reserveHref,
}) {
  const src = photoSrc(t.photo, base);
  const rb = ribbonOf(t);
  const stats = (t.stats || [])
    .map((s) => s.replace(".", " "))
    .filter((s) => !/\s$/.test(s))
    .join(" / ");
  const scls = statusClass(status);
  const isFull = scls === "full";

  return (
    <article className="staff-card">
      <div className="staff-card-inner">
        <Corner pos="tl" />
        <Corner pos="tr" />
        <a className="staff-hit" href={href}>
          <div className="staff-photo" style={{ background: t.photoBg }}>
            {rb && <span className={`staff-ribbon ${rb.cls}`}>{rb.label}</span>}
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="staff-photo-img" src={src} alt={t.name} loading="lazy" />
            ) : (
              <span className="staff-ph-dia" aria-hidden="true">
                ◆
              </span>
            )}
          </div>

          <div className="staff-info">
            <span className="staff-heart" aria-hidden="true">
              <svg viewBox="0 0 32 29" width="16" height="15">
                <path d="M16 28C6 20.5 1.5 14.6 1.5 9.2 1.5 5.2 4.6 2.5 8.3 2.5c2.6 0 5 1.4 6.2 3.6l1.5 2.6 1.5-2.6c1.2-2.2 3.6-3.6 6.2-3.6 3.7 0 6.8 2.7 6.8 6.7 0 5.4-4.5 11.3-14.5 18.8z" />
              </svg>
            </span>

            <div className="staff-name">{t.name}</div>

            {t.age && (
              <div className="staff-age-row">
                <svg className="staff-gem" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M5 9 L12 3 L19 9 L12 21 Z" fill="#d9b978" />
                  <path
                    d="M5 9 H19 M9.2 9 L12 21 M14.8 9 L12 21 M9.2 9 L12 3 M14.8 9 L12 3"
                    fill="none"
                    stroke="#7a0f1f"
                    strokeWidth="0.7"
                  />
                </svg>
                <span className="staff-age">({t.age})</span>
              </div>
            )}

            {stats && <div className="staff-stats">{stats}</div>}

            {sched && (
              <div className="staff-sched">
                <span className="staff-sched-clock" aria-hidden="true">🕐</span>
                <span>{sched}</span>
              </div>
            )}
          </div>
        </a>

        {status && (
          <div className={`staff-status ${scls}`}>
            <span className="staff-status-dot" aria-hidden="true" />
            {status}
          </div>
        )}

        {reserveHref &&
          (isFull ? (
            <div className="staff-reserve disabled" aria-disabled="true">
              満員（予約不可）
            </div>
          ) : (
            <a className="staff-reserve" href={reserveHref}>
              この時間で予約する →
            </a>
          ))}
      </div>
    </article>
  );
}
