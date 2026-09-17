"use client";

import { useState } from "react";

/* セラピスト詳細ページのメイン写真＋サムネイル。
   サムネイルをタップするとメイン写真が切り替わる。
   photos は解決済みの src 配列（写真が無い場合は空）。 */
export default function TherapistGallery({
  photos = [],
  name,
  ribbon,
  heart = "dia",
  heartLabel = "◆",
}) {
  const [active, setActive] = useState(0);
  const has = photos.length > 0;

  return (
    <div className="td-gallery">
      <div className="td-main" style={{ background: "#efe6d3" }}>
        {ribbon && <span className="tp-ribbon">{ribbon}</span>}
        {has ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="td-main-img" src={photos[active]} alt={name} />
        ) : (
          <div className={`tp-heart ${heart}`}>
            <svg className="tp-heart-bg" viewBox="0 0 32 29" aria-hidden="true">
              <path d="M16 28C6 20.5 1.5 14.6 1.5 9.2 1.5 5.2 4.6 2.5 8.3 2.5c2.6 0 5 1.4 6.2 3.6l1.5 2.6 1.5-2.6c1.2-2.2 3.6-3.6 6.2-3.6 3.7 0 6.8 2.7 6.8 6.7 0 5.4-4.5 11.3-14.5 18.8z" />
            </svg>
            {heart === "aj" ? (
              <span className="tp-heart-txt">{heartLabel}</span>
            ) : (
              <svg className="tp-heart-dia" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 9 L12 2.5 L19.5 9 L12 21.5 Z" fill="none" stroke="#8a1f2d" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M4.5 9 H19.5 M9 9 L12 21.5 M15 9 L12 21.5 M9 9 L12 2.5 M15 9 L12 2.5" fill="none" stroke="#8a1f2d" strokeWidth="0.9" />
              </svg>
            )}
          </div>
        )}
      </div>

      {has && photos.length > 1 && (
        <div className="td-thumbs">
          {photos.map((p, i) => (
            <button
              className={`td-thumb ${i === active ? "on" : ""}`}
              key={i}
              onClick={() => setActive(i)}
              aria-label={`写真${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
