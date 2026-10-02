// sitemap.xml を静的生成する。/secret（パスワード付き裏メニュー）は除外。
import { abs } from "./_lib/site";
import roster from "../data/roster.json";

export const dynamic = "force-static";

export default function sitemap() {
  // 明確な更新日時を管理しているページだけ lastModified を付ける。
  // 出勤情報（schedule/）はスプレッドシート取り込みで頻繁に更新されるため付与、
  // それ以外はビルド毎に更新扱いになるのを避けて省略する（SEO上の不自然さ回避）。
  const dynamicPaths = new Set(["schedule/"]);
  const now = new Date();

  // 主要ページ（末尾スラッシュ運用に合わせる）。値は [パス, 優先度]。
  const pages = [
    ["", 1.0],
    ["schedule/", 0.9],
    ["therapist/", 0.9],
    ["system/", 0.8],
    ["access/", 0.7],
    ["reserve/", 0.8],
    ["gallery/", 0.6],
    ["foreigners/", 0.5],
    ["flow/", 0.6],
    ["first/", 0.6],
    ["terms/", 0.4],
    ["privacy/", 0.4],
    ["links/", 0.4],
    ["careers/", 0.5],
    ["recruit/", 0.5],
  ];

  const staticEntries = pages.map(([path, priority]) => {
    const entry = {
      url: abs(path),
      changeFrequency: path === "" || path === "schedule/" ? "daily" : "weekly",
      priority,
    };
    if (dynamicPaths.has(path)) entry.lastModified = now;
    return entry;
  });

  // セラピスト個別ページ（個別の更新日時は管理していないため lastModified は省略）
  const therapistEntries = roster.map((t, i) => ({
    url: abs(`therapist/${t.id ?? i + 1}/`),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...therapistEntries];
}
