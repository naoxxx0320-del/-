"use client";

import { useState, useEffect, useRef } from "react";
import SiteChrome from "./_components/SiteChrome";
import StaffCard from "./_components/StaffCard";
import NavGrid from "./_components/NavGrid";
import { photoSrc } from "./_components/photo";
import { SITE } from "./_lib/site";
import guideData from "../data/guide.json";
import rosterData from "../data/roster.json";
import links from "../data/links.json";

/* ---- data ---------------------------------------------------------- */

// Hero slides — the small thumbnails below switch the big image.
// すべて実バナー（3:2に正規化済み。余白は各バナーの背景色に馴染ませて切れなし）。
const SLIDES = [
  {
    t: "11月中旬\nOPEN",
    img: "slide-open.jpg",
    alt: "2026年11月中旬 亀戸にグランドオープン｜AROMA DAIAMOND アロマ ダイアモンド",
  },
  {
    t: "新規・新人\n特別割引",
    img: "slide-shinki.jpg",
    alt: "新規・新人特別割引 2000円OFF｜Aroma DIAMOND アロマ ダイアモンド 亀戸",
  },
  {
    t: "オープン\n記念特典",
    img: "slide-kinen.jpg",
    alt: "11月限定 オープン記念特典 初回限定2,000円OFF｜Aroma DIAMOND アロマ ダイアモンド 亀戸",
  },
  {
    t: "セラピスト\n大募集",
    img: "slide-recruit.jpg",
    alt: "セラピスト大募集 高収入・完全個室待機・安心のサポート体制｜Aroma DIAMOND アロマ ダイアモンド 亀戸",
  },
  {
    t: "会員様\n限定特典",
    img: "slide-member.jpg",
    alt: "会員様限定特典 VIP会員様だけの特別なサービス｜Aroma DIAMOND アロマ ダイアモンド 亀戸",
  },
  {
    t: "アクセス\n公開予定",
    img: "slide-access.jpg",
    alt: "11月上旬アクセス公開予定 駅近・好立地のプライベート空間｜Aroma DIAMOND アロマ ダイアモンド 亀戸",
  },
];

// 只今の案内状況・本日の出勤（data/*.json 由来。GitHub Actions が
// Googleスプレッドシートから自動更新します）
const GUIDE_UPDATED = guideData.updated;
const GUIDE_DATE = guideData.date;
const GUIDE = guideData.areas;
// 本日の出勤：欠勤(✖️)は除外して表示
const THERAPISTS = rosterData.filter((t) => !t.absent);

// ステータス表示の色分けクラス
const STATUS_CLASS = {
  空きあり: "ok",
  残りわずか: "few",
  満員: "full",
  受付終了: "closed",
};

/* ---- page ---------------------------------------------------------- */

export default function Home() {
  const [activeSlide, setActiveSlide] = useState(0);
  const slideTimer = useRef(null);

  // オートプレイ（約5秒ごと）。動きを控える設定の端末では自動再生しない。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || SLIDES.length <= 1) return;
    slideTimer.current = setInterval(() => {
      setActiveSlide((i) => (i + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(slideTimer.current);
  }, []);

  // サムネイル操作時は自動送りのタイマーを一度リセット（直後に切り替わらないように）
  const selectSlide = (i) => {
    setActiveSlide(i);
    if (slideTimer.current) {
      clearInterval(slideTimer.current);
      const reduce =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce && SLIDES.length > 1) {
        slideTimer.current = setInterval(() => {
          setActiveSlide((n) => (n + 1) % SLIDES.length);
        }, 5000);
      }
    }
  };

  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background:
            "#f4efe7 url(bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        {/* SEO/アクセシビリティ用の見出し（視覚的には非表示） */}
        <h1 className="sr-only">
          AROMA DAIAMOND（アロマ ダイアモンド）｜亀戸のメンズエステ
        </h1>

        {/* ---------- HEADER ---------- */}
        <header className="hero-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-img" src={photoSrc("hero-banner.jpg")} alt="men's esthetic AROMA DAIAMOND アロマ ダイアモンド KAMEIDO / 亀戸" />
        </header>

        {/* ---------- 営業時間・電話受付バー ---------- */}
        <div className="hours-bar">
          <span className="hb-item">
            <svg
              className="hb-ico"
              viewBox="0 0 24 24"
              width="15"
              height="15"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 7v5.2l3.4 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hb-label">営業時間</span>
            <span className="hb-time">{SITE.hoursBusiness}</span>
          </span>
          <span className="hb-sep" aria-hidden="true" />
          <span className="hb-item">
            <svg
              className="hb-ico"
              viewBox="0 0 24 24"
              width="15"
              height="15"
              aria-hidden="true"
            >
              <path
                d="M6.5 3.5c.6 0 1.1.4 1.3 1l.8 2.7c.2.6 0 1.2-.5 1.6l-1.2.9c1 2.1 2.7 3.8 4.8 4.8l.9-1.2c.4-.5 1-.7 1.6-.5l2.7.8c.6.2 1 .7 1 1.3v2.6c0 .8-.7 1.5-1.5 1.4C11.1 20.6 3.4 12.9 3.1 5.4 3 4.6 3.7 4 4.5 4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hb-label">電話受付</span>
            <span className="hb-time">{SITE.hoursPhone}</span>
          </span>
        </div>

        {/* ---------- NAV GRID ---------- */}
        <NavGrid base="" />

        {/* ---------- HERO MAIN (switchable) ---------- */}
        <section className="hero-main">
          {SLIDES.map((s, i) =>
            s.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                className={`hm-slide ${i === activeSlide ? "on" : ""}`}
                src={photoSrc(s.img)}
                alt={s.alt || s.t.replace("\n", " ")}
                loading={i === 0 ? "eager" : "lazy"}
              />
            ) : (
              <div
                key={i}
                className={`hm-slide hm-ph ${i === activeSlide ? "on" : ""}`}
                style={{ background: s.bg }}
              >
                <div className="hm-ph-txt">
                  {s.t.split("\n").map((line, j) => (
                    <div key={j}>{line}</div>
                  ))}
                </div>
              </div>
            )
          )}
        </section>

        {/* ---------- THUMBNAILS (click to switch main image) ---------- */}
        <div className="campaign">
          {SLIDES.map((s, i) => (
            <button
              type="button"
              key={i}
              className={`camp ${i === activeSlide ? "active" : ""}`}
              onClick={() => selectSlide(i)}
              aria-label={s.t.replace("\n", " ")}
              aria-pressed={i === activeSlide}
              style={
                s.img
                  ? {
                      backgroundImage: `url(${photoSrc(s.img)})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : { background: s.bg }
              }
            >
              {!s.img &&
                s.t.split("\n").map((line, j) => <div key={j}>{line}</div>)}
            </button>
          ))}
        </div>

        {/* ---------- INFORMATION / 案内状況 ---------- */}
        <div className="info-head">
          <span className="ih-en">Information</span>
          <span className="ih-jp">最新ご案内情報</span>
        </div>
        <section className="frame">
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />
          <div className="guide-date">{GUIDE_DATE}</div>
          <h2 className="guide-title">
            只今の案内状況<small>（更新{GUIDE_UPDATED}）</small>
          </h2>
          <div className="guide-scroll">
            {GUIDE.map((g, i) => (
              <div className="guide-block" key={i}>
                <div className="guide-area">{g.area}</div>
                <ul className="guide-list">
                  {g.list.map((t, j) => (
                    <li key={j}>
                      <span className="gheart" aria-hidden="true">💖</span>
                      <span className="gname">{t.name}</span>
                      {t.time && <span className="gtime">{t.time}〜</span>}
                      {t.status && (
                        <span
                          className={`gstatus ${STATUS_CLASS[t.status] || ""}`}
                        >
                          {t.status}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- SECTION HEAD + AREA BAND ---------- */}
        <div className="section-head">
          <div className="sh-en">Today&apos;s Therapist</div>
          <h2 className="sh-jp">本日の出勤</h2>
        </div>
        <div className="area-band">
          <svg className="ab-dia" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M4.5 9 L12 2.5 L19.5 9 L12 21.5 Z" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M4.5 9 H19.5 M9 9 L12 21.5 M15 9 L12 21.5 M9 9 L12 2.5 M15 9 L12 2.5" fill="none" stroke="#fff" strokeWidth="0.9" />
          </svg>
          <span className="ab-name">亀戸</span>
        </div>

        {/* ---------- THERAPIST GRID ---------- */}
        {THERAPISTS.length > 0 ? (
          <>
            <section className="staff-grid">
              {THERAPISTS.map((t, i) => (
                <StaffCard t={t} href={`therapist/${t.id ?? i + 1}/`} base="" key={i} />
              ))}
            </section>

            <a className="more" href="therapist/">
              ＞ 出勤セラピストを全て見る ＜
            </a>
          </>
        ) : (
          <p className="therapists-empty">
            本日の出勤情報は準備中です。しばらくお待ちください。
          </p>
        )}

        {/* ---------- CONCEPT ---------- */}
        <div className="section-head">
          <div className="sh-en">Concept</div>
          <h2 className="sh-jp">コンセプト</h2>
        </div>
        <section className="concept">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="concept-img" src="concept.jpg" alt="コンセプト" />
          <h3 className="concept-h">
            極上の癒やしと
            <br />
            刺激の空間
          </h3>
          <p className="concept-p">
            当店は亀戸エリアに展開する、日々のストレスや疲れを感じている大人のために創られた、高級メンズエステサロンです。
            「とにかく綺麗な日本人セラピストに癒やされたい」「たまには女性に甘えてみたい」——
            そんな願いに寄り添い、上質な空間と確かな技術で、日常を忘れる極上のひとときをお届けいたします。
          </p>
        </section>

        {/* ---------- THERAPIST ---------- */}
        <div className="section-head">
          <div className="sh-en">Therapist</div>
          <h2 className="sh-jp">セラピスト</h2>
        </div>
        <section className="concept">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="concept-img" src="therapist-intro.jpg" alt="セラピスト" />
          <h3 className="concept-h">容姿端麗で確かな技術</h3>
          <p className="concept-p">
            当店には、モデルやアイドルを思わせる華やかな女性から、清楚で可憐な学生、
            知的で色香ただようお姉様系まで、幅広いタイプのセラピストが在籍しています。
            きっと、あなた好みのひとりが見つかるはずです。
            デビュー前には技術・接客の研修を丁寧に重ね、確かな技術と心づかいで、
            お客様を極上のひとときへとお連れいたします。
          </p>
        </section>

        {/* ---------- ENVIRONMENT ---------- */}
        <div className="section-head">
          <div className="sh-en">Environment</div>
          <h2 className="sh-jp">癒やしの環境</h2>
        </div>
        <section className="concept">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="concept-img" src="environment.jpg" alt="癒やしの環境" />
          <h3 className="concept-h">
            完全個室の
            <br />
            ラグジュアリー空間
          </h3>
          <p className="concept-p">
            リゾートホテルを思わせる上質な内装と、洗練されたおもてなし。
            すべて完全個室のプライベートな空間で、周りを気にせず心からくつろいでいただけます。
            夜景を眺めながら、日常の喧騒を忘れるひととき——
            自分だけの隠れ家として、心と身体を解きほぐす特別な時間をお過ごしください。
          </p>
        </section>

        {/* ---------- RESERVATION ---------- */}
        <div className="section-head">
          <div className="sh-en">Reservation</div>
          <h2 className="sh-jp">ご予約</h2>
        </div>
        <section className="reserve">
          <p className="concept-p reserve-lead">
            ご希望の日時・コース・セラピストをお申し付けください。
            ご予約は、お電話・WEB予約・公式LINEにて承っております。
            ご予約の可否、ご予約可能な場合はご案内サロンとご利用料金をお伝えいたします。
          </p>
          <a className="rz-tel" href="tel:0000000000">
            <span className="rz-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="#edd39b">
                <path d="M6.6 10.9c1.4 2.8 3.7 5.1 6.5 6.5l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .5 1 1v3.5c0 .6-.4 1-1 1C10.4 21.6 2.4 13.6 2.4 3.6c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.3 0 .7-.2 1l-2.7 2.7z" />
              </svg>
            </span>
            <span className="rz-tel-txt">
              <b>お電話予約</b>
              <span className="num">00-0000-0000</span>
            </span>
          </a>
          <div className="rz-row">
            <a className="rz-btn" href="reserve/">
              <span className="rz-ic" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="#edd39b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                  <rect x="3.5" y="6" width="25" height="16" rx="2" />
                  <path d="M12 26 H20 M16 22 V26" />
                </svg>
              </span>
              <span>WEB予約</span>
            </a>
            <a className="rz-btn" href={links.line} target="_blank" rel="noopener noreferrer">
              <span className="rz-ic" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="28" height="28">
                  <rect x="2" y="3" width="28" height="26" rx="8" fill="#06c755" />
                  <path d="M16 8.4c-4.7 0-8.5 3-8.5 6.6 0 3.2 3 5.9 7 6.5.27.06.64.18.73.42.08.2.05.52.03.73l-.11.68c-.03.2-.16.8.72.44.88-.36 4.76-2.8 6.5-4.8C22.6 24.6 24.5 22 24.5 15c0-3.6-3.8-6.6-8.5-6.6z" fill="#fff" />
                </svg>
              </span>
              <span>LINE予約</span>
            </a>
          </div>
        </section>

        {/* ---------- SHARED CHROME (footer + drawer + hamburger) ---------- */}
        <SiteChrome base="" />
      </div>
    </div>
  );
}
