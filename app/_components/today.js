"use client";
/* 本日の出勤（週間出勤表＝schedule.json の今日の行）。閲覧時点の営業日（朝6時までは前日）で選ぶ。
   初回の描画は公開時点の today を使い（静的HTMLと一致させる）、表示後に端末の時刻で選び直す。 */
import { useEffect, useState } from "react";
import schedule from "../../data/schedule.json";
import { dayKey, bizTodayKey } from "./scheduleDays";

export const HAS_TODAY = !!schedule.today; // 古いデータ（today 無し）なら従来の名簿の「出勤」列を使う

export function useTodayKey() {
  const [k, setK] = useState(dayKey(schedule.today));
  useEffect(() => {
    setK(bizTodayKey());
  }, []);
  return k;
}

export function keyLabel(k) {
  return k ? `${Math.floor(k / 10000)}/${Math.floor((k % 10000) / 100)}/${k % 100}` : "";
}

// 今日の出勤の行（並び順済み）。無ければ []。
export function todayList(k) {
  const d = (schedule.days || []).find((x) => dayKey(x.date) === k);
  return d ? d.list : [];
}

// 今日の行に名簿のプロフィール（写真など）を合わせたカード用データ
export function todayCards(k, roster) {
  const byName = new Map(roster.map((p) => [p.name, p]));
  return todayList(k).map((e) => {
    const p = byName.get(e.name) || { name: e.name };
    return {
      ...p,
      name: e.name,
      absent: false,
      sched: e.time ? `本日 ${e.time}` : p.sched || "",
      status: e.status || p.status || "",
      guideTime: e.guideTime || "",
    };
  });
}

export const SCHEDULE_UPDATED = schedule.updated || "";
export const SCHEDULE_AREA = schedule.area || "亀戸";
