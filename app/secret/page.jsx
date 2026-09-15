"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/* ---- data (プレースホルダー：後で自由に編集できます) ------------------ */

const COURSES = [
  { name: "15分コース", price: "14,000" },
  { name: "30分コース", price: "26,000" },
  { name: "60分コース", price: "48,000" },
];

const NOMINATIONS = [
  { name: "入会金", price: "0" },
  { name: "写真指名", price: "1,000" },
  { name: "本指名", price: "2,000" },
  { name: "姫予約", price: "3,000" },
];

const OPTIONS = [
  { name: "ホットオイル増量", price: "無料" },
  { name: "アロマ生オイル", price: "1,000" },
  { name: "パウダーマッサージ", price: "1,500" },
  { name: "スペシャルトリートメント", price: "3,000" },
  { name: "コスチュームチェンジ", price: "2,000" },
  { name: "延長15分", price: "8,000" },
];

const PASSWORD = "0426";

/* ---- page ---------------------------------------------------------- */

export default function Secret() {
  const [authed, setAuthed] = useState(false);
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("aroma_secret") === "1") setAuthed(true);
    } catch {
      /* private mode etc. — ignore */
    }
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (val === PASSWORD) {
      setAuthed(true);
      setErr(false);
      try {
        sessionStorage.setItem("aroma_secret", "1");
      } catch {
        /* ignore */
      }
    } else {
      setErr(true);
      setVal("");
    }
  };

  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background:
            "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        {!authed ? (
          /* ---------- PASSWORD SCREEN ---------- */
          <section className="lockwrap">
            <div className="lockcard">
              <div className="lock-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#edd39b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2" />
                  <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
                  <circle cx="12" cy="15.4" r="1.4" fill="#edd39b" stroke="none" />
                  <path d="M12 16.6v2" />
                </svg>
              </div>
              <div className="lock-en">Secret Room</div>
              <div className="lock-jp">秘密の空間</div>
              <p className="lock-lead">
                こちらは会員様限定の裏メニューページです。
                <br />
                パスワードを入力してください。
              </p>
              <form className="lock-form" onSubmit={submit}>
                <input
                  className={`lock-input ${err ? "bad" : ""}`}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="パスワード"
                  value={val}
                  onChange={(e) => {
                    setVal(e.target.value);
                    setErr(false);
                  }}
                  aria-label="パスワード"
                />
                <button className="lock-btn" type="submit">
                  解錠する
                </button>
              </form>
              {err && (
                <p className="lock-err">パスワードが違います。もう一度お試しください。</p>
              )}
              <Link className="lock-back" href="/">
                ＜ トップへ戻る
              </Link>
            </div>
          </section>
        ) : (
          /* ---------- SECRET MENU ---------- */
          <>
            <div className="section-head sec-head">
              <div className="sh-en">Secret Menu</div>
              <div className="sh-jp">裏メニュー</div>
            </div>

            <section className="frame pricecard">
              <div className="corner tl" />
              <div className="corner tr" />
              <div className="corner bl" />
              <div className="corner br" />

              <div className="price-title">
                <span className="pt-en">Course</span>
                <span className="pt-jp">コース料金</span>
              </div>
              <ul className="price-list">
                {COURSES.map((c, i) => (
                  <li key={i}>
                    <span className="pl-name">{c.name}</span>
                    <span className="pl-dot" />
                    <span className="pl-price">
                      {c.price}
                      <small>円</small>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="price-note">
                ※入室後のコース変更はお断りしております。
                <br />
                ※延長をご希望の場合はセラピストにお申し付けください。
              </p>

              <ul className="price-list tight">
                {NOMINATIONS.map((c, i) => (
                  <li key={i}>
                    <span className="pl-name">{c.name}</span>
                    <span className="pl-dot" />
                    <span className="pl-price">
                      {c.price}
                      <small>円</small>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="price-title mt">
                <span className="pt-en">Option</span>
                <span className="pt-jp">オプション</span>
              </div>
              <ul className="price-list">
                {OPTIONS.map((c, i) => (
                  <li key={i}>
                    <span className="pl-name">{c.name}</span>
                    <span className="pl-dot" />
                    <span className="pl-price">
                      {c.price === "無料" ? (
                        "無料"
                      ) : (
                        <>
                          {c.price}
                          <small>円</small>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="price-note">
                ※クレジット決済10%・PayPay決済5%のTAXをいただきます。
                <br />
                ※料金・項目は一例です（後ほど編集いただけます）。
              </p>
            </section>

            <div className="sec-actions">
              <a className="sec-tel" href="tel:05054449830">
                この内容で予約する（050-5444-9830）
              </a>
              <Link className="sec-back" href="/">
                ＜ トップページへ戻る
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
