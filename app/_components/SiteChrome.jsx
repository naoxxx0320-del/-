"use client";

import { useState, useEffect } from "react";
import links from "../../data/links.json";

/* Shared site chrome: fixed hamburger, full footer (sitemap + copyright +
   secret entry), scroll-top and the drawer menu.
   `base` is the relative prefix to the site root:
     ""    on the top page  (links like "therapist/")
     "../" on a sub-page    (links like "../therapist/")               */

const DRAWER = [
  { jp: "トップ", slug: "" },
  { jp: "アクセス", slug: "access" },
  { jp: "出勤情報", slug: "schedule" },
  { jp: "外国人の方へ", slug: "foreigners" },
  { jp: "セラピスト", slug: "therapist" },
  { jp: "スタッフ求人", slug: "careers" },
  { jp: "料金システム", slug: "system" },
  { jp: "セラピスト求人", slug: "recruit" },
  { jp: "フォトギャラリー", slug: "gallery", wide: true },
];

const FOOT = [
  { en: "Top", jp: "トップ", slug: "" },
  { en: "Schedule", jp: "出勤情報", slug: "schedule" },
  { en: "Therapist", jp: "セラピスト", slug: "therapist" },
  { en: "System", jp: "料金システム", slug: "system" },
  { en: "Access", jp: "アクセス", slug: "access" },
  { en: "Foreigner", jp: "外国人の方へ", slug: "foreigners" },
  { en: "Careers", jp: "スタッフ求人", slug: "careers" },
  { en: "Recruit", jp: "セラピスト求人", slug: "recruit" },
  { en: "Flow", jp: "ご利用の流れ", slug: "flow" },
  { en: "Q & A", jp: "よくある質問", slug: null },
  { en: "Column", jp: "メンズエステコラム", slug: null },
  { en: "Terms", jp: "ご利用規約", slug: "terms" },
  { en: "Privacy", jp: "プライバシーポリシー", slug: null },
  { en: "Estate", jp: "賃貸物件情報募集", slug: null },
  { en: "Link", jp: "リンク集", slug: "links" },
  { en: "Review", jp: "ご意見フォーム", slug: null },
  { en: "Contact", jp: "お問い合わせ", slug: null },
];

export default function SiteChrome({ base = "", hideFooterbar = false }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  const home = base === "" ? "./" : base;
  const href = (slug) =>
    slug === null ? "#" : slug === "" ? home : `${base}${slug}/`;

  return (
    <>
      {/* fixed hamburger — stays pinned top-right while scrolling */}
      <button
        className="hamburger-fixed"
        aria-label="メニューを開く"
        onClick={() => setMenuOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>

      {/* ---------- SITE FOOTER (link list + copyright) ---------- */}
      <nav className="sitefoot">
        {FOOT.map((m, i) => (
          <a className="sf-row" href={href(m.slug)} key={i}>
            <span className="sf-en">{m.en}</span>
            <span className="sf-jp">{m.jp}</span>
          </a>
        ))}
      </nav>
      <div className="site-copy">
        <p className="sc-line">
          亀戸メンズエステ{" "}
          <span className="sc-brand">AROMA DAIAMOND（アロマ ダイアモンド）</span>
        </p>
        <p className="sc-copy">All rights reserved.</p>
        <a
          className="secret-entry"
          href={`${base}secret/`}
          aria-label="SECRET SPACE 秘密の空間"
        >
          <span className="se-dia" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30">
              <path d="M4.5 9 L12 2.5 L19.5 9 L12 21.5 Z" fill="none" stroke="#c8a659" strokeWidth="1.1" strokeLinejoin="round" />
              <path d="M4.5 9 H19.5 M9 9 L12 21.5 M15 9 L12 21.5 M9 9 L12 2.5 M15 9 L12 2.5" fill="none" stroke="#c8a659" strokeWidth="0.8" />
            </svg>
          </span>
          <span className="se-txt">SECRET SPACE</span>
        </a>
      </div>

      {/* ---------- FIXED FOOTER ---------- */}
      <button
        className="scrolltop"
        aria-label="ページ上部へ"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        ⌃
      </button>
      <div className="footerbar" style={hideFooterbar ? { display: "none" } : undefined}>
        <a className="fb-tel" href="tel:0000000000">
          Tel:00-0000-0000
        </a>
        <a className="fb-btn" href={links.line} target="_blank" rel="noopener noreferrer">
          <span className="fb-ic" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="26" height="26">
              <rect x="2" y="2" width="28" height="28" rx="8" fill="#06c755" />
              <path d="M16 8.2c-5 0-9 3.1-9 6.9 0 3.4 3.1 6.3 7.4 6.85.28.06.66.19.76.43.08.22.05.55.03.77l-.12.72c-.04.22-.18.86.77.47.95-.4 5.1-3 6.96-5.14C21.9 24.9 25 22.1 25 15.1c0-3.8-4-6.9-9-6.9z" fill="#fff" />
            </svg>
          </span>
          <span className="fb-txt">
            <b>LINE</b>
            <small>予約</small>
          </span>
        </a>
        <a className="fb-btn" href={`${base}reserve/`}>
          <span className="fb-ic" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="#edd39b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
              <rect x="3.5" y="6" width="25" height="16" rx="2" />
              <path d="M12 26 H20 M16 22 V26" />
            </svg>
          </span>
          <span className="fb-txt">
            <b>WEB</b>
            <small>予約</small>
          </span>
        </a>
      </div>

      {/* ---------- HAMBURGER MENU ---------- */}
      <div className={`menu-overlay ${menuOpen ? "open" : ""}`}>
        <div className="menu-panel">
          <button
            className="menu-close"
            aria-label="メニューを閉じる"
            onClick={() => setMenuOpen(false)}
          >
            ✕
          </button>

          <div className="menu-logo">
            <div className="ml-sub">men&apos;s esthetic</div>
            <div className="ml-en">
              <span className="gold">A</span>ROMA <span className="gold">D</span>AIAMOND
            </div>
            <div className="ml-jp">アロマ ダイアモンド</div>
          </div>

          <div className="menu-list">
            {DRAWER.map((d, i) => (
              <a href={href(d.slug)} key={i} className={d.wide ? "wide" : undefined}>
                {d.jp}
              </a>
            ))}
          </div>

          <div className="menu-pay">
            <div className="pay">
              <span className="ic">💳</span>CREDIT決済
            </div>
            <div className="pay">
              <span className="ic">Ｐ</span>PayPay決済
            </div>
          </div>

          <div className="menu-social">
            <div className="soc litlink">Lit.Link</div>
            <div className="soc insta">
              <span className="ig">⌾</span>Instagram
            </div>
            <div className="soc relaxi">
              <span className="rk">R</span>Relaxi
            </div>
            <div className="soc sns02">
              <span className="n">02</span>
              <small>メンズエステ専用SNS</small>
            </div>
          </div>

          <div className="menu-tel">
            <div className="mt-num">Tel:00-0000-0000</div>
            <div className="mt-hours">
              [営業時間]10:00〜翌5:00 [電話受付]9:30〜翌4:00
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
