/* 出勤セラピストカード（トップの「本日の出勤」と出勤情報ページで共用）。
   欠損フィールドに強い作り（stats / sns が無くても崩れない）。 */

import { photoSrc as buildPhotoSrc } from "./photo";

export function SnsBadge({ kind }) {
  const map = {
    fgn: (
      <div className="s fgn" key="fgn">
        <span>FGN</span>
        <span>WELCOME</span>
      </div>
    ),
    blue: (
      <div className="s blue" key="blue">
        ✦
      </div>
    ),
    x: (
      <div className="s x" key="x">
        𝕏
      </div>
    ),
    zero2: (
      <div className="s zero2" key="zero2">
        02
      </div>
    ),
    insta: (
      <div className="s insta" key="insta">
        ⌾
      </div>
    ),
    relaxi: (
      <div className="s relaxi" key="relaxi">
        R
      </div>
    ),
  };
  return map[kind] || null;
}

/* 空き状況テキスト → 色分け用クラス（空きあり=緑 / 残りわずか=橙 / 満員=灰） */
export function statusClass(status) {
  const s = String(status || "");
  if (s.includes("満")) return "full";
  if (s.includes("わずか") || s.includes("残")) return "few";
  if (s.includes("空き") || s.includes("受付")) return "ok";
  return "";
}

export default function TherapistCard({ t, base = "", href, reserveHref }) {
  const stats = t.stats || [];
  const sns = t.sns || [];
  const photoSrc = buildPhotoSrc(t.photo, base);
  const isFull = statusClass(t.status) === "full";

  // 詳細ページへのリンク（あれば）で写真〜ステータスを包む。
  // 予約ボタンは別リンクのため、アンカーの入れ子を避けて分離する。
  const Hit = href ? "a" : "div";
  const content = (
    <Hit className="tcard-hit" {...(href ? { href } : {})}>
      <div className="tcard-photo" style={{ background: t.photoBg }}>
        {t.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="tcard-img" src={photoSrc} alt={t.name} />
        ) : (
          <>
            <div className="silhouette" />
            <div className={`face-heart ${t.heart || "diamond"}`}>
              <span>{t.heartLabel || "◆"}</span>
            </div>
          </>
        )}
        {t.ribbon && (
          <div className="ribbon">
            <span>{t.ribbon}</span>
          </div>
        )}
        {t.isNew && <div className="newbadge">新人</div>}
        {sns.length > 0 && (
          <div className="sns">
            {sns.map((k) => (
              <SnsBadge kind={k} key={k} />
            ))}
          </div>
        )}
      </div>

      <div className="tcard-body">
        <div className="tcard-name">
          <span className="nm">{t.name}</span>
          {t.age && <span className="ag">（{t.age}）</span>}
        </div>
        {stats.length > 0 && (
          <div className="tcard-stats">
            {stats.map((s, i) => {
              const [a, b] = s.split(".");
              return (
                <div className="st" key={i}>
                  <b>{a}</b> {b}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {t.sched && (
        <div className="tcard-sched">
          <span className="clock">🕐</span>
          <span>
            {t.sched}
            {t.schedSub && <span className="st-sub">{t.schedSub}</span>}
          </span>
        </div>
      )}
      {t.status && (
        <div className={`tcard-status ${statusClass(t.status)}`}>
          <span className="tcard-status-dot" aria-hidden="true" />
          {t.status}
        </div>
      )}
    </Hit>
  );

  return (
    <article className="tcard">
      {content}
      {reserveHref && !isFull && (
        <a className="tcard-reserve" href={reserveHref}>
          この時間で予約する →
        </a>
      )}
      {reserveHref && isFull && (
        <div className="tcard-reserve disabled" aria-disabled="true">
          満員（予約不可）
        </div>
      )}
    </article>
  );
}
