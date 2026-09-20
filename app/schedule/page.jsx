"use client";

import { useState } from "react";
import SiteChrome from "../_components/SiteChrome";
import StaffCard from "../_components/StaffCard";
import schedule from "../../data/schedule.json";
import roster from "../../data/roster.json";

// 名前 → プロフィール（写真・スペック等は「本日の出勤」シートで一元管理）
const PROFILE = Object.fromEntries(roster.map((p) => [p.name, p]));

export default function Schedule() {
  const days = schedule.days || [];
  const [active, setActive] = useState(0);
  const day = days[active] || { list: [] };

  // 出勤情報の各行に、名前一致でプロフィールを合成（出勤時間・ステータスは行の値を使用）
  const cards = day.list.map((e) => {
    const p = PROFILE[e.name] || {};
    return {
      ...p,
      name: e.name,
      sched: e.time || p.sched || "",
      status: e.status || p.status || "",
      schedSub: "",
      absent: undefined,
    };
  });

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

        {cards.length === 0 ? (
          <p className="therapists-empty">この日の出勤情報はまだありません。</p>
        ) : (
          <section className="staff-grid">
            {cards.map((t, i) => (
              <StaffCard
                t={t}
                base="../"
                href={t.id ? `../therapist/${t.id}/` : "#"}
                sched={t.sched}
                status={t.status}
                reserveHref={`../reserve/?t=${encodeURIComponent(t.name)}&d=${encodeURIComponent(
                  day.date || day.label || ""
                )}`}
                key={i}
              />
            ))}
          </section>
        )}

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
