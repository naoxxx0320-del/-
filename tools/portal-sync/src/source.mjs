// 入力元（今の仕組み）の読み込み。
// 出勤・セラピストは、サイトと同じ「出勤スプレッドシート」の公開CSVを、サイトと同じ変換（scripts/fetch-sheets.mjs）で読む。
// ・予約台帳・お客様情報は読まない。
import { toObjects, buildSchedule, buildRoster, withSingleHeader } from "../../../scripts/fetch-sheets.mjs";

async function fetchCsv(url) {
  const res = await fetch(withSingleHeader(url), { redirect: "follow" });
  if (!res.ok) throw new Error(`スプレッドシートを読めませんでした（HTTP ${res.status}）`);
  const text = await res.text();
  const head = text.slice(0, 300).trim().toLowerCase();
  if (head.startsWith("<!doctype") || head.startsWith("<html")) {
    throw new Error("スプレッドシートの代わりにWebページが返りました（共有設定・URLを確認してください）");
  }
  return text;
}

/** CSV の文字列から出勤・名簿を作る（テストではこちらを直接使う） */
export function buildFromCsv({ scheduleCsv, therapistsCsv }) {
  const schedule = buildSchedule(toObjects(scheduleCsv, "日付"));
  const roster = therapistsCsv ? buildRoster(toObjects(therapistsCsv, "名前")) : [];
  return { schedule, roster };
}

/** 設定ファイルの URL から読み込む */
export async function loadSource(config) {
  if (!config.scheduleCsvUrl) throw new Error("設定（config.local.json）に scheduleCsvUrl がありません");
  const scheduleCsv = await fetchCsv(config.scheduleCsvUrl);
  const therapistsCsv = config.therapistsCsvUrl ? await fetchCsv(config.therapistsCsvUrl) : "";
  return buildFromCsv({ scheduleCsv, therapistsCsv });
}

/** 名簿の照合キー（シートの「名前」）→ 表示名（サイトに出る名前） */
export function displayNameMap(roster) {
  const m = new Map();
  for (const t of roster || []) if (t && t.name) m.set(t.name, (t.nameFull || t.name).trim());
  return m;
}
