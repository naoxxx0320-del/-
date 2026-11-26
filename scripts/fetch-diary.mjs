#!/usr/bin/env node
/**
 * セラピストの写メ日記を 02（ゼロツー、メンズエステ専門SNS）から取り込み、data/diary.json を作る。
 *  - 取得元：お店のページが使っている公開の一覧 https://m-sns.net/api/shop-timeline.php?shop_id=<店舗ID>
 *    （ログイン不要。サイトのビルドごと＝約15分に1回だけ読む）
 *  - オーナーが 02 運営に電話で問い合わせ、了承済み（2026-11-26）。セラピスト全員の転載の了承も済み。
 *  - 使うのは「セラピストの公開投稿」だけ（お店の投稿・限定公開は使わない）。30日より古いものは出さない（02 側も30日で自動削除）。
 *  - セラピストの照合：02 の名前（絵文字を除く）が在籍表の表示名・名前と一致する人。data/diary-config.json の accounts で明示もできる。
 *    在籍表にいない人の投稿は使わない（ログに出す）。
 *  - 取得に失敗したときは、直前の data/diary.json をそのまま残す（公開は止めない）。
 *  - 画像は 02 の配信元の URL をそのまま使う（こちらに保存しない）。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
export const MAX_PER_PERSON = 10;
export const MAX_AGE_DAYS = 30;

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
/** 02 の本文（<br /> 入りの HTML）→ 改行つきの文字。タグはすべて外す */
export function toPlainText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => {
      if (ENT[e] != null) return ENT[e];
      if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (/^#\d/.test(e)) return String.fromCodePoint(parseInt(e.slice(1), 10));
      return m;
    })
    .replace(/\r/g, "")
    .split("\n").map((l) => l.trimEnd()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 名前の比較用：絵文字・記号・空白を外す */
export function bareName(s) {
  return String(s || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s💎♡]/gu, "").trim();
}

/** 02 のユーザー名 → 在籍表の name（schedule・予約の照合に使う名前）。見つからなければ null */
export function matchTherapist(post, roster, accounts = {}) {
  if (post.username && accounts[post.username]) {
    const want = accounts[post.username];
    const t = roster.find((r) => r.name === want || r.nameFull === want);
    return t ? t.name : null;
  }
  const n = bareName(post.author_name || post.name);
  if (!n) return null;
  const t = roster.find((r) => bareName(r.nameFull) === n) || roster.find((r) => bareName(r.name) === n);
  return t ? t.name : null;
}

/** 公開の httpsの画像URLだけ */
function cleanImages(post) {
  const list = Array.isArray(post.images) && post.images.length ? post.images : [post.image1, post.image2, post.image3];
  return list.filter((u) => typeof u === "string" && /^https:\/\/[a-z0-9.-]+\.(m-sns\.net|cloudfront\.net)\//i.test(u)).slice(0, 3);
}

/** "2026-11-25 20:31:32"（日本時間）→ ミリ秒 */
function jstMs(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5], +(m[6] || 0));
}

/**
 * 02 の一覧 → { [在籍表の name]: [{ id, at, text, images, url }] }
 * skipped には照合できなかった投稿者（ログ用）を入れる
 */
export function buildDiary(api, roster, { accounts = {}, nowMs = Date.now() } = {}) {
  const out = {};
  const skipped = new Set();
  const posts = (api && Array.isArray(api.posts) ? api.posts : [])
    .filter((p) => p && p.post_type === "cast" && p.visibility === "public" && p.can_view_full !== false && !p.video_path);
  for (const p of posts) {
    const ms = jstMs(p.published_at || p.created_at);
    if (!Number.isFinite(ms) || nowMs - ms > MAX_AGE_DAYS * 86400e3 || ms - nowMs > 3600e3) continue;
    const name = matchTherapist(p, roster, accounts);
    if (!name) { skipped.add(bareName(p.author_name || p.name) || p.username || "?"); continue; }
    const text = toPlainText(p.content);
    const images = cleanImages(p);
    if (!text && !images.length) continue;
    (out[name] ||= []).push({
      id: String(p.id),
      at: String(p.published_at || p.created_at).slice(0, 16),
      text,
      images,
      url: p.username && /^[\w.-]+$/.test(p.username) ? `https://m-sns.net/profile/@${p.username}` : "",
    });
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    out[k] = out[k].slice(0, MAX_PER_PERSON);
  }
  return { posts: out, skipped: [...skipped] };
}

function readJSON(name, fallback) {
  const p = join(DATA, name);
  if (!existsSync(p)) return fallback;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
}

async function run() {
  const conf = readJSON("diary-config.json", {});
  if (!conf.shopId) { console.log("skip diary.json: diary-config.json の shopId が未設定（既存データを保持）"); return; }
  const roster = readJSON("roster.json", []);
  const url = `https://m-sns.net/api/shop-timeline.php?shop_id=${encodeURIComponent(conf.shopId)}&limit=50`;
  let api;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (site build)", Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    api = await res.json();
    if (!api || api.success !== true || !Array.isArray(api.posts)) throw new Error("想定と違う形の応答");
  } catch (e) {
    console.error(`skip diary.json: 02 から取得できませんでした（${e.message}）。既存データを保持`);
    return;
  }
  const { posts, skipped } = buildDiary(api, roster, { accounts: conf.accounts || {} });
  const next = { source: "02", posts };
  const prev = readJSON("diary.json", null);
  if (prev && JSON.stringify({ source: prev.source, posts: prev.posts }) === JSON.stringify(next)) {
    console.log("diary.json: 変更なし");
  } else {
    writeFileSync(join(DATA, "diary.json"), JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2) + "\n");
    console.log(`diary.json: ${Object.entries(posts).map(([k, v]) => `${k} ${v.length}件`).join("・") || "0件"}`);
  }
  if (skipped.length) console.log(`在籍表にいない投稿者のため使わなかった：${skipped.join("・")}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((e) => { console.error("diary.json: " + e.message); });
}
