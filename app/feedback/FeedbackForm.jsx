"use client";
/* ご意見フォーム（/feedback/）。
   送信先：予約管理API（data/reserve-config.json の apiV2）の action=feedback。
   サーバー側（apps-script/booking/Code.gs の feedbackSubmit_）で店舗アドレスへメールし、
   お客様情報用のブックの「ご意見」シートに記録する。
   ・サーバーが ok を返したときだけ「送信しました」と表示する（未接続・失敗を成功に見せない）。
   ・記入内容は解析（GA4）に送らない。 */
import { useMemo, useState } from "react";
import cfg from "../../data/reserve-config.json";
import { SITE } from "../_lib/site";
import { track } from "../_lib/track";

const API = (cfg.apiV2 || "").trim();
const LEVELS = ["とても満足", "満足", "普通", "不満", "とても不満"];
const ITEMS = [
  ["treatment", "施術について"],
  ["service", "サービスについて"],
  ["therapist", "セラピストについて"],
  ["clean", "お店の清潔感について"],
  ["phone", "電話受付について"],
];

// 日本時間の今日（YYYY-MM-DD）
function todayJst() {
  const d = new Date(Date.now() + 9 * 3600e3);
  return d.toISOString().slice(0, 10);
}

export default function FeedbackForm({ therapists, courses }) {
  const today = useMemo(todayJst, []);
  const [form, setForm] = useState({
    name: "",
    visitDate: today,
    therapist: "",
    course: "",
    comment: "",
    website: "", // いたずら対策の隠し項目（人は入力しない）
    ratings: Object.fromEntries(ITEMS.map(([k]) => [k, "普通"])),
  });
  const [state, setState] = useState({ sending: false, done: false, error: "" });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setRating = (k, v) => setForm((f) => ({ ...f, ratings: { ...f.ratings, [k]: v } }));

  const submit = async (e) => {
    e.preventDefault();
    if (state.sending) return;
    if (!form.visitDate) return setState({ sending: false, done: false, error: "来店日を選んでください。" });
    if (!form.therapist) return setState({ sending: false, done: false, error: "担当セラピストを選んでください。" });
    if (!API) {
      return setState({
        sending: false,
        done: false,
        error: `送信の設定が完了していません。恐れ入りますが、お電話（${SITE.telephoneDisplay}）でお知らせください。`,
      });
    }
    setState({ sending: true, done: false, error: "" });
    try {
      // Content-Type を付けず text/plain（単純リクエスト）で送り、CORSのプリフライトを避ける
      const res = await fetch(API, { method: "POST", body: JSON.stringify({ action: "feedback", ...form }) });
      const r = await res.json();
      if (r && r.ok) {
        track("feedback_submit"); // 件数だけ。記入内容は送らない
        setState({ sending: false, done: true, error: "" });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setState({ sending: false, done: false, error: (r && r.reason) || "送信できませんでした。時間をおいてもう一度お試しください。" });
      }
    } catch (_) {
      setState({
        sending: false,
        done: false,
        error: "通信エラーで送信できませんでした。電波の良い場所でもう一度お試しください。",
      });
    }
  };

  if (state.done) {
    return (
      <div className="fb-card fb-done" role="status">
        <p className="fb-done-h">ご意見をお送りいただき、ありがとうございました。</p>
        <p className="fb-lead">いただいた内容は、今後のサービス向上に役立てさせていただきます。</p>
        <a className="fb-back" href="../">トップへ戻る</a>
      </div>
    );
  }

  return (
    <form className="fb-card" onSubmit={submit} noValidate>
      <p className="fb-lead">
        当店ご利用のお客様からのご評価を求めております。
        <br />
        遠慮なさらずにご評価いただけると幸いです。
        <br />
        ご意見を参考にサービスの向上に努めてまいります。
      </p>

      <label className="fb-field">
        <span className="fb-label">お名前（仮名可）</span>
        <input value={form.name} onChange={set("name")} maxLength={30} autoComplete="off" />
      </label>

      <label className="fb-field">
        <span className="fb-label">
          来店日<i>*</i>
        </span>
        <input type="date" value={form.visitDate} onChange={set("visitDate")} max={today} required />
      </label>

      <label className="fb-field">
        <span className="fb-label">
          担当セラピスト<i>*</i>
        </span>
        <select value={form.therapist} onChange={set("therapist")} required>
          <option value="">--選択してください--</option>
          {therapists.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
          <option value="わからない・その他">わからない・その他</option>
        </select>
      </label>

      <label className="fb-field">
        <span className="fb-label">コース</span>
        <select value={form.course} onChange={set("course")}>
          <option value="">--選択してください--</option>
          {courses.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      {ITEMS.map(([k, label]) => (
        <fieldset className="fb-field fb-rate" key={k}>
          <legend className="fb-label">
            {label}
            <i>*</i>
          </legend>
          <div className="fb-levels">
            {LEVELS.map((lv) => (
              <label className="fb-radio" key={lv}>
                <input type="radio" name={`fb-${k}`} checked={form.ratings[k] === lv} onChange={() => setRating(k, lv)} />
                {lv}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <label className="fb-field">
        <span className="fb-label">よかった点・悪かった点</span>
        <textarea value={form.comment} onChange={set("comment")} rows={8} maxLength={2000} />
      </label>

      {/* いたずら対策（画面には出さない） */}
      <div className="fb-hp" aria-hidden="true">
        <label>
          website
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </label>
      </div>

      {state.error && (
        <p className="fb-err" role="alert">
          {state.error}
        </p>
      )}

      <button className="fb-submit" type="submit" disabled={state.sending}>
        {state.sending ? "送信中…" : "送信"}
      </button>
    </form>
  );
}
