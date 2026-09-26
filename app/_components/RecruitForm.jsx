"use client";

/* 求人応募フォーム（スタッフ求人／セラピスト求人で共用）。
   入力 → 確認 → 送信 → 受付完了。送信先は data/recruit-config.json の endpoint
   （＝既存予約と同じ Google Apps Script 方式）。
   - role.status !== "open"（準備中/募集終了）のときは受付を締め、応募できると誤認させない。
   - endpoint 未設定のときは「送信は未接続」として、見た目だけの成功を作らない。 */
import { useState } from "react";
import cfg from "../../data/recruit-config.json";
import links from "../../data/links.json";
import { SITE } from "../_lib/site";

export default function RecruitForm({ role }) {
  const roleCfg = cfg.roles[role] || {};
  const accepting = roleCfg.status === "open";
  const hasEndpoint = !!cfg.endpoint;
  const emailMode = !hasEndpoint && !!cfg.applyEmail; // メール(mailto)で受付
  const roleLabel = roleCfg.name || "求人";
  const methods = cfg.form.contactMethods || ["LINE", "電話", "メール"];

  const [form, setForm] = useState({
    name: "",
    method: methods[0] || "LINE",
    contact: "",
    timePref: "",
    daysPref: "",
    experience: "",
    startPref: "",
    note: "",
    agree: false,
  });
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState({
    sending: false,
    done: false,
    emailed: false,
    error: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const contactLabel =
    form.method === "LINE"
      ? "LINE ID（またはお名前）"
      : form.method === "電話"
      ? "電話番号"
      : "メールアドレス";

  const validate = () => {
    if (!form.name.trim()) return "お名前（ニックネーム可）をご入力ください。";
    if (!form.contact.trim())
      return `ご希望の連絡方法（${form.method}）の連絡先をご入力ください。`;
    if (
      form.method === "メール" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact.trim())
    )
      return "メールアドレスの形式をご確認ください。";
    if (!form.agree)
      return "個人情報の取扱いについてご確認・ご同意ください。";
    return "";
  };

  const goConfirm = () => {
    if (!accepting) return;
    const err = validate();
    if (err) {
      setState((s) => ({ ...s, error: err }));
      return;
    }
    setState((s) => ({ ...s, error: "" }));
    setConfirming(true);
  };

  const submit = async () => {
    if (!cfg.endpoint) {
      setState({
        sending: false,
        done: false,
        error:
          "現在、応募の受付窓口を準備中です。恐れ入りますが、今しばらくお待ちください。",
      });
      return;
    }
    setState({ sending: true, done: false, error: "" });
    const body = new URLSearchParams({
      type: "recruit",
      role,
      roleLabel,
      name: form.name,
      method: form.method,
      contact: form.contact,
      timePref: form.timePref,
      daysPref: form.daysPref,
      experience: form.experience,
      startPref: form.startPref,
      note: form.note,
    });
    try {
      await fetch(cfg.endpoint, { method: "POST", mode: "no-cors", body });
      setState({ sending: false, done: true, error: "" });
    } catch (e) {
      setState({
        sending: false,
        done: false,
        error:
          "送信に失敗しました。通信環境をご確認のうえ、再度お試しください。",
      });
    }
  };

  // メール(mailto)本文を組み立て
  const mailtoHref = () => {
    const subject = `【${roleLabel}応募】${form.name}`;
    const body = [
      `AROMA DAIAMOND ${roleLabel} への応募`,
      "",
      `応募職種：${roleLabel}`,
      `お名前：${form.name}`,
      `ご希望の連絡方法：${form.method}`,
      `連絡先：${form.contact}`,
      `希望勤務時間帯：${form.timePref || "－"}`,
      `希望勤務日数：${form.daysPref || "－"}`,
      `経験：${form.experience || "－"}`,
      `勤務開始の希望：${form.startPref || "－"}`,
      `ご質問・ご希望：${form.note || "－"}`,
      "",
      "※このメールをそのまま送信してください。",
    ].join("\r\n");
    return `mailto:${cfg.applyEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };
  const openMail = () => {
    setState({ sending: false, done: true, emailed: true, error: "" });
  };

  /* ---------- 受付完了 ---------- */
  if (state.done) {
    return (
      <div className="rec-apply">
        <div className="rsv-done">
          <div className="rsv-done-ic mail">✓</div>
          {state.emailed ? (
            <>
              <h2>メールアプリを開きました</h2>
              <p>
                <b>{roleLabel}</b>の応募メールを作成しました。
                内容をご確認のうえ、そのまま<b>送信</b>してください。
                送信をもって応募完了となります。
              </p>
              <p className="rec-note-small">
                メールアプリが開かない場合は、下記までご連絡ください。
                <br />
                メール：{cfg.applyEmail}
                <br />
                LINE・お電話（{SITE.telephoneDisplay}）でも受け付けています。
              </p>
            </>
          ) : (
            <>
              <h2>応募を受け付けました</h2>
              <p>
                <b>{roleLabel}</b>へのご応募ありがとうございます。
                内容を確認のうえ、ご希望の連絡方法（{form.method}）でご連絡いたします。
              </p>
            </>
          )}
          <div className="rsv-done-box">
            <div className="rsv-done-box-h">応募内容</div>
            <div>
              <b>応募職種</b>
              {roleLabel}
            </div>
            <div>
              <b>お名前</b>
              {form.name}
            </div>
            <div>
              <b>連絡方法</b>
              {form.method}
            </div>
          </div>
          <p className="rec-note-small">
            ※ご応募をもって採用が決定するものではありません。担当より改めてご連絡いたします。
          </p>
        </div>
      </div>
    );
  }

  /* ---------- 確認画面 ---------- */
  if (confirming) {
    const rows = [
      ["応募職種", roleLabel],
      ["お名前", form.name],
      ["連絡方法", form.method],
      [contactLabel, form.contact],
      ["希望時間帯", form.timePref || "－"],
      ["希望勤務日数", form.daysPref || "－"],
      ["経験", form.experience || "－"],
      ["勤務開始の希望", form.startPref || "－"],
      ["ご質問・ご希望", form.note || "－"],
    ];
    return (
      <div className="rec-apply">
        <p className="rsv-lead">
          以下の内容でよろしければ「この内容で応募する」を押してください。
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
        {emailMode ? (
          <>
            <a className="rsv-submit" href={mailtoHref()} onClick={openMail}>
              メールで応募する
            </a>
            <p className="rec-note-small">
              ボタンを押すとメールアプリが開きます。本文はそのままで、送信してください。
            </p>
          </>
        ) : (
          <button className="rsv-submit" onClick={submit} disabled={state.sending}>
            {state.sending ? "送信中…" : "この内容で応募する"}
          </button>
        )}
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
    );
  }

  /* ---------- 入力フォーム ---------- */
  return (
    <div className="rec-apply">
      {!accepting && (
        <div className="rec-draft-note" role="status">
          現在、募集要項を準備中です。応募受付の開始まで今しばらくお待ちください。
          （下記は入力画面のプレビューです）
        </div>
      )}

      <div className="rec-applyjob">
        <span className="rec-applyjob-label">応募職種</span>
        <span className="rec-applyjob-val">{roleLabel}</span>
      </div>

      <label className="rsv-field">
        <span className="rsv-label">
          お名前（ニックネーム可）<i>必須</i>
        </span>
        <input value={form.name} onChange={set("name")} disabled={!accepting} />
      </label>

      <div className="rsv-pay">
        <span className="rsv-label">
          ご希望の連絡方法<i>必須</i>
        </span>
        {methods.map((m) => (
          <label className="rsv-radio" key={m}>
            <input
              type="radio"
              name="rec-method"
              checked={form.method === m}
              onChange={() => setForm((f) => ({ ...f, method: m }))}
              disabled={!accepting}
            />
            {m}
          </label>
        ))}
      </div>

      <label className="rsv-field">
        <span className="rsv-label">
          {contactLabel}
          <i>必須</i>
        </span>
        <input
          value={form.contact}
          onChange={set("contact")}
          disabled={!accepting}
          inputMode={form.method === "電話" ? "tel" : "text"}
        />
        <span className="rec-hint">
          ご入力の連絡方法にのみご連絡します。他の連絡先は不要です。
        </span>
      </label>

      <label className="rsv-field">
        <span className="rsv-label">希望の勤務時間帯（任意）</span>
        <select value={form.timePref} onChange={set("timePref")} disabled={!accepting}>
          <option value="">選択しない</option>
          {cfg.form.timePrefs.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="rsv-field">
        <span className="rsv-label">希望の勤務日数（任意）</span>
        <select value={form.daysPref} onChange={set("daysPref")} disabled={!accepting}>
          <option value="">選択しない</option>
          {cfg.form.daysPrefs.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <div className="rsv-pay">
        <span className="rsv-label">経験（任意）</span>
        {cfg.form.experience.map((x) => (
          <label className="rsv-radio" key={x}>
            <input
              type="radio"
              name="rec-exp"
              checked={form.experience === x}
              onChange={() => setForm((f) => ({ ...f, experience: x }))}
              disabled={!accepting}
            />
            {x}
          </label>
        ))}
      </div>

      <label className="rsv-field">
        <span className="rsv-label">勤務開始のご希望（任意）</span>
        <select value={form.startPref} onChange={set("startPref")} disabled={!accepting}>
          <option value="">選択しない</option>
          {cfg.form.startPrefs.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="rsv-field">
        <span className="rsv-label">ご質問・ご希望（任意）</span>
        <textarea
          rows={4}
          value={form.note}
          onChange={set("note")}
          disabled={!accepting}
          placeholder="お仕事内容や条件について、聞いてみたいことがあればご記入ください。"
        />
      </label>

      <label className="rec-agree">
        <input
          type="checkbox"
          checked={form.agree}
          onChange={(e) => setForm((f) => ({ ...f, agree: e.target.checked }))}
          disabled={!accepting}
        />
        <span>
          個人情報の取扱いに同意します（ご入力内容は採用選考のみに利用します）
          <i>必須</i>
        </span>
      </label>

      {state.error && <p className="rsv-err">{state.error}</p>}

      <button
        className="rsv-submit"
        onClick={goConfirm}
        disabled={!accepting}
      >
        {accepting ? "確認画面へ" : "応募受付は準備中です"}
      </button>
      <p className="rec-note-small">
        ※ご応募をもって採用が決定するものではありません。内容を確認のうえ、担当よりご連絡いたします。
      </p>

      {accepting && (links.line || SITE.telephone) && (
        <div className="rec-orcontact">
          <div className="rec-orcontact-h">メールフォームのほか、こちらでも受付中</div>
          <div className="rec-contact-btns">
            {links.line && (
              <a
                className="rec-contact-line"
                href={links.line}
                target="_blank"
                rel="noopener noreferrer"
              >
                LINEで応募する
              </a>
            )}
            <a className="rec-contact-tel" href={`tel:${SITE.telephone}`}>
              電話で応募（{SITE.telephoneDisplay}）
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
