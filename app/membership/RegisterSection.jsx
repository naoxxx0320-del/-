"use client";
/* SECTION 05：VIP会員登録（受付状況は実データ。募集前・受付中・満員・期間終了で表示を切り替え）。 */
import { useEffect, useRef, useState } from "react";
import { jsonp, post, track, API } from "./api";
import MemberCard from "./MemberCard";

function phaseByDate(cfg, now = Date.now()) {
  if (now < Date.parse(cfg.openAt)) return "before";
  if (now > Date.parse(cfg.closeAt)) return "closed";
  return "open";
}

export default function RegisterSection({ cfg }) {
  const [status, setStatus] = useState(null); // API の vip_status（失敗時は {error:true}）
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nickname: "", email: "", tel: "", birthMonth: "", agreeTerms: false, agreeMarketing: false, website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const idem = useRef("");

  const load = () =>
    jsonp({ action: "vip_status" }).then((s) => setStatus(s && s.ok ? s : { error: true }));
  useEffect(() => {
    if (!API) { setStatus({ error: true }); return; }
    load();
  }, []);

  // 受付状況：API の値を優先。読めないときは日付だけで判断（人数は表示しない）
  const phase = status && !status.error ? status.phase : phaseByDate(cfg);
  const vipOpen = phase === "open";
  const memberOnly = phase === "full" || phase === "closed";
  const canRegister = phase !== "before";

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const startForm = () => {
    setOpen(true);
    track("membership_cta_click", { phase });
    if (!idem.current) idem.current = "M" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  };
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.nickname.trim()) return setError("ニックネームを入力してください。");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("メールアドレスを正しく入力してください。");
    if (!form.agreeTerms) return setError("利用規約・プライバシーポリシーへの同意が必要です。");
    setSending(true);
    track("membership_register_submit", { phase });
    const r = await post({ action: "member_register", ...form, idempotencyKey: idem.current });
    setSending(false);
    if (r && r.ok) {
      setDone(r);
      track("membership_register_complete", { kind: r.kind });
      load();
    } else {
      setError((r && r.reason) || "登録できませんでした。");
      track("membership_register_error", { reason: (r && r.reason) || "" });
      load();
    }
  };

  const remainingText =
    status && !status.error
      ? phase === "open"
        ? `残り ${status.remaining} 名（${status.count} / ${status.capacity} 名 登録済み）`
        : phase === "full"
        ? `定員（${status.capacity}名）に達しました`
        : ""
      : "";

  return (
    <section className="mb-sec mb-register" id="register" aria-labelledby="mb-s5">
      <p className="mb-sec-en">REGISTER</p>
      <h2 className="mb-sec-h" id="mb-s5">{memberOnly ? "会員登録（無料）" : "OPENING VIP 先着100名様限定"}</h2>

      {phase === "before" && <p className="mb-phase">{cfg.openLabel} 0:00 より受付を開始します。</p>}
      {vipOpen && <p className="mb-phase">ただ今、VIP会員を受付中です。</p>}
      {phase === "full" && <p className="mb-phase">OPENING VIP は定員に達したため、受付を終了しました。通常会員としてのご登録は引き続き受け付けています。</p>}
      {phase === "closed" && <p className="mb-phase">OPENING VIP の募集は終了しました。通常会員としてのご登録は引き続き受け付けています。</p>}
      {remainingText && <p className="mb-remaining">{remainingText}</p>}
      {status && status.error && API && <p className="mb-note">受付状況を読み込めませんでした（ご登録はお試しいただけます）。</p>}

      <dl className="mb-terms">
        <div><dt>募集期間</dt><dd>{cfg.openLabel}〜{cfg.closeLabel}</dd></div>
        <div><dt>VIP特典の有効期限</dt><dd>2026年12月31日まで</dd></div>
        <div><dt>入会金・年会費</dt><dd>無料</dd></div>
      </dl>

      {done ? (
        <div className="mb-done">
          <p className="mb-done-h">{done.kind === "VIP" ? "VIP会員のご登録が完了しました" : "会員登録が完了しました"}</p>
          <MemberCard memberNo={done.memberNo} kind={done.kind} nickname={done.nickname} validUntil={done.validUntil} />
          <p className="mb-note">ご登録のメールアドレスに、会員番号とデジタル会員証のURLをお送りしました。ご来店時に会員証の画面をご提示ください。</p>
          <a className="mb-card-link" href={`card/?k=${encodeURIComponent(done.cardKey)}`}>会員証を開く（ブックマーク推奨）</a>
        </div>
      ) : !API ? (
        <button className="mb-cta" type="button" disabled>ただ今準備中です</button>
      ) : !canRegister ? (
        <button className="mb-cta" type="button" disabled>{cfg.openLabel} 受付開始</button>
      ) : !open ? (
        <button className="mb-cta" type="button" onClick={startForm}>
          {vipOpen ? "無料でVIP会員に登録する" : "無料で会員登録する"}
        </button>
      ) : (
        <form className="mb-form" onSubmit={submit} noValidate>
          <label className="mb-field">ニックネーム<span className="mb-req">必須</span>
            <input type="text" maxLength={20} autoComplete="nickname" value={form.nickname} onChange={set("nickname")} />
          </label>
          <label className="mb-field">メールアドレス<span className="mb-req">必須</span>
            <input type="email" maxLength={120} autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} />
            <small>会員番号と会員証のURLをお送りします。</small>
          </label>
          <label className="mb-field">電話番号<span className="mb-opt">任意</span>
            <input type="tel" maxLength={15} autoComplete="tel" inputMode="tel" value={form.tel} onChange={set("tel")} />
            <small>ご予約時と同じ番号だと、ご来店回数が会員証に反映されやすくなります。</small>
          </label>
          <label className="mb-field">誕生月<span className="mb-opt">任意</span>
            <select value={form.birthMonth} onChange={set("birthMonth")}>
              <option value="">選択しない</option>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}月</option>)}
            </select>
            <small>GOLD以上の誕生月限定特典のご案内に使います。</small>
          </label>
          <input className="mb-hp" type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} aria-hidden="true" />
          <label className="mb-check">
            <input type="checkbox" checked={form.agreeTerms} onChange={set("agreeTerms")} />
            <span><a href="../terms/" target="_blank" rel="noopener">利用規約</a>・<a href="../privacy/" target="_blank" rel="noopener">プライバシーポリシー</a>に同意します（必須）</span>
          </label>
          <label className="mb-check">
            <input type="checkbox" checked={form.agreeMarketing} onChange={set("agreeMarketing")} />
            <span>キャンペーン・お知らせのメールを受け取る（任意）</span>
          </label>
          {error && <p className="mb-error" role="alert">{error}</p>}
          <button className="mb-cta" type="submit" disabled={sending}>
            {sending ? "送信中…" : vipOpen ? "無料でVIP会員に登録する" : "無料で会員登録する"}
          </button>
          <p className="mb-note">ご入力の情報は会員管理とご案内のためにのみ使用し、公開することはありません。</p>
        </form>
      )}
    </section>
  );
}
