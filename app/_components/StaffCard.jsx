/* 従業員紹介カード（トップ「本日の出勤」／セラピスト一覧で共用）。
   写真＋斜めリボン＋ハート＋ワイン地の情報パネル（名前・年齢・T/B/W/H）。 */
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

export default function StaffCard({ t, href, base = "" }) {
  const src = photoSrc(t.photo, base);
  const rb = ribbonOf(t);
  const stats = (t.stats || [])
    .map((s) => s.replace(".", " "))
    .filter((s) => !/\s$/.test(s)) // 値が空の項目は除外
    .join(" / ");

  return (
    <a className="staff-card" href={href}>
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
          <svg viewBox="0 0 32 29" width="15" height="14">
            <path d="M16 28C6 20.5 1.5 14.6 1.5 9.2 1.5 5.2 4.6 2.5 8.3 2.5c2.6 0 5 1.4 6.2 3.6l1.5 2.6 1.5-2.6c1.2-2.2 3.6-3.6 6.2-3.6 3.7 0 6.8 2.7 6.8 6.7 0 5.4-4.5 11.3-14.5 18.8z" />
          </svg>
        </span>
        <div className="staff-name">
          {t.name}
          {t.age && (
            <span className="staff-age">
              <span className="staff-dia" aria-hidden="true">
                ◆
              </span>
              ({t.age})
            </span>
          )}
        </div>
        {stats && <div className="staff-stats">{stats}</div>}
      </div>
    </a>
  );
}
