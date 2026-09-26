"use client";

import { useState } from "react";
import SiteChrome from "./_components/SiteChrome";
import StaffCard from "./_components/StaffCard";
import NavGrid from "./_components/NavGrid";
import guideData from "../data/guide.json";
import rosterData from "../data/roster.json";
import links from "../data/links.json";

/* ---- data ---------------------------------------------------------- */

// Hero slides — the small thumbnails below switch the big image.
// `img` uses a real banner; slides without `img` render a styled placeholder.
const SLIDES = [
  {
    t: "10月限定\nLINE友だち追加特典",
    img: "promo-line-3000off.jpg",
    alt: "10月中のLINE友だち追加で3,000円OFF｜AROMA DAIAMOND 亀戸（友だち追加期限 2026年10月31日）",
    fit: "contain",
  },
  {
    t: "新規・新人\n特別割引",
    img: "promo-2000off.jpg",
    alt: "新規・新人特別割引 2000円OFF｜Aroma DIAMOND アロマダイヤモンド",
  },
  { t: "東京No.1\n美女軍団", bg: "linear-gradient(135deg,#7d1f38,#b83a5c)" },
  { t: "AROMA\nDAIAMOND", bg: "linear-gradient(135deg,#8a6f3a,#c2a35e)" },
  { t: "ご新規様\nご案内", bg: "linear-gradient(135deg,#4b3f3a,#6f5b48)" },
  { t: "オール\nナイト割", bg: "linear-gradient(135deg,#8f4a52,#c06a72)" },
  { t: "早割\n2000円OFF", bg: "linear-gradient(135deg,#6f5b48,#a2864f)" },
  { t: "Confident\n自信", bg: "linear-gradient(135deg,#7d2b34,#b5555f)" },
  { t: "32分\n無料", bg: "linear-gradient(135deg,#8a6f3a,#c2a35e)" },
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

  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background:
            "#f4efe7 url(bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        {/* ---------- HEADER ---------- */}
        <header className="hero-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-img" src="hero-banner.jpg" alt="men's esthetic AROMA DAIAMOND アロマ ダイアモンド KAMEIDO / 亀戸" />
        </header>

        {/* ---------- NAV GRID ---------- */}
        <NavGrid base="" />

        {/* ---------- HERO MAIN (switchable) ---------- */}
        <section className="hero-main">
          {SLIDES.map((s, i) =>
            s.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                className={`hm-slide ${s.fit === "contain" ? "hm-contain" : ""} ${i === activeSlide ? "on" : ""}`}
                src={s.img}
                alt={s.alt || s.t.replace("\n", " ")}
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
              onClick={() => setActiveSlide(i)}
              aria-label={s.t.replace("\n", " ")}
              aria-pressed={i === activeSlide}
              style={
                s.img
                  ? {
                      backgroundImage: `url(${s.img})`,
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
          <div className="sh-jp">本日の出勤</div>
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

            <a className="more" href="#">
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
          <div className="sh-jp">コンセプト</div>
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
          <div className="sh-jp">セラピスト</div>
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
          <div className="sh-jp">癒やしの環境</div>
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
          <div className="sh-jp">ご予約</div>
        </div>
        <section className="reserve">
          <p className="concept-p reserve-lead">
            ご希望の日時・コース・セラピストをお申し付けください。
            ご予約は、お電話・WEB予約・公式LINEにて承っております。
            ご予約の可否、ご予約可能な場合はご案内サロンとご利用料金をお伝えいたします。
          </p>
          <a className="rz-tel" href="tel:08048855430">
            <span className="rz-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="#edd39b">
                <path d="M6.6 10.9c1.4 2.8 3.7 5.1 6.5 6.5l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .5 1 1v3.5c0 .6-.4 1-1 1C10.4 21.6 2.4 13.6 2.4 3.6c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.3 0 .7-.2 1l-2.7 2.7z" />
              </svg>
            </span>
            <span className="rz-tel-txt">
              <b>お電話予約</b>
              <span className="num">080-4885-5430</span>
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
