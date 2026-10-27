"use client";
/* セラピスト本人のシフト入力。予約管理API（公開API）に鍵を送り、本人の出勤を「登録」だけ行う。
   登録済みの日の変更・取消はお店（管理画面）が行う。
   各日に、ほかのセラピストの出勤（名前と時間）を「埋まり」として表示し、重なる時間は登録できない（部屋が1室）。
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
// "13:00" / "翌2:00" → その日の0:00からの分
const toMin = (t) => {
  const m = String(t || "").match(/^(翌)?(\d{1,2}):(\d{2})$/);
  return m ? (m[1] ? 24 * 60 : 0) + +m[2] * 60 + +m[3] : null;
};
// 選んだ時間と重なる、ほかの人の出勤
const overlapOf = (others, start, end) => {
  const s = toMin(start), e = toMin(end);
  return (others || []).find((o) => toMin(o.start) < e && s < toMin(o.end));
};
// 空いている最初の開始時刻（13:00 から探し、無ければ最初の空き）
const firstFree = (others) => {
  const order = [...TIMES.slice(idx("13:00"), -1), ...TIMES.slice(0, idx("13:00"))];
  return order.find((t) => !overlapOf(others, t, TIMES[idx(t) + 1])) || "13:00";
};

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
    const day = state.days.find((d) => d.date === edit.date);
    const ov = overlapOf(day && day.others, edit.start, edit.end);
    if (ov) { setMsg(`この時間は ${ov.name} さんの出勤（${ov.start}〜${ov.end}）と重なるため登録できません。`); return; }
    setBusy(true); setMsg("");
    const r = await call({ action: "shift_set", key, date: edit.date, start: edit.start, end: edit.end });
    setBusy(false);
    if (!r || !r.ok) { setMsg((r && r.reason) || "保存できませんでした。"); return; }
    setEdit(null);
    setMsg("保存しました。数分でサイトに反映されます。");
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
                今日から4週間先まで、出勤を登録できます。保存すると数分でサイトに反映されます。
                ほかの方の出勤と重なる時間は登録できません。登録した日の変更・取消はお店にご連絡ください。
              </p>
              {msg && <p className="shf-msg" role="status">{msg}</p>}
              <ul className="shf-list">
                {state.days.map((d) => {
                  const on = !!d.registered;
                  const editing = edit && edit.date === d.date;
                  // ほかの人の出勤で30分の空きも無い日は「空きなし」
                  const full = !on && (d.others || []).length > 0 && TIMES.slice(0, -1).every((t) => overlapOf(d.others, t, TIMES[idx(t) + 1]));
                  return (
                    <li className={`shf-row${on ? " on" : ""}`} key={d.date}>
                      <div className="shf-line">
                        <span className="shf-date">{d.label}</span>
                        <span className="shf-time">
                          {on ? (d.start && d.end ? `${d.start}〜${d.end}` : "登録済み") : full ? "空きなし" : "—"}
                          {d.absent && <span className="shf-off">休み</span>}
                        </span>
                        {on ? (
                          <span className="shf-done">登録済み</span>
                        ) : (
                          !editing && !full && (
                            <button
                              type="button"
                              className="shf-btn"
                              disabled={busy}
                              onClick={() => {
                                setMsg("");
                                const st = firstFree(d.others);
                                setEdit({ date: d.date, start: st, end: TIMES[Math.min(idx(st) + 2, TIMES.length - 1)] });
                              }}
                            >
                              登録
                            </button>
                          )
                        )}
                      </div>
                      {(d.others || []).length > 0 && (
                        <ul className="shf-busy" aria-label="ほかの方の出勤（この時間は登録できません）">
                          {d.others.map((o, i) => (
                            <li key={i}>
                              <span className="shf-busy-tag">埋まり</span>
                              {o.name}　{o.start}〜{o.end}
                            </li>
                          ))}
                        </ul>
                      )}
                      {editing && (
                        <div className="shf-edit">
                          <label>
                            開始
                            <select value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })}>
                              {TIMES.slice(0, -1).map((t) => (
                                <option key={t} disabled={!!overlapOf(d.others, t, TIMES[idx(t) + 1])}>{t}</option>
                              ))}
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
