"use client";

import { useState, useEffect } from "react";
import links from "../../data/links.json";
import chatCfg from "../../data/chat-config.json";

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
  { en: "Privacy", jp: "プライバシーポリシー", slug: "privacy" },
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
      {!hideFooterbar && (
        <a className="first-tab" href={`${base}first/`}>
          <span className="ft-sub">ご予約・お問い合わせ</span>
          <span className="ft-main">はじめての方</span>
        </a>
      )}
      <button
        className="scrolltop"
        aria-label="ページ上部へ"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        ⌃
      </button>
      <div className="footerbar" style={hideFooterbar ? { display: "none" } : undefined}>
        <a className="fb-btn" href="tel:0000000000" aria-label="電話する">
          <span className="fb-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#edd39b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </span>
          <span className="fb-txt">
            <b>電話</b>
          </span>
        </a>
        <a className="fb-btn" href={links.line} target="_blank" rel="noopener noreferrer">
          <span className="fb-ic" aria-hidden="true">
            <svg viewBox="0 0 48 40" width="30" height="25">
              <defs>
                <linearGradient id="lineGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#efd79a" />
                  <stop offset="1" stopColor="#d4b168" />
                </linearGradient>
              </defs>
              <path
                d="M8 3 H40 a5 5 0 0 1 5 5 V22 a5 5 0 0 1 -5 5 H19 l-7 7 V27 H8 a5 5 0 0 1 -5 -5 V8 a5 5 0 0 1 5 -5 Z"
                fill="url(#lineGold)"
                stroke="#c39a4c"
                strokeWidth="1"
              />
              <text
                x="24"
                y="19.5"
                textAnchor="middle"
                fontFamily="'Helvetica Neue', Arial, sans-serif"
                fontSize="13"
                fontWeight="800"
                letterSpacing="0.4"
                fill="#06c755"
              >
                LINE
              </text>
            </svg>
          </span>
          <span className="fb-txt">
            <b>LINE</b>
            <small>予約</small>
          </span>
        </a>
        <a className="fb-btn" href={`${base}reserve/`}>
          <span className="fb-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#edd39b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="17" rx="2" />
              <path d="M8 2.5v4 M16 2.5v4 M3 9.5h18" />
            </svg>
          </span>
          <span className="fb-txt">
            <b>WEB</b>
            <small>予約</small>
          </span>
        </a>
        {chatCfg.enabled && (
          <button
            type="button"
            className="fb-btn fb-chat"
            onClick={() => window.dispatchEvent(new Event("aichat:open"))}
            aria-label="AIチャットを開く"
          >
            <span className="fb-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#edd39b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
              </svg>
            </span>
            <span className="fb-txt">
              <b>AI</b>
              <small>チャット</small>
            </span>
          </button>
        )}
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
            <div className="pay pay-soon">
              <span className="ic">Ｐ</span>PayPay決済
              <span className="pay-badge">準備中</span>
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
