/* 記事の確認用ビルドのための一時データ（ローカル専用。コミットしない）
   使い方：node editorial/tools/sample-data.cjs → npx next build → git checkout data/roster.json data/schedule.json
   data/roster.json はCIでスプレッドシートから作るためリポジトリでは空。ビルド確認のときだけ見本の名簿を入れる。 */
const fs = require("fs");
const { execSync } = require("child_process");
const r = JSON.parse(execSync("git show 3f9fce8:data/roster.json", { encoding: "utf8", maxBuffer: 1 << 24 }));
const a = { ...r[0], id: 2, name: "花恋", isNew: true };
const b = { ...r[0], id: 3, name: "ももこ", nameFull: "ももこ", isNew: true, photo: "", stats: ["T.155", "B.E"] };
const c = { ...r[0], id: 4, name: "りん", nameFull: "りん", isNew: true, photo: "" };
fs.writeFileSync("data/roster.json", JSON.stringify([a, b, c], null, 1));
const now = new Date(Date.now() + 9 * 3600e3 - 6 * 3600e3);
const d = now.getUTCFullYear() + "/" + (now.getUTCMonth() + 1) + "/" + now.getUTCDate();
fs.writeFileSync("data/schedule.json", JSON.stringify({ area: "亀戸", today: d, updated: "12:00", days: [{ date: d, label: "今日", list: [
  { name: "ももこ", time: "14:00〜翌2:00", status: "空きあり", guideTime: "14:00" },
  { name: "花恋", time: "18:00〜翌3:00", status: "残りわずか", guideTime: "18:00" } ] }] }));
console.log("sample data for", d);
