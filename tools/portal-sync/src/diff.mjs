// 「ポータルの今の出勤」と「入れる予定」を比べて、変更点の一覧を作る（通信しない）
//   current: { dates:[iso], people:[{ id, name, cells:[{ idx, date, work, start, end }] }] }
//   plan:    planEkichika の戻り値 { dates, rows:[{ name, cells:[{date, work, start, end}] }], skipped }
// 変更の種類： add（出勤を入れる）/ change（時間を変える）/ remove（出勤を取り消す＝削除系。個別に確認が必要）
export function diffShifts(current, plan) {
  const changes = [];
  const curByName = new Map(current.people.map((p) => [p.name, p]));
  for (const row of plan.rows) {
    const cur = curByName.get(row.name);
    if (!cur) continue; // ポータルに登録の無い人は planEkichika 側で「見送り」済み
    for (const want of row.cells) {
      const have = cur.cells.find((c) => c.date === want.date);
      if (!have) continue; // ポータルの表に無い日（期間外）
      const same = have.work === want.work && (!want.work || (have.start === want.start && have.end === want.end));
      if (same) continue;
      const type = !have.work && want.work ? "add" : have.work && !want.work ? "remove" : "change";
      changes.push({
        no: changes.length + 1, type, name: row.name, id: cur.id, idx: have.idx, date: want.date,
        before: have.work ? `${have.start}-${have.end}` : "出勤なし",
        after: want.work ? `${want.start}-${want.end}` : "出勤なし",
        want: { work: want.work, start: want.start, end: want.end },
      });
    }
  }
  return changes;
}

const LABEL = { add: "出勤を入れる", change: "時間を変える", remove: "出勤を取り消す（要確認）", rest: "休みにする" };

export function formatChanges(siteName, changes, skipped = []) {
  const L = [`■ ${siteName}：変更点 ${changes.length}件`];
  if (!changes.length) L.push("  変更はありません（今の登録とサイトの出勤が一致しています）");
  for (const c of changes) L.push(`  ${String(c.no).padStart(2)}. ${c.date} ${c.name}：${c.before} → ${c.after}（${LABEL[c.type]}）`);
  for (const s of skipped) L.push(`   見送り ${s.date} ${s.name}：${s.reason}`);
  return L.join("\n");
}

/**
 * 実行する変更を選ぶ。
 *   only：番号を指定したらその番号だけ（例 [1,3]）
 *   allowRemove：取り消し（remove）は、番号で個別に指定したものだけ実行する（削除系は1件ずつ確認する決まり）
 */
export function selectChanges(changes, { only = null, removeNos = [] } = {}) {
  return changes.filter((c) => {
    if (only && !only.includes(c.no)) return false;
    if (c.type === "remove") return removeNos.includes(c.no);
    return true;
  });
}
