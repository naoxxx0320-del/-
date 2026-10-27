"use client";
/* セラピスト本人のシフト入力。予約管理API（公開API）に鍵を送り、本人の出勤だけを読み書きする。
   お客様の情報・予約状況は表示しない（サーバーも返さない）。
   保存すると出勤情報シートに書き込まれ、数分でサイト・予約受付に反映される。 */
import { useEffect, useState } from "react";
import cfg from "../../data/reserve-config.json";

const API = (cfg.apiV2 || "").trim();

// 30分刻みの時刻（10:00〜翌5:00）
const TIMES = (() => {
  const out = [];
  for (let m = 10 * 60; m <= 29 * 60; m += 30) {
    const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
    out.push(h >= 24 ? `翌${h - 24}:${mm}` : `${h}:${mm}`);
  }
  return out;
})();
const idx = (t) => TIMES.indexOf(t);

async function call(body) {
  try {
    const res = await fetch(API, { method: "POST", body: JSON.stringify(body) });
    return await res.json();
  } catch (e) {
    return { ok: false, reason: "通信に失敗しました。電波のよい場所でもう一度お試しください。" };
  }
}

export default function ShiftClient() {
  const [key, setKey] = useState("");
  const [state, setState] = useState({ loading: true, error: "", name: "", days: [] });
  const [edit, setEdit] = useState(null); // { date, start, end }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async (k) => {
    const r = await call({ action: "shift_me", key: k });
    if (!r || !r.ok) setState({ loading: false, error: (r && r.reason) || "読み込めませんでした。", name: "", days: [] });
    else setState({ loading: false, error: "", name: r.name, days: r.days || [] });
  };

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("k") || "";
    setKey(k);
    if (!API) setState({ loading: false, error: "現在ご利用いただけません。お店にご連絡ください。", name: "", days: [] });
    else if (!k) setState({ loading: false, error: "お店から届いた専用のURLから開いてください。", name: "", days: [] });
    else load(k);
  }, []);

  const save = async () => {
    if (!edit) return;
    if (idx(edit.end) <= idx(edit.start)) { setMsg("終了は開始より後の時間を選んでください。"); return; }
    setBusy(true); setMsg("");
    const r = await call({ action: "shift_set", key, date: edit.date, start: edit.start, end: edit.end });
    setBusy(false);
    if (!r || !r.ok) { setMsg((r && r.reason) || "保存できませんでした。"); return; }
    setEdit(null);
    setMsg("保存しました。数分でサイトに反映されます。");
    load(key);
  };
  const remove = async (d) => {
    if (!window.confirm(`${d.label} の出勤を取り消します。よろしいですか？`)) return;
    setBusy(true); setMsg("");
    const r = await call({ action: "shift_del", key, date: d.date });
    setBusy(false);
    if (!r || !r.ok) { setMsg((r && r.reason) || "取り消せませんでした。"); return; }
    setEdit(null);
    setMsg("取り消しました。数分でサイトに反映されます。");
    load(key);
  };

  return (
    <div className="stage">
      <div className="device" style={{ background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat" }}>
        <div className="page-head">
          <div className="ph-en">Shift</div>
          <h1 className="ph-jp">シフト入力</h1>
        </div>
        <section className="td-comment shf">
          <span className="tdc-corner tl" aria-hidden="true" />
          <span className="tdc-corner tr" aria-hidden="true" />
          <span className="tdc-corner bl" aria-hidden="true" />
          <span className="tdc-corner br" aria-hidden="true" />
          {state.loading ? (
            <p className="shf-note">読み込み中…</p>
          ) : state.error ? (
            <p className="shf-err">{state.error}</p>
          ) : (
            <>
              <h2 className="tdc-head">
                <span className="tdc-dia">◆</span>
                {state.name} さんの出勤
                <span className="tdc-dia">◆</span>
              </h2>
              <p className="shf-note">
                今日から4週間先まで入力できます。保存すると数分でサイトに反映されます。
                ご予約が入っている日の変更・取消はお店にご連絡ください。
              </p>
              {msg && <p className="shf-msg" role="status">{msg}</p>}
              <ul className="shf-list">
                {state.days.map((d) => {
                  const on = !!(d.start && d.end);
                  const editing = edit && edit.date === d.date;
                  return (
                    <li className={`shf-row${on ? " on" : ""}`} key={d.date}>
                      <div className="shf-line">
                        <span className="shf-date">{d.label}</span>
                        <span className="shf-time">
                          {on ? `${d.start}〜${d.end}` : "—"}
                          {d.absent && <span className="shf-off">休み</span>}
                        </span>
                        {!editing && (
                          <button
                            type="button"
                            className="shf-btn"
                            disabled={busy}
                            onClick={() => { setMsg(""); setEdit({ date: d.date, start: on && idx(d.start) >= 0 ? d.start : "13:00", end: on && idx(d.end) >= 0 ? d.end : "翌2:00" }); }}
                          >
                            {on ? "変更" : "登録"}
                          </button>
                        )}
                      </div>
                      {editing && (
                        <div className="shf-edit">
                          <label>
                            開始
                            <select value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })}>
                              {TIMES.slice(0, -1).map((t) => <option key={t}>{t}</option>)}
                            </select>
                          </label>
                          <span aria-hidden="true">〜</span>
                          <label>
                            終了
                            <select value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })}>
                              {TIMES.slice(1).map((t) => <option key={t}>{t}</option>)}
                            </select>
                          </label>
                          <div className="shf-actions">
                            <button type="button" className="shf-save" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存"}</button>
                            <button type="button" className="shf-cancel" disabled={busy} onClick={() => setEdit(null)}>やめる</button>
                            {on && <button type="button" className="shf-del" disabled={busy} onClick={() => remove(d)}>この日を取消</button>}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
