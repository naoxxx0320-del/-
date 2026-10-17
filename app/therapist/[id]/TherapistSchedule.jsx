"use client";
/* 個別ページの「出勤情報」：週間出勤表（schedule.json）から、この人の今日以降の予定を表示。
   公開後に日付が変わっても過去の日が残らないよう、表示する時点でも今日以降に絞り直す。 */
import { useEffect, useState } from "react";
import schedule from "../../../data/schedule.json";
import { upcomingDays } from "../../_components/scheduleDays";

const MAX_ROWS = 7;

function rowsFor(name, nowMs) {
  return upcomingDays(schedule.days || [], nowMs)
    .map((d) => {
      const e = (d.list || []).find((x) => x.name === name);
      return e ? { date: d.date, label: d.label || d.date, time: e.time || "", status: e.status || "" } : null;
    })
    .filter(Boolean)
    .slice(0, MAX_ROWS);
}

export default function TherapistSchedule({ name, base }) {
  const [rows, setRows] = useState(() => rowsFor(name));
  useEffect(() => setRows(rowsFor(name, Date.now())), [name]);

  return (
    <div className="td-comment td-box">
      <span className="tdc-corner tl" aria-hidden="true" />
      <span className="tdc-corner tr" aria-hidden="true" />
      <span className="tdc-corner bl" aria-hidden="true" />
      <span className="tdc-corner br" aria-hidden="true" />
      <h2 className="tdc-head">
        <span className="tdc-dia">◆</span>
        出勤情報
        <span className="tdc-dia">◆</span>
      </h2>
      {rows.length === 0 ? (
        <p className="tdq-empty">現在、掲載中の出勤予定はありません。</p>
      ) : (
        <ul className="tds-list">
          {rows.map((r) => (
            <li className="tds-row" key={r.date}>
              <span className="tds-date">{r.label}</span>
              <span className="tds-time">{r.time}</span>
              {r.status && <span className={`tds-status ${r.status === "満員" ? "full" : ""}`}>{r.status}</span>}
              <a className="tds-go" href={`${base}reserve/?t=${encodeURIComponent(name)}&d=${encodeURIComponent(r.date)}`}>
                予約 ›
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
