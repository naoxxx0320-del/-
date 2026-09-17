"use client";

import { useEffect, useMemo, useState } from "react";
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
/* 時刻ラベル（"13:00" / "翌2:00"）→ 分。
   Googleスプレッドシートが時刻を日付値に変換した場合
   （例 "1899-12-30T21:00:00.000Z"）にも対応。 */
function labelToMin(s) {
  s = String(s || "");
  const iso = s.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/);
  if (iso) return +iso[1] * 60 + +iso[2]; // 変換済み時刻（UTCの時:分＝表示時刻）
  const m = s.match(/(翌)?\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return +m[2] * 60 + +m[3] + (m[1] ? 1440 : 0);
}
/* コース名（"60分コース"）→ 所要分 */
function courseMinOf(c) {
  const m = String(c || "").match(/(\d+)\s*分/);
  return m ? +m[1] : 60;
}
/* 希望日(例 "2026/9/16") + 時刻ラベル("13:00"/"翌2:00") → JSTの壁時計 "YYYY/MM/DD HH:mm"。
   翌なら日付を+1。キャンセル期限の判定に使う。 */
function apptString(dateStr, timeLabel) {
  const dm = String(dateStr || "").match(/(\d+)\/(\d+)\/(\d+)/);
  const tm = String(timeLabel || "").match(/(翌)?\s*(\d{1,2}):(\d{2})/);
  if (!dm || !tm) return "";
  const dt = new Date(+dm[1], +dm[2] - 1, +dm[3] + (tm[1] ? 1 : 0), +tm[2], +tm[3]);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}/${p(dt.getMonth() + 1)}/${p(dt.getDate())} ${p(
    dt.getHours()
  )}:${p(dt.getMinutes())}`;
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
  const [booked, setBooked] = useState([]); // 既存予約（スプレッドシートから取得）
  const [dbg, setDbg] = useState(false); // ?debug=1 のとき診断表示

  useEffect(() => {
    try {
      setDbg(new URLSearchParams(window.location.search).get("debug") === "1");
    } catch (_) {}
  }, []);

  const day = days[dayIdx] || { list: [], label: "" };

  // 現在の予約状況を JSONP で取得（重複予約を防ぐ）。
  // ・セラピストを選ぶたび／ページ復帰時に取り直し
  // ・末尾に時刻を付けてブラウザ／CDNのキャッシュを回避（＝常に最新）
  useEffect(() => {
    if (!cfg.endpoint) return;
    let cancelled = false;
    const load = () => {
      const cb = "__resvAvail_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const done = () => {
        try {
          delete window[cb];
        } catch (_) {}
        script.remove();
      };
      window[cb] = (data) => {
        if (!cancelled) setBooked(Array.isArray(data) ? data : []);
        done();
      };
      script.src =
        cfg.endpoint +
        (cfg.endpoint.includes("?") ? "&" : "?") +
        "callback=" +
        cb +
        "&_=" +
        Date.now();
      script.onerror = done;
      document.body.appendChild(script);
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [therapist, dayIdx]);

  // 選択中セラピストの出勤時間 → 予約可能スロット
  const shiftStr = useMemo(() => {
    const e = day.list.find((x) => x.name === therapist);
    return e ? e.time : "";
  }, [day, therapist]);
  const slots = useMemo(() => genSlots(parseShift(shiftStr)), [shiftStr]);

  // 選択中セラピスト・日付で「埋まっている時間帯」（コース所要時間を考慮）
  const occupied = useMemo(
    () =>
      booked
        .filter((b) => b.th === therapist && b.d === (day.label || ""))
        .map((b) => {
          const s = labelToMin(b.t);
          return s == null ? null : { s, e: s + courseMinOf(b.c) };
        })
        .filter(Boolean),
    [booked, therapist, day]
  );
  const isTaken = (slot) => {
    const m = labelToMin(slot);
    return m != null && occupied.some((r) => m >= r.s && m < r.e);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pickTherapist = (name) => {
    setTherapist(name);
    setTime("");
  };
  const course = courseI >= 0 ? cfg.courses[courseI] : null;

  const validate = () => {
    if (!therapist) return "セラピストを選んでください。";
    if (!time) return "予約時間を選んでください。";
    if (isTaken(time))
      return "申し訳ございません。その時間は予約が入りました。別の時間をお選びください。";
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
      appt: apptString(day.date, time), // キャンセル期限の判定に使う正確な日時（JST）
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
            <div className="rsv-done-ic mail">✉</div>
            <h2>確認メールをお送りしました</h2>
            <div className="rsv-pending">
              まだご予約は完了していません。メールに記載の
              「予約を確定する」リンクを開くと、ご予約が確定します。
            </div>
            <p>
              ご入力のメールアドレス（<b>{form.email}</b>）宛に確認メールをお送りしました。
              メール内のリンクを開いてご予約を確定してください。
              数分たっても届かない場合は、迷惑メールフォルダのご確認、
              またはお電話（050-5444-9830）をお願いいたします。
            </p>
            <div className="rsv-done-box">
              <div className="rsv-done-box-h">仮予約の内容</div>
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
            <>
              <div className="rsv-times">
                {slots.map((s) => {
                  const taken = isTaken(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={taken}
                      className={`rsv-time ${time === s ? "on" : ""} ${
                        taken ? "taken" : ""
                      }`}
                      onClick={() => !taken && setTime(s)}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {occupied.length > 0 && (
                <p className="rsv-legend">
                  取り消し線の時間は予約済みで選べません。
                </p>
              )}
              {dbg && (
                <p
                  className="rsv-legend"
                  style={{ color: "#b02a1a", wordBreak: "break-all" }}
                >
                  [debug] 取得予約:{booked.length}件 / この人の該当:
                  {occupied.length}件 / 選択:{therapist || "-"} / 日付:
                  {day.label || "-"}
                  {booked[0]
                    ? ` / 例:${JSON.stringify(booked[0])}`
                    : " / データ空(または取得失敗)"}
                </p>
              )}
            </>
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
