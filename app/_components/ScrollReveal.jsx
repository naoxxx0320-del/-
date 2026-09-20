"use client";

// スクロールに応じて各セクションをふわっと表示させる演出。
// ・prefers-reduced-motion を尊重（OFFのユーザーには一切適用しない）
// ・JSが無効／失敗しても内容が消えないよう、<head> の即時スクリプトで
//   .reveal-ready を付与し、初期化されなければ自動解除するフォールバック付き
//   （globals.css の .reveal-ready ルールと下記セレクタを対で管理）
import { useEffect } from "react";

// globals.css の隠し状態と同じ対象を指定する（要同期）
const SELECTOR = [
  ".page-head",
  ".section-head",
  ".info-head",
  ".frame",
  ".concept",
  ".reserve",
  ".campaign",
  ".therapists > *",
  ".rsv-sec",
  ".rsv-steps",
  ".rsv-summary",
  ".rsv-notes",
].join(",");

export default function ScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__revealInit = true; // <head> フォールバックの自動解除を止める

    const root = document.documentElement;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // 演出しない場合は隠し状態を必ず解除して全表示
    if (reduce || !("IntersectionObserver" in window)) {
      root.classList.remove("reveal-ready");
      return;
    }
    root.classList.add("reveal-ready");

    const els = Array.from(document.querySelectorAll(SELECTOR));
    if (els.length === 0) {
      root.classList.remove("reveal-ready");
      return;
    }

    // 同じ親の中では順番に遅延させて“流れる”ように見せる
    const seen = new Map();
    els.forEach((el) => {
      const p = el.parentElement;
      const n = seen.get(p) || 0;
      seen.set(p, n + 1);
      const delay = Math.min(n * 70, 350);
      if (delay) el.style.transitionDelay = `${delay}ms`;
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("reveal-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  return null;
}
