"use client";

import { useState, useEffect } from "react";

/* ---- data ---------------------------------------------------------- */

const NAV = [
  { jp: "トップ", en: "Top" },
  { jp: "出勤情報", en: "Schedule" },
  { jp: "セラピスト", en: "Therapist" },
  { jp: "料金システム", en: "System" },
  { jp: "アクセス", en: "Access" },
  { jp: "外国人の方へ", en: "For foreigners" },
  { jp: "スタッフ求人", en: "Careers" },
  { jp: "セラピスト求人", en: "Recruit" },
];

const CAMPAIGNS = [
  { t: "東京No.1\n美女軍団", bg: "linear-gradient(135deg,#7d1f38,#b83a5c)" },
  { t: "Aroma\nJewels", bg: "linear-gradient(135deg,#8a6f3a,#c2a35e)" },
  { t: "ご新規様\nご案内", bg: "linear-gradient(135deg,#4b3f3a,#6f5b48)" },
  { t: "2000円\nOFF", bg: "linear-gradient(135deg,#a2864f,#c9b17b)" },
  { t: "オール\nナイト割", bg: "linear-gradient(135deg,#8f4a52,#c06a72)" },
  { t: "新規割\n2000円OFF", bg: "linear-gradient(135deg,#5e161c,#a2323a)" },
  { t: "早割\n2000円OFF", bg: "linear-gradient(135deg,#6f5b48,#a2864f)" },
  { t: "Confident\n自信", bg: "linear-gradient(135deg,#7d2b34,#b5555f)" },
  { t: "32分\n無料", bg: "linear-gradient(135deg,#8a6f3a,#c2a35e)" },
];

// 只今の案内状況（エリア別 在籍・受付状況ボード）
const GUIDE_UPDATED = "22:26";
const GUIDE_DATE = "2026/9/14";
const GUIDE = [
  {
    area: "新宿",
    list: [
      { name: "七星", st: "満" },
      { name: "うさ", st: "満" },
      { name: "ひなの", st: "空" },
      { name: "りの", st: "満" },
      { name: "まりん", st: "空" },
      { name: "あんな", st: "満" },
    ],
  },
  {
    area: "秋葉原",
    list: [
      { name: "みるく", st: "満" },
      { name: "ここあ", st: "空" },
      { name: "ゆい", st: "満" },
      { name: "せな", st: "受付" },
    ],
  },
];

const THERAPISTS = [
  {
    name: "みお",
    age: "23",
    heart: "pink",
    heartLabel: "AJ",
    ribbon: "出勤",
    isNew: true,
    stats: ["T.158", "B.86(D)", "W.57", "H.85"],
    sched: "本日 13:00 〜 翌 2:00",
    schedSub: "ご予約受付中",
    status: "空きあり",
    sns: ["fgn", "blue", "zero2", "relaxi"],
    photoBg: "linear-gradient(160deg,#e7dac2 0%,#d4c09e 55%,#c8b58c 100%)",
  },
  {
    name: "ゆな",
    age: "20",
    heart: "diamond",
    heartLabel: "◆",
    ribbon: null,
    isNew: false,
    stats: ["T.162", "B.84(C)", "W.56", "H.84"],
    sched: "本日 15:00 〜 翌 5:00",
    schedSub: "残りわずか",
    status: "満員",
    sns: ["x", "zero2", "relaxi", "insta"],
    photoBg: "linear-gradient(160deg,#efe6d6 0%,#ddccb0 55%,#cebf9f 100%)",
  },
];

/* ---- small pieces -------------------------------------------------- */

function SnsBadge({ kind }) {
  const map = {
    fgn: (
      <div className="s fgn" key="fgn">
        <span>FGN</span>
        <span>WELCOME</span>
      </div>
    ),
    blue: (
      <div className="s blue" key="blue">
        ✦
      </div>
    ),
    x: (
      <div className="s x" key="x">
        𝕏
      </div>
    ),
    zero2: (
      <div className="s zero2" key="zero2">
        02
      </div>
    ),
    insta: (
      <div className="s insta" key="insta">
        ⌾
      </div>
    ),
    relaxi: (
      <div className="s relaxi" key="relaxi">
        R
      </div>
    ),
  };
  return map[kind] || null;
}

function TherapistCard({ t }) {
  return (
    <article className="tcard">
      <div className="tcard-photo" style={{ background: t.photoBg }}>
        <div className="silhouette" />
        <div className={`face-heart ${t.heart}`}>
          <span>{t.heartLabel}</span>
        </div>
        {t.ribbon && (
          <div className="ribbon">
            <span>{t.ribbon}</span>
          </div>
        )}
        {t.isNew && <div className="newbadge">新人</div>}
        <div className="sns">
          {t.sns.map((k) => (
            <SnsBadge kind={k} key={k} />
          ))}
        </div>
      </div>

      <div className="tcard-body">
        <div className="tcard-name">
          <span className="nm">{t.name}</span>
          <span className="ag">（{t.age}）</span>
        </div>
        <div className="tcard-stats">
          {t.stats.map((s, i) => {
            const [a, b] = s.split(".");
            return (
              <div className="st" key={i}>
                <b>{a}</b> {b}
              </div>
            );
          })}
        </div>
      </div>

      <div className="tcard-sched">
        <span className="clock">🕐</span>
        <span>
          {t.sched}
          <span className="st-sub">{t.schedSub}</span>
        </span>
      </div>
      <div className={`tcard-status ${t.status === "満員" ? "rest" : ""}`}>
        {t.status}
      </div>
    </article>
  );
}

/* ---- page ---------------------------------------------------------- */

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  return (
    <div className="stage">
      <div className="device">
        {/* ---------- HEADER ---------- */}
        <header className="hero-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-img" src="hero-banner.jpg" alt="men's esthetic DIAMOND Jewels ダイヤモンドジュエルズ KAMEIDO / 亀戸" />
          {/* transparent clickable area over the drawn hamburger icon */}
          <button
            className="hamburger hamburger-overlay"
            aria-label="メニューを開く"
            onClick={() => setMenuOpen(true)}
          />
        </header>

        {/* ---------- OPERATING HOURS BAR ---------- */}
        <div className="hoursbar">
          <span className="hb-label">営業時間</span>
          <span className="hb-val">10:00〜翌5:00</span>
          <span className="hb-sep">／</span>
          <span className="hb-label">電話受付</span>
          <span className="hb-val">9:30〜翌4:00</span>
        </div>

        {/* ---------- NAV GRID ---------- */}
        <nav className="navgrid">
          {NAV.map((n) => (
            <a className="nav-btn" href="#" key={n.en}>
              <span className="jp">{n.jp}</span>
              <span className="en">{n.en}</span>
            </a>
          ))}
        </nav>

        {/* ---------- HERO COLLAGE ---------- */}
        <section className="collage">
          <div className="collage-facets">
            <i style={{ inset: "0 55% 60% 0", clipPath: "polygon(0 0,100% 0,0 100%)" }} />
            <i style={{ inset: "50% 0 0 60%", clipPath: "polygon(100% 0,100% 100%,0 100%)" }} />
          </div>
          {/* decorative photo tiles — left & right columns, center lane kept clear */}
          <div className="tile" style={{ left: "3%", top: "6%", width: "26%", height: "42%", background: "linear-gradient(160deg,#d8c6a8,#b79b6f)" }} />
          <div className="tile" style={{ left: "3%", top: "52%", width: "26%", height: "42%", background: "linear-gradient(160deg,#e4d6bd,#c2ab84)" }} />
          <div className="tile" style={{ left: "31%", top: "3%", width: "17%", height: "30%", background: "linear-gradient(160deg,#cbb894,#a98d63)" }} />
          <div className="tile" style={{ left: "31%", top: "67%", width: "17%", height: "30%", background: "linear-gradient(160deg,#d8c6a8,#b79b6f)" }} />
          <div className="tile" style={{ right: "3%", top: "6%", width: "24%", height: "42%", background: "linear-gradient(160deg,#e4d6bd,#c2ab84)" }} />
          <div className="tile" style={{ right: "3%", top: "52%", width: "24%", height: "42%", background: "linear-gradient(160deg,#cbb894,#a98d63)" }} />
          <div className="tile" style={{ right: "29%", top: "62%", width: "16%", height: "32%", background: "linear-gradient(160deg,#cbb894,#a98d63)" }} />

          <div className="heart-emo" style={{ left: "6%", top: "22%", background: "#ef8ea1" }}>
            <span style={{ transform: "rotate(45deg)" }}>AJ</span>
          </div>
          <div className="heart-emo" style={{ right: "8%", top: "20%", background: "#7d2b2f" }}>
            <span style={{ transform: "rotate(45deg)" }}>◆</span>
          </div>
          <div className="diamond-emo" style={{ right: "24%", top: "10%" }}>◆</div>
          <div className="diamond-emo" style={{ left: "22%", bottom: "12%" }}>♦</div>

          {/* legibility lane for vertical copy */}
          <div className="collage-lane" />
          <div className="collage-copy">宝石のように美しいセラピスト達</div>
          <div className="collage-logo">
            <div className="cl-en">Aroma Jewels</div>
            <div className="cl-jp">アロマジュエルズ</div>
            <div className="cl-tag">極上の癒しと刺激の空間</div>
          </div>
        </section>

        {/* ---------- CAMPAIGN STRIP ---------- */}
        <div className="campaign">
          {CAMPAIGNS.map((c, i) => (
            <div className="camp" key={i} style={{ background: c.bg }}>
              {c.t.split("\n").map((line, j) => (
                <div key={j}>{line}</div>
              ))}
            </div>
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
            只今の案内状況
            <small>（更新 {GUIDE_UPDATED}）</small>
          </h2>
          {GUIDE.map((g, i) => (
            <div className="guide-block" key={i}>
              <div className="guide-area">{g.area}</div>
              <ul className="guide-list">
                {g.list.map((t, j) => (
                  <li key={j}>
                    <span className={`gst ${t.st === "満" ? "full" : t.st === "空" ? "open" : "wait"}`}>
                      {t.st}
                    </span>
                    <span className="gname">{t.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* ---------- SECTION BAND ---------- */}
        <div className="band">
          <span className="dia">◆</span>
          <span className="band-en">Today&apos;s Therapist</span>
          <span className="dia">◆</span>
        </div>

        {/* ---------- THERAPIST GRID ---------- */}
        <section className="therapists">
          {THERAPISTS.map((t, i) => (
            <TherapistCard t={t} key={i} />
          ))}
        </section>

        <a className="more" href="#">
          ＞ 出勤セラピストを全て見る ＜
        </a>

        {/* ---------- LEFT STICKERS ---------- */}
        <div className="stickers">
          <div className="stk">満</div>
          <div className="stk">満</div>
          <div className="stk jewel">💠</div>
          <div className="stk">満</div>
        </div>

        {/* ---------- FIXED FOOTER ---------- */}
        <div className="aichat">
          <span className="bot">🤖</span>
          <small>AiChat</small>
        </div>
        <button
          className="scrolltop"
          aria-label="ページ上部へ"
          onClick={() =>
            window.scrollTo({ top: 0, behavior: "smooth" })
          }
        >
          ⌃
        </button>
        <div className="footerbar">
          <a className="fb-tel" href="tel:05054449830">
            Tel:050-5444-9830
          </a>
          <a className="fb-btn fb-line" href="#">
            <span>LINE</span>
            <small>予約</small>
          </a>
          <a className="fb-btn fb-web" href="#">
            <span>WEB</span>
            <small>予約</small>
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
                <span className="gold">A</span>roma <span className="gold">J</span>ewels
              </div>
              <div className="ml-jp">アロマジュエルズ</div>
            </div>

            <div className="menu-list">
              <a href="#">トップ</a>
              <a href="#">アクセス</a>
              <a href="#">出勤情報</a>
              <a href="#">外国人の方へ</a>
              <a href="#">セラピスト</a>
              <a href="#">スタッフ求人</a>
              <a href="#">料金システム</a>
              <a href="#">セラピスト求人</a>
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
              <div className="mt-num">Tel:050-5444-9830</div>
              <div className="mt-hours">
                [営業時間]10:00〜翌5:00 [電話受付]9:30〜翌4:00
              </div>
            </div>

            <div className="menu-aichat">
              <span className="bot">🤖</span>
              <small>AiChat</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
