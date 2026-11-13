"use client";

import { useCallback, useEffect, useState } from "react";
import { photoSrc } from "../_components/photo";

const BASE = "../"; // /gallery/ はルートから1階層下

// 表示する写真。実写真をいただければ public/ に追加し、この配列に足すだけで反映されます。
// ※セラピスト個人の写真はここに直接書かない（退店・削除で画像が消えるとリンク切れになるため）。
//   「みお」「花恋」は 2026/11/10 に管理画面から削除済みで、画像ファイルも無いため外した。
// ※「ルーム｜」は実際のルーム写真。それ以外の空間・イメージ写真は実写ではないため（イメージ）と明記する。
const GALLERY = [
  { photo: "room-lounge.jpg", caption: "ルーム｜くつろぎスペース" },
  { photo: "room-bed.jpg", caption: "ルーム｜施術スペース" },
  { photo: "room-bath.jpg", caption: "ルーム｜バスルーム" },
  { photo: "environment.jpg", caption: "プライベート空間（イメージ）" },
  { photo: "concept.jpg", caption: "上質なひとときを（イメージ）" },
  { photo: "therapist-intro.jpg", caption: "セラピスト（イメージ）" },
  { photo: "hero-banner.jpg", caption: "AROMA DIAMOND｜亀戸" },
];

export default function GalleryClient() {
  const [index, setIndex] = useState(null); // ライトボックスで開いている写真
  const open = index !== null;

  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(
    () => setIndex((i) => (i === null ? i : (i - 1 + GALLERY.length) % GALLERY.length)),
    []
  );
  const next = useCallback(
    () => setIndex((i) => (i === null ? i : (i + 1) % GALLERY.length)),
    []
  );

  // キーボード操作（Esc で閉じる／←→ で移動）と背景スクロール抑止
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, prev, next]);

  return (
    <>
      <div className="gal-grid">
        {GALLERY.map((g, i) => (
          <button
            type="button"
            className="gal-item"
            key={g.photo}
            style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
            onClick={() => setIndex(i)}
            aria-label={`${g.caption} を拡大表示`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc(g.photo, BASE)} alt={g.caption} loading="lazy" />
            <span className="gal-cap">{g.caption}</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="gal-lightbox" onClick={close} role="dialog" aria-modal="true">
          <button className="gal-close" aria-label="閉じる" onClick={close}>
            ✕
          </button>
          <button
            className="gal-nav prev"
            aria-label="前の写真"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
          >
            ‹
          </button>
          <figure className="gal-figure" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc(GALLERY[index].photo, BASE)} alt={GALLERY[index].caption} />
            <figcaption>{GALLERY[index].caption}</figcaption>
          </figure>
          <button
            className="gal-nav next"
            aria-label="次の写真"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}
