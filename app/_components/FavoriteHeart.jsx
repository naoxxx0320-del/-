"use client";

// お気に入りハート。端末(localStorage)に保存し、押すたびに全カード＆一覧へ即反映。
import { useEffect, useState } from "react";

const KEY = "aroma_favorites";

export function readFavs() {
  if (typeof window === "undefined") return new Set();
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
}
function writeFavs(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {}
}

export default function FavoriteHeart({ id }) {
  const key = String(id);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(readFavs().has(key));
    sync();
    window.addEventListener("favchange", sync);
    window.addEventListener("storage", sync); // 他タブとの同期
    return () => {
      window.removeEventListener("favchange", sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);

  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const s = readFavs();
    if (s.has(key)) s.delete(key);
    else s.add(key);
    writeFavs(s);
    setOn(s.has(key));
    window.dispatchEvent(new Event("favchange"));
  };

  return (
    <button
      type="button"
      className={`staff-heart ${on ? "on" : ""}`}
      aria-pressed={on}
      aria-label={on ? "お気に入りから外す" : "お気に入りに追加"}
      onClick={toggle}
    >
      <svg viewBox="0 0 32 29" width="16" height="15" aria-hidden="true">
        <path d="M16 28C6 20.5 1.5 14.6 1.5 9.2 1.5 5.2 4.6 2.5 8.3 2.5c2.6 0 5 1.4 6.2 3.6l1.5 2.6 1.5-2.6c1.2-2.2 3.6-3.6 6.2-3.6 3.7 0 6.8 2.7 6.8 6.7 0 5.4-4.5 11.3-14.5 18.8z" />
      </svg>
    </button>
  );
}
