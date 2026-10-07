import { readFile, writeFile } from "node:fs/promises";
const read = (name) => readFile(new URL("../" + name, import.meta.url), "utf8");
const write = (name, content) => writeFile(new URL("../" + name, import.meta.url), content);
const campaign = JSON.parse(await read("data/lottery-campaign.json"));
let html = await read("public/lottery-mobile.html");
function replaceOnce(before, after) {
  if (!html.includes(before)) throw new Error("URL template marker missing: " + before.slice(0, 60));
  html = html.replace(before, after);
}
replaceOnce('スマホ体験版', 'URL参加ページ');
replaceOnce('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="lottery-campaign" content="' + campaign.campaignId + '">');
replaceOnce('<b>体験版</b>実際の応募・当選にはなりません', '<b>URL抽選</b>同じブラウザーからの参加は1回');
replaceOnce('開催予定のキャンペーンです。今はゲームを体験できます。', 'URLを開いてそのまま参加できます。LINEログインは不要です。');
replaceOnce('<span class="pill">DEMO</span>', '<span class="pill">DRAW</span>');
replaceOnce('宝石の抽選ゲーム体験版', '宝石のURL抽選');
replaceOnce('宝石を選ぶと、抽選を始められます。', '参加記録と保存済みの結果を確認します。');
replaceOnce('この宝石で抽選を体験する ↗', 'この宝石で抽選する ↗');
replaceOnce('何度でも遊べます。実際の当選枠は消費しません。', '同じブラウザーでは保存した結果を表示します。');
replaceOnce('抽選演出中です。まもなく結果が表示されます。', '抽選結果を確認しています。');
replaceOnce('<b>これは体験版の結果です</b><p>無料特典の権利やクーポンは発行されません。<br>実際の当選者としては登録されません。</p>', '<b>保存された抽選結果</b><p id="draw-id"></p><p>ご予約時に受付番号をお伝えください。</p>');
replaceOnce('<button id="reset" type="button" class="primary">もう一度体験する ↻</button>', '');
replaceOnce('公式LINEを見る ↗', '当選特典の利用について問い合わせる ↗');
replaceOnce('LINEを開いても、体験結果は送信されません。', '問い合わせは任意です。抽選にはLINEログイン・友だち追加は必要ありません。');
replaceOnce('正式開催時の参加の流れ', '参加の流れ');
replaceOnce('体験版はURLを開くだけで遊べます。体験版のランダム演出は本番の当選確率とは異なります。対象コース・予約時の利用条件は、開催前にご案内します。', 'URLを開いて参加できます。参加記録をブラウザーに保存します。別の端末・ブラウザーや保存データの削除では再参加できるため、1人1回を保証する方式ではありません。特典の対象コース・利用条件は店舗へお問い合わせください。');
if (!/<details class="controls">[\s\S]*?<\/details>/.test(html)) throw new Error("Demo controls marker missing");
html = html.replace(/<details class="controls">[\s\S]*?<\/details>/, '<div class="controls"><button id="retry" type="button" class="primary" hidden>参加記録・結果を再確認</button></div>');
const client = await read("public/lottery-url.js");
html = html.replace(/  <script>[\s\S]*?<\/script>/, '  <script>' + client.replaceAll('</script', '<\\/script') + '</script>');
if (html.includes('id="outcome"') || html.includes('id="reset"') || !html.includes('google.script.run') || html.includes('liff.init')) throw new Error("URL template safety check failed");
await write("public/lottery-url.html", html);
const sharedSource = await read("apps-script/lottery.gs");
function section(start, end) {
  const a = sharedSource.indexOf(start), b = sharedSource.indexOf(end);
  if (a < 0 || b <= a) throw new Error("Shared server marker missing");
  return sharedSource.slice(a, b);
}
const shared = section('var LOTTERY_HEADERS =', 'function lotteryConfig_()') + section('function lotteryDecide_(', 'function doPost(');
const urlServer = await read("apps-script/lottery-url-server.gs");
const install = '// Generated URL-only deployment. Paste into a NEW spreadsheet-bound project.\n' +
  'var LOTTERY_URL_CAMPAIGN = ' + JSON.stringify(campaign, null, 2) + ';\n' +
  'var LOTTERY_URL_HTML = ' + JSON.stringify(html) + ';\n\n' + shared + '\n' + urlServer;
await write("apps-script/lottery-url-install.gs", install);
await write("public/lottery-url-install.gs.txt", install);
console.log('Generated URL-only page and one-file Google Apps Script deployment; no LINE credentials required.');
