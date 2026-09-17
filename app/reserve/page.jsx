"use client";

import { useMemo, useState } from "react";
import { photoSrc } from "../_components/photo";
import schedule from "../../data/schedule.json";
import roster from "../../data/roster.json";
import cfg from "../../data/reserve-config.json";

const BASE = "../"; // /reserve/ はルートから1階層下
const PROFILE = Object.fromEntries(roster.map((p) => [p.name, p]));
const yen = (n) => "¥" + Number(n).toLocaleString("ja-JP");

/* 出勤時間文字列（例 "13:00〜翌2:00"）→ 分レンジ */
function parseShift(str) {
  const m = (str || "").match(/(\d{1,2}):(\d{2})\s*[〜~\-]\s*(翌)?\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let start = +m[1] * 60 + +m[2];
  let end = +m[4] * 60 + +m[5] + (m[3] ? 1440 : 0);
  if (end <= start) end += 1440;
  return { start, end };
}
const fmtMin = (mins) => {
  const d = mins >= 1440;
  const h = Math.floor((mins % 1440) / 60);
  const mm = String(mins % 60).padStart(2, "0");
  return `${d ? "翌" : ""}${h}:${mm}`;
};
function genSlots(shift) {
  const s = shift || { start: 10 * 60, end: 29 * 60 }; // 既定 10:00〜翌5:00
  const out = [];
  for (let t = s.start; t <= s.end - 60; t += 5) out.push(fmtMin(t));
  return out;
}

export default function Reserve() {
  const days = schedule.days || [];
  const [dayIdx, setDayIdx] = useState(0);
  const [therapist, setTherapist] = useState("");
  const [time, setTime] = useState("");
  const [courseI, setCourseI] = useState(-1);
  const [form, setForm] = useState({
    name: "",
    kana: "",
    email: "",
    tel: "",
    note: "",
    pay: cfg.pays[0] || "現金",
    source: "",
    sourceOther: "",
  });
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState({ sending: false, done: false, error: "" });

  const day = days[dayIdx] || { list: [], label: "" };

  // 選択中セラピストの出勤時間 → 予約可能スロット
  const shiftStr = useMemo(() => {
    const e = day.list.find((x) => x.name === therapist);
    return e ? e.time : "";
  }, [day, therapist]);
  const slots = useMemo(() => genSlots(parseShift(shiftStr)), [shiftStr]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pickTherapist = (name) => {
    setTherapist(name);
    setTime("");
  };
  const course = courseI >= 0 ? cfg.courses[courseI] : null;

  const validate = () => {
    if (!therapist) return "セラピストを選んでください。";
    if (!time) return "予約時間を選んでください。";
    if (courseI < 0) return "コースを選んでください。";
    if (course?.honshimei && therapist === "おまかせ（指名なし）")
      return "150分以上のコースは本指名（セラピストご指名）でのみご予約いただけます。";
    if (!form.name.trim()) return "お名前を入力してください。";
    if (!form.email.trim()) return "メールアドレスを入力してください。";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return "メールアドレスの形式をご確認ください。";
    if (!form.tel.trim()) return "電話番号を入力してください。";
    return "";
  };

  const goConfirm = () => {
    const err = validate();
    if (err) {
      setState((s) => ({ ...s, error: err }));
      return;
    }
    setState((s) => ({ ...s, error: "" }));
    setConfirming(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const source = form.source === "該当なし・その他" ? form.sourceOther : form.source;

  const submit = async () => {
    if (!cfg.endpoint) {
      setState({
        sending: false,
        done: false,
        error:
          "予約送信の設定が完了していません。恐れ入りますが、お電話（050-5444-9830）でご連絡ください。",
      });
      return;
    }
    setState({ sending: true, done: false, error: "" });
    const body = new URLSearchParams({
      date: day.label || "",
      time,
      course: course.label,
      price: yen(course.price),
      therapist,
      name: form.name,
      kana: form.kana,
      email: form.email,
      tel: form.tel,
      pay: form.pay,
      source: source || "",
      note: form.note,
    });
    try {
      await fetch(cfg.endpoint, { method: "POST", mode: "no-cors", body });
      setState({ sending: false, done: true, error: "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setState({
        sending: false,
        done: false,
        error:
          "送信に失敗しました。通信環境をご確認のうえ、再度お試しください。",
      });
    }
  };

  /* ---------- 完了画面 ---------- */
  if (state.done) {
    return (
      <div className="rsv-stage">
        <div className="rsv">
          <div className="rsv-head">
            <div className="rsv-logo">WEB予約</div>
            <div className="rsv-sub">AROMA DAIAMOND｜亀戸</div>
          </div>
          <div className="rsv-done">
            <div className="rsv-done-ic">✓</div>
            <h2>ご予約を受け付けました</h2>
            <p>
              ご予約ありがとうございます。内容を確認のうえ、担当より折り返しご連絡いたします。
              確認のご連絡までしばらくお待ちください。
            </p>
            <div className="rsv-done-box">
              <div>
                <b>希望日時</b>
                {day.label} {time}
              </div>
              <div>
                <b>コース</b>
                {course.label}（{yen(course.price)}）
              </div>
              <div>
                <b>セラピスト</b>
                {therapist}
              </div>
            </div>
            <a className="rsv-back" href="../">
              サイトトップへ戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 確認画面 ---------- */
  if (confirming) {
    const rows = [
      ["希望日", day.label],
      ["予約時間", time],
      ["コース", `${course.label}（${yen(course.price)}）`],
      ["セラピスト", therapist],
      ["お名前", `${form.name}${form.kana ? `（${form.kana}）` : ""}`],
      ["メール", form.email],
      ["電話番号", form.tel],
      ["お支払い", form.pay],
      ["来店きっかけ", source || "－"],
      ["その他ご希望", form.note || "－"],
    ];
    return (
      <div className="rsv-stage">
        <div className="rsv">
          <div className="rsv-head">
            <div className="rsv-logo">WEB予約</div>
            <div className="rsv-sub">ご予約内容の確認</div>
          </div>
          <p className="rsv-lead">
            以下の内容でよろしければ「この内容で予約する」を押してください。
          </p>
          <table className="rsv-confirm">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.error && <p className="rsv-err">{state.error}</p>}
          <button className="rsv-submit" onClick={submit} disabled={state.sending}>
            {state.sending ? "送信中…" : "この内容で予約する"}
          </button>
          <button
            className="rsv-edit"
            onClick={() => {
              setConfirming(false);
              setState((s) => ({ ...s, error: "" }));
            }}
          >
            ← 内容を修正する
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 入力フォーム ---------- */
  return (
    <div className="rsv-stage">
      <div className="rsv">
        <div className="rsv-head">
          <div className="rsv-logo">WEB予約</div>
          <div className="rsv-sub">AROMA DAIAMOND｜亀戸</div>
        </div>

        {/* 1 セラピスト */}
        <section className="rsv-sec">
          <h2 className="rsv-h">
            <span className="rsv-n">1</span>セラピストを選んでください
          </h2>

          <div className="rsv-daybar">
            <button
              className="rsv-day-nav"
              disabled={dayIdx <= 0}
              onClick={() => {
                setDayIdx((i) => Math.max(0, i - 1));
                setTherapist("");
                setTime("");
              }}
            >
              ‹ 前の日
            </button>
            <select
              className="rsv-day-sel"
              value={dayIdx}
              onChange={(e) => {
                setDayIdx(+e.target.value);
                setTherapist("");
                setTime("");
              }}
            >
              {days.map((d, i) => (
                <option value={i} key={i}>
                  {d.label}
                </option>
              ))}
              {days.length === 0 && <option value={0}>日付未定</option>}
            </select>
            <button
              className="rsv-day-nav"
              disabled={dayIdx >= days.length - 1}
              onClick={() => {
                setDayIdx((i) => Math.min(days.length - 1, i + 1));
                setTherapist("");
                setTime("");
              }}
            >
              次の日 ›
            </button>
          </div>

          <div className="rsv-thera">
            {day.list.map((e, i) => {
              const p = PROFILE[e.name] || {};
              const on = therapist === e.name;
              return (
                <button
                  className={`rsv-tcard ${on ? "on" : ""}`}
                  key={i}
                  onClick={() => pickTherapist(e.name)}
                  type="button"
                >
                  <span className="rsv-tphoto" style={{ background: p.photoBg }}>
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoSrc(p.photo, BASE)} alt={e.name} />
                    ) : (
                      <span className="rsv-theart">◆</span>
                    )}
                  </span>
                  <span className="rsv-tname">{e.name}</span>
                  {p.age && <span className="rsv-tage">{p.age}歳</span>}
                  <span className="rsv-ttime">{e.time}</span>
                  {on && <span className="rsv-tcheck">✓</span>}
                </button>
              );
            })}
            {day.list.length === 0 && (
              <p className="rsv-empty">この日の出勤セラピストは未定です。</p>
            )}
          </div>
          <button
            type="button"
            className={`rsv-omakase ${therapist === "おまかせ（指名なし）" ? "on" : ""}`}
            onClick={() => pickTherapist("おまかせ（指名なし）")}
          >
            セラピストはおまかせ（指名なし）
          </button>
        </section>

        {/* 2 時間 */}
        <section className="rsv-sec">
          <h2 className="rsv-h">
            <span className="rsv-n">2</span>予約時間を選んでください
          </h2>
          {therapist ? (
            <div className="rsv-times">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`rsv-time ${time === s ? "on" : ""}`}
                  onClick={() => setTime(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <p className="rsv-hint">先にセラピストを選んでください。</p>
          )}
        </section>

        {/* 3 コース */}
        <section className="rsv-sec">
          <h2 className="rsv-h">
            <span className="rsv-n">3</span>コースを選んでください
          </h2>
          <p className="rsv-note">{cfg.courseNote}</p>
          <div className="rsv-courses">
            {cfg.courses.map((c, i) => (
              <label className={`rsv-course ${courseI === i ? "on" : ""}`} key={i}>
                <input
                  type="radio"
                  name="course"
                  checked={courseI === i}
                  onChange={() => setCourseI(i)}
                />
                <span className="rsv-cname">
                  {c.label}
                  {c.honshimei && <span className="rsv-honshimei">本指名</span>}
                </span>
                <span className="rsv-cprice">{yen(c.price)}</span>
              </label>
            ))}
          </div>
        </section>

        {/* 4 お客様情報 */}
        <section className="rsv-sec">
          <h2 className="rsv-h">
            <span className="rsv-n">4</span>お客様情報をご入力ください
          </h2>
          <label className="rsv-field">
            <span className="rsv-label">
              お名前<i>必須</i>
            </span>
            <input value={form.name} onChange={set("name")} />
          </label>
          <label className="rsv-field">
            <span className="rsv-label">フリガナ</span>
            <input
              value={form.kana}
              onChange={set("kana")}
              placeholder="カタカナ or ひらがな"
            />
          </label>
          <label className="rsv-field">
            <span className="rsv-label">
              メールアドレス<i>必須</i>
            </span>
            <input type="email" value={form.email} onChange={set("email")} />
          </label>
          <label className="rsv-field">
            <span className="rsv-label">
              電話番号<i>必須</i>
            </span>
            <input type="tel" value={form.tel} onChange={set("tel")} />
          </label>
          <label className="rsv-field">
            <span className="rsv-label">その他ご希望</span>
            <textarea rows={4} value={form.note} onChange={set("note")} />
          </label>
          <div className="rsv-pay">
            <span className="rsv-label">お支払い方法</span>
            {cfg.pays.map((p) => (
              <label className="rsv-radio" key={p}>
                <input
                  type="radio"
                  name="pay"
                  checked={form.pay === p}
                  onChange={() => setForm((f) => ({ ...f, pay: p }))}
                />
                {p}
              </label>
            ))}
          </div>
        </section>

        {/* 5 きっかけ */}
        <section className="rsv-sec">
          <h2 className="rsv-h">
            <span className="rsv-n">5</span>本日ご予約のきっかけを教えてください
          </h2>
          <div className="rsv-sources">
            {cfg.sources.map((s) => (
              <label className="rsv-radio" key={s}>
                <input
                  type="radio"
                  name="source"
                  checked={form.source === s}
                  onChange={() => setForm((f) => ({ ...f, source: s }))}
                />
                {s}
              </label>
            ))}
            <label className="rsv-radio">
              <input
                type="radio"
                name="source"
                checked={form.source === "該当なし・その他"}
                onChange={() =>
                  setForm((f) => ({ ...f, source: "該当なし・その他" }))
                }
              />
              その他
            </label>
          </div>
          {form.source === "該当なし・その他" && (
            <input
              className="rsv-source-other"
              placeholder="選択肢にない場合はこちらに記入ください"
              value={form.sourceOther}
              onChange={set("sourceOther")}
            />
          )}
        </section>

        {/* 注意事項 */}
        <section className="rsv-notes">
          <div className="rsv-notes-h">注意事項</div>
          <ul>
            {cfg.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>

        {state.error && <p className="rsv-err">{state.error}</p>}
        <button className="rsv-submit" onClick={goConfirm}>
          確認画面へ
        </button>
        <a className="rsv-back" href="../">
          ← サイトトップへ戻る
        </a>
      </div>
    </div>
  );
}
