"use client";
/* デジタル会員証：URLの k（ご本人だけが知るキー）で会員情報・来店ランクを表示。 */
import { useEffect, useState } from "react";
import { jsonp } from "../api";
import MemberCard from "../MemberCard";

const NEXT = { "": [1, "SILVER"], SILVER: [3, "GOLD"], GOLD: [6, "DIAMOND"] };

export default function CardView() {
  const [s, setS] = useState({ loading: true });
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("k") || "";
    if (!/^[0-9a-f]{32,48}$/.test(k)) { setS({ error: "会員証のURLが正しくありません。ご登録時のメールのURLから開いてください。" }); return; }
    jsonp({ action: "member_card", k }).then((r) => {
      if (r && r.ok) setS({ card: r });
      else setS({ error: (r && r.reason) || "会員証を読み込めませんでした。時間をおいてもう一度お試しください。" });
    });
  }, []);

  const c = s.card;
  const next = c ? NEXT[c.rank || ""] : null;
  return (
    <section className="mb-sec mb-cardpage">
      <p className="mb-sec-en">MEMBER CARD</p>
      <h1 className="mb-sec-h">デジタル会員証</h1>
      {s.loading && <p className="mb-note">読み込み中…</p>}
      {s.error && <p className="mb-error">{s.error}</p>}
      {c && (
        <>
          <MemberCard memberNo={c.memberNo} kind={c.kind} nickname={c.nickname} validUntil={c.validUntil} />
          {c.kind === "VIP" && !c.vipActive && <p className="mb-note">OPENING VIP の特典期間は終了しました。来店ランクの特典は引き続きご利用いただけます。</p>}
          <div className="mb-myrank">
            <p className="mb-myrank-label">現在の会員ランク</p>
            <p className={`mb-myrank-name mb-rk-${(c.rank || "none").toLowerCase()}`}>{c.rank || "初回ご来店後に付与"}</p>
            <p className="mb-myrank-visits">直近6か月のご来店：{c.visits}回</p>
            {next && <p className="mb-note">あと{next[0] - c.visits}回のご来店で {next[1]} にランクアップ</p>}
          </div>
          <p className="mb-note">ご来店時にこの画面をご提示ください。来店回数は、有料の施術を完了したご来店のみを数えます（反映は施術完了の確認後）。このページのURLはご本人専用です。</p>
        </>
      )}
      <a className="mb-card-link" href="../">会員制度について</a>
    </section>
  );
}
