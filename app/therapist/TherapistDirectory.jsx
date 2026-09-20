"use client";

import { useState } from "react";
import StaffCard from "../_components/StaffCard";

const TABS = [
  { key: "all", label: "すべて" },
  { key: "today", label: "本日出勤" },
  { key: "new", label: "新人" },
  { key: "pop", label: "人気" },
  { key: "rec", label: "おすすめ" },
];

function match(t, key) {
  const tags = t.tags || [];
  switch (key) {
    case "today":
      return !t.absent;
    case "new":
      return !!t.isNew;
    case "pop":
      return tags.includes("人気");
    case "rec":
      return tags.includes("おすすめ");
    default:
      return true;
  }
}

export default function TherapistDirectory({ roster }) {
  const [tab, setTab] = useState("all");
  const list = roster.filter((t) => match(t, tab));

  return (
    <>
      <div className="staff-tabs">
        <span className="staff-tabs-dia" aria-hidden="true">
          ◆
        </span>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            className={`staff-tab ${tab === tb.key ? "on" : ""}`}
            aria-pressed={tab === tb.key}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="therapists-empty">該当するセラピストはいません。</p>
      ) : (
        <section className="staff-grid">
          {list.map((t, i) => (
            <StaffCard key={t.id ?? i} t={t} href={`${t.id ?? i + 1}/`} base="../" />
          ))}
        </section>
      )}
    </>
  );
}
