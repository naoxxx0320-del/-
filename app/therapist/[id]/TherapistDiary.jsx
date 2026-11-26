/* 個別ページの「写メ日記」：02（メンズエステ専門SNS）でセラピスト本人が書いた投稿を、新しい順に表示。
   data/diary.json はビルドのたびに scripts/fetch-diary.mjs が作る（02 運営・本人の了承済み）。
   画像は 02 の配信元から読み込む（こちらには保存しない）。本文は文字として表示（HTMLとしては扱わない）。 */
import diary from "../../../data/diary.json";

const MAX_SHOW = 5; // ページが長くなりすぎないよう、新しい5件まで（続きは 02 へのリンク）

function fmt(at) {
  const m = String(at || "").match(/^\d{4}-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${+m[1]}/${+m[2]} ${m[3]}:${m[4]}` : "";
}

export default function TherapistDiary({ name, displayName }) {
  const all = (diary && diary.posts && diary.posts[name]) || [];
  const posts = all.slice(0, MAX_SHOW);
  const profile = all.find((p) => p.url)?.url || "";
  return (
    <div className="td-comment td-box td-diary" id="diary">
      <span className="tdc-corner tl" aria-hidden="true" />
      <span className="tdc-corner tr" aria-hidden="true" />
      <span className="tdc-corner bl" aria-hidden="true" />
      <span className="tdc-corner br" aria-hidden="true" />
      <h2 className="tdc-head">
        <span className="tdc-dia">◆</span>
        写メ日記
        <span className="tdc-dia">◆</span>
      </h2>
      {posts.length === 0 ? (
        <p className="tdq-empty">{displayName}さんの写メ日記は、まだありません。</p>
      ) : (
        <ul className="tdd-list">
          {posts.map((p) => (
            <li className="tdd-item" key={p.id}>
              <div className="tdd-date">{fmt(p.at)}</div>
              {p.images[0] && (
                <img className="tdd-img" src={p.images[0]} alt={`${displayName}さんの写メ日記の写真`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              )}
              {p.text && (
                <p className="tdd-text">
                  {p.text.split("\n").map((line, k, arr) => (
                    <span key={k}>
                      {line}
                      {k < arr.length - 1 && <br />}
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {profile && (
        <a className="tdd-more" href={profile} target="_blank" rel="noopener nofollow">
          02（ゼロツー）で{displayName}さんの日記をもっと見る ›
        </a>
      )}
    </div>
  );
}
