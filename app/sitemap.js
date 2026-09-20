// sitemap.xml を静的生成する。/secret（パスワード付き裏メニュー）は除外。
import { abs } from "./_lib/site";
import roster from "../data/roster.json";

export const dynamic = "force-static";

export default function sitemap() {
  const now = new Date();

  // 主要ページ（末尾スラッシュ運用に合わせる）。値は [パス, 優先度]。
  const pages = [
    ["", 1.0],
    ["schedule/", 0.9],
    ["therapist/", 0.9],
    ["system/", 0.8],
    ["reserve/", 0.8],
    ["foreigners/", 0.5],
  ];

  const staticEntries = pages.map(([path, priority]) => ({
    url: abs(path),
    lastModified: now,
    changeFrequency: path === "" || path === "schedule/" ? "daily" : "weekly",
    priority,
  }));

  // セラピスト個別ページ
  const therapistEntries = roster.map((t, i) => ({
    url: abs(`therapist/${t.id ?? i + 1}/`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...therapistEntries];
}
