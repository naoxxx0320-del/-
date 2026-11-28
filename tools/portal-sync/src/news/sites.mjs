// 各サイトのニュース投稿（Playwright）。投稿後は一覧を読み直して、題名が載ったことを確かめる。
// 守ること：決まった確認画面だけ承認する／欄が見つからなければ止める／隠し項目の値は読まない／
//           上位表示・有料の項目は触らない（ここで行うのはニュースの投稿・記事の更新だけ）
const pause = (page, ms) => page.waitForTimeout(ms + Math.floor(Math.random() * 500));

/** 決まった文言の確認画面だけ承認し、それ以外は断って記録する */
function withDialogs(page, okRe) {
  const seen = [];
  const h = async (d) => {
    seen.push(d.message());
    try { if (okRe.test(d.message())) await d.accept(); else await d.dismiss(); } catch { seen.push("（確認画面に答えられませんでした）"); }
  };
  page.on("dialog", h);
  return { seen, done: () => page.off("dialog", h), unexpected: () => seen.filter((m) => !okRe.test(m)) };
}
async function one(loc, what) {
  if ((await loc.count()) !== 1) throw new Error(`${what}が見つかりません。投稿せずに止めました`);
  return loc;
}
/** 見た目を変えたラジオボタン：ラベルを押す。ラベルがなければ値を入れて change を送る。選ばれたことを確かめる */
async function choose(loc, what) {
  if ((await loc.count()) !== 1) throw new Error(`${what}が見つかりません。投稿せずに止めました`);
  if (await loc.isChecked()) return;
  const lbl = loc.locator("xpath=ancestor::label[1]");
  if (await lbl.count()) await lbl.click();
  else {
    const id = await loc.getAttribute("id");
    const forLbl = id ? loc.page().locator(`label[for="${id}"]`) : null;
    if (forLbl && (await forLbl.count())) await forLbl.first().click();
    else await loc.evaluate((el) => { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("click", { bubbles: true })); });
  }
  if (!(await loc.isChecked())) throw new Error(`${what}を選べません。投稿せずに止めました`);
}
/** 写真の添付：失敗しても投稿は続ける（理由を meta.image に記録し、ログに出す） */
async function attach(meta, fn) {
  if (!meta || !meta.photo || !meta.photo.file) return;
  try { const why = await fn(meta.photo); meta.image = why ? `写真なし（${why}）` : `写真：${meta.photo.name}`; }
  catch (e) { meta.image = `写真なし（${e.message.split("\n")[0].slice(0, 80)}）`; }
}
const titleKey = (t) => String(t).replace(/\s+/g, "").slice(0, 20);
async function listHas(page, url, title) {
  await page.goto(url, { waitUntil: "domcontentloaded" }); await pause(page, 1800);
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, "");
  return text.includes(titleKey(title));
}

// ---- エステ魂：/admin/news_edit/ → 「投稿する」（.send-post、画面の外で reCAPTCHA v3） ----
const ESTAMA_TYPE = { vacancy: "4", shift: "4", offer: "2", coupon: "2", appeal: "0", forward: "0" };
async function estamaImage(page, file) {
  const inp = page.locator("#news_icon_1-imgupload_imgUploadField");
  if ((await inp.count()) !== 1) return "画像欄が見つかりません";
  const up = page.waitForResponse((r) => r.url().includes("/post/uptemp/"), { timeout: 30000 }).catch(() => null);
  await inp.setInputFiles(file);
  if (!(await up)) return "画像のアップロードの応答がありません";
  await pause(page, 1500);
  const crop = page.locator(".cropControlCrop:visible");
  if (!(await crop.count())) return "切り抜きのボタンが見つかりません";
  const cr = page.waitForResponse((r) => r.url().includes("/post/cropping/"), { timeout: 30000 }).catch(() => null);
  await crop.first().click();
  if (!(await cr)) return "切り抜きの応答がありません";
  await pause(page, 1500);
  return (await page.locator("img[src*='cropped_img']").count()) ? null : "切り抜いた画像がフォームに入りません";
}
async function postEstama(page, post, meta = {}) {
  await page.goto("https://estama.jp/admin/news_edit/", { waitUntil: "load" }); await pause(page, 2500);
  if (/login/.test(page.url())) throw new Error("エステ魂にログインしていません");
  await (await one(page.locator("input[name='main[title]']"), "題名の欄")).fill(post.title); await pause(page, 300);
  await (await one(page.locator("textarea[name='main[content]']"), "本文の欄")).fill(post.body); await pause(page, 300);
  await attach(meta, (ph) => estamaImage(page, ph.square || ph.file));
  const type = page.locator(`input[type=radio][name='main[news_type]'][value='${ESTAMA_TYPE[post.type] || "0"}']`);
  if (await type.count()) await type.check({ force: true });
  const now = page.locator("input[type=radio][name='future[post]'][value='0']");
  if (await now.count()) await now.check({ force: true });
  const btn = await one(page.locator("a.send-post[data-post='news_edit']"), "「投稿する」");
  const res = page.waitForResponse((r) => r.url().includes("/admin_post/news_edit"), { timeout: 30000 }).catch(() => null);
  await btn.click();
  const r = await res;
  await pause(page, 3000);
  const err = await page.evaluate(() => [...document.querySelectorAll(".vali_error, .all_vali li")].map((e) => e.textContent.trim()).filter(Boolean).join(" / "));
  if (err) throw new Error(`エステ魂が受け付けませんでした：${err}`);
  if (!r) throw new Error("エステ魂の投稿の応答がありませんでした（ロボット判定で止まった可能性）。画面で確認してください");
  return listHas(page, "https://estama.jp/admin/news/", post.title);
}

// ---- 駅ちか：「駅ちかを見た」の記事（カテゴリごとに1件）を書き換える＝上位表示（残り回数を消費） ----
// 駅ちかは記事がカテゴリごとに1件（書き換え）。オーナーが作った記事（速報NEWS・新人速報・激アツ割引情報）は上書きしないよう、
// ツールは空いていた2つ（緊急出勤速報＝出勤案内、イベント速報＝それ以外）だけを使う
const EK_CAT = { vacancy: 5, shift: 5, offer: 4, coupon: 4, appeal: 4, forward: 4 };
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (text) => text.split("\n\n").map((p) => `<p>${esc(p).replace(/\n/g, "<br />")}</p>`).join("\n");
export async function ekichikaRemaining(page) {
  await page.goto("https://ranking-deli.jp/admin/articles/", { waitUntil: "domcontentloaded" }); await pause(page, 1500);
  if (/login/.test(page.url())) throw new Error("駅ちかにログインしていません");
  const n = await page.evaluate(() => { const e = document.querySelector(".remaining_disp_num"); return e ? Number(e.textContent.trim()) : NaN; });
  return Number.isFinite(n) ? n : null;
}
async function postEkichika(page, post, meta = {}) {
  const cat = EK_CAT[post.type] || 4;
  const url = `https://ranking-deli.jp/admin/articles/category${cat}/`;
  await page.goto(url, { waitUntil: "domcontentloaded" }); await pause(page, 2000);
  if (/login/.test(page.url())) throw new Error("駅ちかにログインしていません");
  const form = page.locator("form#article_form");
  await one(form, "記事の入力欄");
  await (await one(form.locator("input[name=title]"), "記事タイトルの欄")).fill(post.title); await pause(page, 300);
  // 本文は文字装飾の入力欄（CKEditor）。エディタ経由で入れ、元の欄にも反映させる
  await one(form.locator("textarea[name=body]"), "記事本文の欄");
  const set = await page.evaluate((html) => {
    const C = window.CKEDITOR;
    const inst = C && Object.values(C.instances).find((i) => i.element && i.element.$ && i.element.$.name === "body");
    if (!inst) return false;
    inst.setData(html); inst.updateElement();
    return true;
  }, toHtml(post.body));
  if (!set) throw new Error("記事本文の入力欄（エディタ）が見つかりません。投稿せずに止めました");
  await pause(page, 800);
  // 画像：「○○さんの画像を使用する」（駅ちかに登録済みの1枚目）で、本日出勤の人を選ぶ（紹介のときは本人）
  await attach(meta, async (ph) => {
    const sel = form.locator("select[name=girl_id]");
    if ((await sel.count()) !== 1) return "女の子の画像を選ぶ欄が見つかりません";
    const labels = await sel.evaluate((el) => [...el.options].map((o) => o.textContent.trim()));
    const label = labels.find((l) => l === ph.name);
    if (!label) return `${ph.name}さんが一覧にいません`;
    const flg = form.locator("input[type=radio][name=img_flg][value='1']");
    if (await flg.count()) await flg.check();
    await sel.selectOption({ label });
    return null;
  });
  const show = form.locator("input[type=radio][name=display_flg][value='1']");
  if (await show.count()) await show.check();
  const dlg = withDialogs(page, /登録|更新|よろしい/);
  try {
    await Promise.all([page.waitForLoadState("domcontentloaded"), (await one(form.locator("input[name=post_edit_data]"), "「入力内容を登録する」")).click()]);
    await pause(page, 2500);
  } finally { dlg.done(); }
  if (dlg.unexpected().length) throw new Error(`想定外の確認画面：${dlg.unexpected().join(" / ")}`);
  return listHas(page, "https://ranking-deli.jp/admin/articles/", post.title);
}

// ---- エステ番長：新着情報 /node/add/shop_news ----
const EB_CAT = { vacancy: "4", shift: "4", offer: "3", coupon: "3", appeal: "2", forward: "2" };
async function postEsban(page, post, meta = {}) {
  await page.goto("https://es-ban.com/node/add/shop_news", { waitUntil: "load" }); await pause(page, 2000);
  if (/\/user\/login/.test(page.url())) throw new Error("エステ番長にログインしていません");
  const form = page.locator("form").filter({ has: page.locator("input[name='title[0][value]']") });
  await one(form, "新着情報の入力欄");
  await (await one(form.locator("input[name='title[0][value]']"), "タイトルの欄")).fill(post.title); await pause(page, 300);
  const cat = post.type === "appeal" && post.isNew ? "1" : EB_CAT[post.type] || "2";
  await (await one(form.locator("select[name=field_shop_news_category]"), "カテゴリの欄")).selectOption(cat);
  await (await one(form.locator("textarea[name='field_shop_news_body[0][value]']"), "内容の欄")).fill(post.body); await pause(page, 300);
  await attach(meta, async (ph) => {
    const inp = form.locator("input[name='files[field_shop_news_img_0]']");
    if ((await inp.count()) !== 1) return "画像欄が見つかりません";
    await inp.setInputFiles(ph.file);
    const fid = page.locator("input[type=hidden][name='field_shop_news_img[0][fids]']");
    for (let i = 0; i < 20; i++) { await pause(page, 1000); if ((await fid.count()) && (await fid.inputValue())) return null; }
    return "画像のアップロードが終わりません";
  });
  const st = form.locator("input[name='status[value]']");
  if ((await st.count()) && !(await st.isChecked())) await st.check();
  await Promise.all([page.waitForLoadState("domcontentloaded"), (await one(form.locator("input[type=submit][name=op][value='保存']"), "保存ボタン")).click()]);
  await pause(page, 2500);
  const err = await page.evaluate(() => [...document.querySelectorAll(".messages--error, [role=alert]")].map((e) => e.textContent.replace(/\s+/g, " ").trim()).join(" / "));
  if (err) throw new Error(`エステ番長が受け付けませんでした：${err}`);
  return listHas(page, "https://es-ban.com/admin/content_manage/u_shop_news", post.title);
}

// ---- エステラブ：新着情報 /admin/shop/shopfeed/edit（「更新または上位化する」＝更新回数を消費） ----
const EL_CAT = { vacancy: "3", shift: "3", offer: "2", coupon: "2", appeal: "4", forward: "4" };
export async function esloveRemaining(page) {
  await page.goto("https://eslove.jp/admin/shop/shopfeed", { waitUntil: "domcontentloaded" }); await pause(page, 1500);
  if (/\/admin\/login/.test(page.url())) throw new Error("エステラブにログインしていません");
  const t = await page.evaluate(() => document.body.innerText);
  const m = t.match(/新着情報\s*残\s*(\d+)\s*回/);
  return m ? Number(m[1]) : null;
}
// ツールが作った投稿の題名（この形の題名か、ツールが記録した題名だけを書き換える。オーナーの投稿は書き換えない）
const OURS = /^【(本日の出勤|本日出勤|本日の空き|本日|新規割|新人割|早割|平日昼割|クーポン)】/;
/** 新着情報は最大5件。新規の画面が開けない（一覧に戻される）ときは、ツールが作った投稿のうち最も古いものを書き換える */
async function esloveEditTarget(page, ownTitles = []) {
  await page.goto("https://eslove.jp/admin/shop/shopfeed", { waitUntil: "load" }); await pause(page, 2000);
  const rows = await page.evaluate(() => {
    const m = new Map();
    for (const a of document.querySelectorAll("a[href*='/admin/shop/shopfeed/edit/']")) {
      const id = (a.getAttribute("href").match(/edit\/(\d+)/) || [])[1];
      if (!id || m.has(id)) continue;
      const row = a.closest("tr, li, .card, .item, article") || a.parentElement;
      const text = row.textContent.replace(/\s+/g, " ").trim();
      const at = (text.match(/更新日時：(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2})/) || [])[1] || "";
      const title = text.replace(/^edit\s*/, "").split(" カテゴリ：")[0].trim();
      m.set(id, { id, title, at });
    }
    return [...m.values()];
  });
  const mine = rows.filter((r) => OURS.test(r.title) || ownTitles.includes(r.title)).sort((a, b) => (a.at < b.at ? -1 : 1));
  if (!mine.length) throw new Error("エステラブの新着情報が上限（5件）で、ツールが書き換えてよい投稿がありません。投稿せずに止めました");
  return mine[0];
}
async function postEslove(page, post, meta = {}) {
  await page.goto("https://eslove.jp/admin/shop/shopfeed/edit", { waitUntil: "load" }); await pause(page, 2500);
  if (/\/admin\/login/.test(page.url())) throw new Error("エステラブにログインしていません");
  let form = page.locator("form").filter({ has: page.locator("input[name=title]") }).filter({ has: page.locator("textarea[name=body]") });
  if (!(await form.count()) && /\/admin\/shop\/shopfeed\/?$/.test(new URL(page.url()).pathname)) {
    const t = await esloveEditTarget(page, meta.ownTitles || []);
    await page.goto(`https://eslove.jp/admin/shop/shopfeed/edit/${t.id}`, { waitUntil: "load" }); await pause(page, 2500);
    form = page.locator("form").filter({ has: page.locator("input[name=title]") }).filter({ has: page.locator("textarea[name=body]") });
    const cur = await form.locator("input[name=title]").inputValue().catch(() => "");
    if (cur !== t.title) throw new Error(`書き換える投稿の題名が一覧と違います（${cur}）。投稿せずに止めました`);
  }
  await one(form, "新着情報の入力欄");
  await choose(form.locator("input[type=radio][name=status][value='1']"), "「表示」");
  await choose(form.locator(`input[type=radio][name=category][value='${EL_CAT[post.type] || "1"}']`), "カテゴリ");
  await (await one(form.locator("input[name=title]"), "タイトルの欄")).fill(post.title); await pause(page, 300);
  await (await one(form.locator("textarea[name=body]"), "内容の欄")).fill(post.body); await pause(page, 300);
  await attach(meta, async (ph) => {
    const inp = page.locator("input.fileUpload__fileHandler");
    if ((await inp.count()) !== 1) return "画像欄が見つかりません";
    await inp.setInputFiles(ph.wide || ph.file);
    for (let i = 0; i < 15; i++) { await pause(page, 1000); if (await page.locator(".fileUpload img[src^='data:image'], img.img-responsive[src^='data:image']").count()) return null; }
    return "画像の読み込みが終わりません";
  });
  const dlg = withDialogs(page, /更新回数を消費します/);
  try {
    const btn = page.locator("button.js-update", { hasText: "更新または上位化する" }).first();
    if (!(await btn.count())) throw new Error("「更新または上位化する」が見つかりません。投稿せずに止めました");
    await btn.click();
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await pause(page, 3500);
  } finally { dlg.done(); }
  if (dlg.unexpected().length) throw new Error(`想定外の確認画面：${dlg.unexpected().join(" / ")}`);
  const err = await page.evaluate(() => [...document.querySelectorAll(".error p, .invalid-feedback")].map((e) => e.textContent.trim()).filter(Boolean).join(" / "));
  if (err) throw new Error(`エステラブが受け付けませんでした：${err}`);
  return listHas(page, "https://eslove.jp/admin/shop/shopfeed", post.title);
}

// ---- 全国メンズエステランキング：/shop/news/add/（1日5回、6時にリセット） ----
const ER_TYPE = { vacancy: "3", shift: "3", offer: "1", coupon: "1", appeal: "9", forward: "9" };
export async function rankingRemaining(page) {
  await page.goto("https://www.esthe-ranking.jp/shop/news/", { waitUntil: "domcontentloaded" }); await pause(page, 1500);
  if (/\/login/.test(page.url())) throw new Error("全国メンズエステランキングにログインしていません");
  const m = (await page.evaluate(() => document.body.innerText)).match(/あと\s*(\d+)\s*回投稿できます/);
  return m ? Number(m[1]) : 0;
}
async function postRanking(page, post, meta = {}) {
  await page.goto("https://www.esthe-ranking.jp/shop/news/add/", { waitUntil: "load" }); await pause(page, 2000);
  if (/\/login/.test(page.url())) throw new Error("全国メンズエステランキングにログインしていません");
  const form = page.locator("form[action='/shop/news/add/']");
  await one(form, "ニュースの入力欄");
  const type = post.type === "appeal" && post.isNew ? "4" : ER_TYPE[post.type] || "9";
  await (await one(form.locator("select[name=type]"), "種類の欄")).selectOption(type);
  const now = form.locator("input[type=radio][name=publish_now][value='1']");
  if (await now.count()) await now.check();
  await (await one(form.locator("input[name=title]"), "題名の欄")).fill(post.title); await pause(page, 300);
  await (await one(form.locator("textarea[name=content]"), "本文の欄")).fill(post.body); await pause(page, 300);
  await attach(meta, async (ph) => {
    const inp = form.locator("input[type=file][name=image]");
    if ((await inp.count()) !== 1) return "画像欄が見つかりません";
    await inp.setInputFiles(ph.file);
    return (await inp.evaluate((e) => e.files.length)) === 1 ? null : "画像を選べません";
  });
  const before = await page.evaluate(() => location.href);
  // 「送信」を押すと確認画面（confirm）が出る。送信・投稿の確認だけ承認する
  const dlg = withDialogs(page, /送信|投稿|公開|よろしい/);
  try {
    await (await one(form.locator("button.button-confirm-submit"), "「送信」")).click();
    await pause(page, 1500);
    // 確認が小窓（ページ内）で出る場合は、その中の送信を押す
    const confirm = page.locator(".modal.show button, .modal.in button, .modal[style*='display: block'] button").filter({ hasText: /送信|投稿|はい|OK/ });
    if (await confirm.count()) await confirm.first().click();
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await pause(page, 3000);
  } finally { dlg.done(); }
  if (dlg.unexpected().length) throw new Error(`想定外の確認画面：${dlg.unexpected().join(" / ")}`);
  if (!dlg.seen.length && page.url() === before) {
    const err = await page.evaluate(() => [...document.querySelectorAll(".alert-danger, .error, .errorlist, .invalid-feedback, .text-danger")].map((e) => e.textContent.trim()).filter(Boolean).join(" / "));
    if (err) throw new Error(`全国メンズエステランキングが受け付けませんでした：${err}`);
  }
  return listHas(page, "https://www.esthe-ranking.jp/shop/news/", post.title);
}

export const POSTERS = { estama: postEstama, ekichika: postEkichika, esban: postEsban, eslove: postEslove, "esthe-ranking": postRanking };
export const LIMITS = { estama: { title: 30, body: 900 }, ekichika: { title: 50, body: 900 }, esban: { title: 60, body: 900 }, eslove: { title: 40, body: 900 }, "esthe-ranking": { title: 50, body: 1000 } };

// ---- 読み取り（書き込まない） ----
/** エステ魂のニュース一覧（id・題名）。本文は編集画面の欄から読む（保存はしない） */
export async function readEstamaNews(page, { withBody = [] } = {}) {
  await page.goto("https://estama.jp/admin/news/", { waitUntil: "domcontentloaded" }); await pause(page, 2000);
  if (/login/.test(page.url())) throw new Error("エステ魂にログインしていません");
  const items = await page.evaluate(() => {
    const m = new Map();
    for (const a of document.querySelectorAll("a[href*='/admin/news_edit/']")) {
      const id = (a.href.match(/news_edit\/(\d+)\//) || [])[1];
      const t = a.textContent.replace(/\s+/g, " ").trim();
      if (id && t && t !== "編集" && !m.has(id)) m.set(id, t);
    }
    return [...m.entries()].map(([id, title]) => ({ id, title }));
  });
  for (const it of items) {
    if (!withBody.includes(it.id)) continue;
    await page.goto(`https://estama.jp/admin/news_edit/${it.id}/`, { waitUntil: "domcontentloaded" }); await pause(page, 1500);
    it.body = await page.evaluate(() => (document.querySelector("textarea[name='main[content]']") || {}).value || "");
  }
  return items;
}

/** 全国メンズエステランキングの公開中のクーポン（名前と、対象・割引・条件の行） */
export async function readRankingCoupons(page) {
  await page.goto("https://www.esthe-ranking.jp/shop/coupon/", { waitUntil: "domcontentloaded" }); await pause(page, 1500);
  if (/\/login/.test(page.url())) return [];
  const t = await page.evaluate(() => document.body.innerText);
  const sec = t.split("公開しているクーポン")[1] || "";
  const names = await page.evaluate(() => [...document.querySelectorAll("table tr")].map((tr) => [...tr.cells].map((c) => c.textContent.replace(/\s+/g, " ").trim())).filter((c) => c.length >= 3 && c[2] === "公開").map((c) => c[1]));
  return names.map((name) => {
    const i = sec.indexOf(name);
    const chunk = i >= 0 ? sec.slice(i + name.length, i + name.length + 400) : "";
    const lines = chunk.split("\n").map((s) => s.trim()).filter((s) => /^対象コース|円OFF|^クーポン適用条件|^有効期限/.test(s)).slice(0, 4);
    return { title: name, detail: lines.join("\n") };
  });
}
