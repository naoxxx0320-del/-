"use client";

import { useState } from "react";
import SiteChrome from "../_components/SiteChrome";
import schedule from "../../data/schedule.json";

const STATUS_CLASS = {
  空きあり: "ok",
  残りわずか: "few",
  満員: "full",
  受付終了: "closed",
  出勤: "ok",
};

export default function Schedule() {
  const days = schedule.days || [];
  const [active, setActive] = useState(0);
  const day = days[active] || { list: [] };

  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background:
            "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <div className="page-head">
          <div className="ph-en">Schedule</div>
          <div className="ph-jp">出勤情報</div>
        </div>

        <div className="sch-tabs">
          {days.map((d, i) => (
            <button
              key={i}
              className={`sch-tab ${i === active ? "on" : ""}`}
              onClick={() => setActive(i)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="area-band">
          <svg className="ab-dia" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M4.5 9 L12 2.5 L19.5 9 L12 21.5 Z" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M4.5 9 H19.5 M9 9 L12 21.5 M15 9 L12 21.5 M9 9 L12 2.5 M15 9 L12 2.5" fill="none" stroke="#fff" strokeWidth="0.9" />
          </svg>
          <span className="ab-name">{schedule.area || "亀戸"}</span>
        </div>

        <section className="sch-wrap">
          {day.list.length === 0 ? (
            <p className="sch-empty">この日の出勤情報はまだありません。</p>
          ) : (
            <ul className="sch-list">
              {day.list.map((e, i) => (
                <li key={i}>
                  <span className="sch-heart" aria-hidden="true">💠</span>
                  <span className="sch-name">{e.name}</span>
                  <span className="sch-time">{e.time}</span>
                  {e.status && (
                    <span className={`gstatus ${STATUS_CLASS[e.status] || ""}`}>
                      {e.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
