"use client";

import { useEffect, useState } from "react";
import StaffCard from "../_components/StaffCard";
import { readFavs } from "../_components/FavoriteHeart";

const TABS = [
  { key: "all", label: "すべて" },
  { key: "today", label: "本日出勤" },
  { key: "new", label: "新人" },
  { key: "pop", label: "人気" },
  { key: "rec", label: "おすすめ" },
  { key: "fav", label: "♥ お気に入り" },
];

function match(t, key, favs) {
  const tags = t.tags || [];
  switch (key) {
    case "today":
      return !t.absent;
    case "new":
      return !!t.isNew;
    case "pop":
      return tags.includes("人気");
    case "rec":
      return tags.includes("おすすめ");
    case "fav":
      return favs.has(String(t.id));
    default:
      return true;
  }
}

export default function TherapistDirectory({ roster }) {
  const [tab, setTab] = useState("all");
  const [favs, setFavs] = useState(new Set());

  // お気に入り（localStorage）を読み込み、変更に追従
  useEffect(() => {
    const sync = () => setFavs(readFavs());
    sync();
    window.addEventListener("favchange", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("favchange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const list = roster.filter((t) => match(t, tab, favs));

  return (
    <>
      <div className="staff-tabs">
        <span className="staff-tabs-dia" aria-hidden="true">
          ◆
        </span>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            className={`staff-tab ${tab === tb.key ? "on" : ""}`}
            aria-pressed={tab === tb.key}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="therapists-empty">
          {tab === "fav"
            ? "お気に入りはまだありません。カード右上の♥を押すと登録できます。"
            : "該当するセラピストはいません。"}
        </p>
      ) : (
        <section className="staff-grid">
          {list.map((t, i) => (
            <StaffCard key={t.id ?? i} t={t} href={`${t.id ?? i + 1}/`} base="../" />
          ))}
        </section>
      )}
    </>
  );
}
