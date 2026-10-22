// 管理画面の「表示順」（rank）が小さい人ほど上。番号の無い人はその後ろに、名簿（シート）の順で並ぶ。
export function byRank(list) {
  return list
    .map((t, i) => ({ t, i, r: Number.isFinite(t.rank) ? t.rank : Infinity }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.t);
}
