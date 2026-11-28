// 週1の効果レポート：読み取った画面の文字や記録から数字を取り出す（通信しない）

/** エステ魂「ランキングデータ」の画面の文字から、お店の順位（見つからなければ null） */
export function estamaRank(text, shopName = "アロマダイヤモンド") {
  // 画面の上のお店の名前（順位の前）は飛ばし、順位の一覧の中（番号のあと・次の行がエリア名）だけを見る
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  let last = null;
  for (let i = 0; i < lines.length; i++) {
    if (/^\d{1,3}$/.test(lines[i])) last = Number(lines[i]);
    else if (lines[i] === shopName && last != null && /・|駅|エリア/.test(lines[i + 1] || "")) return last;
  }
  return null;
}

/** エステ魂「アクセス状況」の表の行（["11月27日","金","","243","67"]）→ { "2026-11-27": 243 } */
export function estamaAccess(rows, year) {
  const out = {};
  for (const r of rows || []) {
    const m = String(r[0] || "").match(/(\d{1,2})月(\d{1,2})日/);
    const n = Number(String(r.find((c, i) => i > 0 && /^\d[\d,]*$/.test(String(c).trim())) || "").replace(/,/g, ""));
    if (m && Number.isFinite(n)) out[`${year}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`] = n;
  }
  return out;
}

/** 駅ちか「アクセス数」の表：「アクセス 総数」の行の、最後の日数分の値（1日〜月末）→ { "2026-11-01": 3, … }（"-" は入れない） */
export function ekichikaAccess(rows, ym) {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const row = (rows || []).find((r) => r.some((c) => /^アクセス$/.test(String(c).trim())) && r.some((c) => /総数/.test(String(c))));
  if (!row) return {};
  const vals = row.slice(-days);
  const out = {};
  vals.forEach((v, i) => { const n = Number(String(v).trim()); if (String(v).trim() !== "-" && Number.isFinite(n)) out[`${ym}-${String(i + 1).padStart(2, "0")}`] = n; });
  return out;
}

/** 駅ちか「アクセス数」の画面の文字から：「アクセス」「総数」「日平均」のあとに 今月・前月・増減・合計、続いて1日〜月末の値 */
export function ekichikaAccessText(text, ym) {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const L = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const i = L.findIndex((l, k) => l === "アクセス" && L[k + 1] === "総数");
  if (i < 0) return {};
  let j = i + 2;
  if (L[j] === "日平均") j++;
  const vals = L.slice(j + 4, j + 4 + days);
  const out = {};
  vals.forEach((v, k) => { const n = Number(v); if (v !== "-" && Number.isFinite(n)) out[`${ym}-${String(k + 1).padStart(2, "0")}`] = n; });
  return out;
}

/** リラクシィ「所属一覧」の文字から、@ID ごとのフォロワー数 */
export function rxFollowers(text) {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const out = {};
  let cur = null;
  for (const l of lines) {
    const h = l.match(/^@([\w.]+)$/);
    if (h) { cur = h[1]; continue; }
    const f = l.match(/^([\d,]+)\s*フォロワー$/);
    if (f && cur && !(cur in out)) { out[cur] = Number(f[1].replace(/,/g, "")); cur = null; }
  }
  return out;
}

/** 記録（"2026-11-28T03:10:49.430Z 本文"）のうち、日本時間の from〜to（"YYYY-MM-DD"、両端を含む）で、pattern に合う行の数 */
export function countLog(text, pattern, from, to) {
  let n = 0;
  for (const l of String(text || "").split("\n")) {
    const t = Date.parse(l.slice(0, 24));
    if (!Number.isFinite(t)) continue;
    const d = new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
    if (d >= from && d <= to && pattern.test(l)) n++;
  }
  return n;
}

/** 先週の月曜〜日曜（日本時間）。now が月曜なら、その前の週 */
export function lastWeek(nowMs = Date.now()) {
  const j = new Date(nowMs + 9 * 3600e3);
  const dow = (j.getUTCDay() + 6) % 7; // 月=0
  const mon = new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate() - dow - 7));
  return [...Array(7)].map((_, i) => new Date(mon.getTime() + i * 86400e3).toISOString().slice(0, 10));
}
