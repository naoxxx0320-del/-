// sitemap.xml を静的生成する。掲載するのは index 対象の正規URLだけ。
// /secret・抽選関連・会員証（noindex のページ）は載せない。
import { abs } from "./_lib/site";
import roster from "../data/roster.json";

export const dynamic = "force-static";

export default function sitemap() {
  // lastmod（更新日時）は付けない。
  // このサイトは15分ごとの自動ビルドで作り直されるため、ビルド時刻を入れると
  // 内容が変わっていなくても「更新された」と伝えてしまう（実際の更新日時ではない）。
  // ページごとの本当の更新日時を管理できるようになったら、その値だけを入れること。

  // 主要ページ（末尾スラッシュ運用に合わせる）。値は [パス, 優先度]。
  const pages = [
    ["", 1.0],
    ["schedule/", 0.9],
    ["therapist/", 0.9],
    ["system/", 0.8],
    ["access/", 0.7],
    ["room/", 0.7],
    ["reserve/", 0.8],
    ["membership/", 0.7],
    ["gallery/", 0.6],
    ["foreigners/", 0.5],
    ["flow/", 0.6],
    ["first/", 0.6],
    ["faq/", 0.6],
    ["terms/", 0.4],
    ["privacy/", 0.4],
    ["links/", 0.4],
    ["careers/", 0.4],
    ["recruit/", 0.8],
  ];

  const staticEntries = pages.map(([path, priority]) => {
    const entry = {
      url: abs(path),
      changeFrequency: path === "" || path === "schedule/" ? "daily" : "weekly",
      priority,
    };
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
