// お知らせ・ブログ（data/news.json）の共通処理。管理画面の「お知らせ」から編集される。
// 本文は文字だけ（HTMLは使わない）。段落は空行で区切り、[文字](/system/) の形だけリンクにする。
// 「## 」で始まる段落は見出しになる。
import news from "../../data/news.json";

const list = Array.isArray(news?.posts) ? news.posts : [];

// サイトに出す記事（下書き以外・日付の新しい順）
export function publicPosts() {
  return list
    .filter((p) => p && p.id && p.title && p.status !== "draft")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
}

export function findPost(id) {
  return publicPosts().find((p) => p.id === id) || null;
}

export function dateLabel(d) {
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : "";
}

// 本文 → 段落の配列。各段落は行の配列、各行は {text} と {text, href} の並び。
// 見出しの段落は配列に heading: true が付く（parseBody(...)[i].heading）。
const LINK = /\[([^\]\n]{1,60})\]\(((?:\/|https:\/\/)[^\s)]{0,300})\)/g;
export function parseBody(body) {
  return String(body || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((para) => {
      const heading = /^##\s+/.test(para);
      const lines = para
        .replace(/^##\s+/, "")
        .split("\n")
        .map((line) => {
          const parts = [];
          let last = 0;
          for (const m of line.matchAll(LINK)) {
            if (m.index > last) parts.push({ text: line.slice(last, m.index) });
            parts.push({ text: m[1], href: m[2] });
            last = m.index + m[0].length;
          }
          if (last < line.length) parts.push({ text: line.slice(last) });
          return parts;
        })
        .filter((parts) => parts.length > 0);
      if (heading) lines.heading = true;
      return lines;
    })
    .filter((lines) => lines.length > 0);
}

// 一覧・description 用の短い要約（リンク記法は文字だけにする）
export function excerpt(body, n = 90) {
  const t = String(body || "").replace(LINK, "$1").replace(/(^|\n)##\s+/g, "$1").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}
