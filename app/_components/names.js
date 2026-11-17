/* セラピストの名前の扱い（全ページ共通）。
   - name     … 照合キー（出勤表・予約・精算をつなぐ目印。管理画面の「名前」）。予約URLの ?t= もこれ。
   - nameFull … 表示名（管理画面の「表示名」）。お客様に見せる名前は必ずこちらを優先する。
   管理画面で表示名だけを変えた人（例：名前「つばさ」→表示名「ひなた」）でも、
   写真の alt・予約画面・確認画面・通知などで名前が食い違わないよう、表示は displayName() に統一する。 */
export function displayName(t) {
  if (!t) return "";
  return String(t.nameFull || t.name || "").trim();
}

/* 予約URLの ?t= を照合キーに解決する。
   照合キー（従来のリンク）と表示名（ひなた 等）のどちらでも同じ人になる。見つからなければ ""。 */
export function resolveTherapistKey(param, roster) {
  const q = String(param || "").trim();
  if (!q) return "";
  const list = Array.isArray(roster) ? roster : [];
  const byKey = list.find((t) => t && String(t.name || "").trim() === q);
  if (byKey) return byKey.name;
  const byDisplay = list.filter((t) => t && String(t.nameFull || "").trim() === q);
  return byDisplay.length === 1 ? byDisplay[0].name : ""; // 同じ表示名が複数なら決めない
}
