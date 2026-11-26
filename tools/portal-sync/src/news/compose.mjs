// ニュースの文面を作る（通信しない・推測で書かない）。
// 元にするのは、出勤（シート）・在籍情報（シート）・割引（data/offers.json）・各サイトに登録済みのクーポン・
// エステ魂にお店が書いたニュース・02 の写メ日記の更新だけ。
// 守ること：性的なサービスを思わせる表現・体の強調はしない／他の媒体名・順位は書かない（エステラブの規約）／URL は書かない。

export const TYPES = ["shift", "offer", "appeal", "coupon"]; // 順番に回す（エステ魂の新しいニュースがあれば最優先で転載）

const WD = ["日", "月", "火", "水", "木", "金", "土"];
export function dayLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}(${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}
/** 分 → "15:00"・"翌2:00" */
export function timeLabel(min) {
  const h = Math.floor(min / 60), m = String(min % 60).padStart(2, "0");
  return h >= 24 ? `翌${h - 24}:${m}` : `${h}:${m}`;
}

/** 絵文字・装飾記号を外し、空行を整える */
export function plain(s) {
  return String(s || "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}♡♪]/gu, "")
    .split("\n").map((l) => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

// 体の強調・性的な連想につながる語を含む文は、紹介文から外す（文単位）
const BODY_WORDS = /グラマ|曲線|バスト|胸|色気|セクシー|官能|密着|ドキッ|反則|艶め|魅惑|妖艶|エロ|過激|ギリギリ|際ど/;
// どのサイトにも出さない語（風俗を思わせる表現・誇大な表現）
const NG_WORDS = /回春|性感|鼠径|ディープ|ハンド|抜き|手コキ|業界一位|業界No|ナンバーワン|No\.?1|NO\.?1|日本一|最高級/i;
// エステラブに出さない語（他媒体名・順位）
const OTHER_MEDIA = /エステ魂|駅ちか|エステラブ|エステ番長|メンズエステランキング|ランキング|\d+位|1位|一位|上位/;

/** 文に分け、体の強調を含む文を外す */
export function softenProfile(text, max = 260) {
  const sents = plain(text).replace(/\n+/g, "\n").split(/(?<=[。！？\n])/).map((s) => s.trim()).filter(Boolean);
  let out = "";
  for (const s of sents) {
    if (BODY_WORDS.test(s) || NG_WORDS.test(s)) continue;
    if ([...(out + s)].length > max) break;
    out += s + (/[。！？]$/.test(s) ? "" : "\n");
  }
  return out.replace(/\n{2,}/g, "\n").trim();
}

/** 投稿してよいか（サイトごとの決まり） */
export function allowedFor(site, post) {
  const all = `${post.title}\n${post.body}`;
  if (NG_WORDS.test(all)) return { ok: false, reason: "使わない表現を含む" };
  if (site === "eslove" && OTHER_MEDIA.test(all)) return { ok: false, reason: "他の媒体名・順位を含む（エステラブの規約）" };
  if (/https?:\/\//.test(all)) return { ok: false, reason: "URLを含む" };
  return { ok: true };
}

/** 文字数の上限に合わせる（題名は文字で切る、本文は行の区切りで切る） */
export function fitPost(post, { title = 40, body = 900 } = {}) {
  const t = [...post.title].length > title ? [...post.title].slice(0, title - 1).join("") + "…" : post.title;
  let b = post.body;
  if ([...b].length > body) {
    const lines = b.split("\n"); let o = "";
    for (const l of lines) { if ([...(o + l + "\n")].length > body) break; o += l + "\n"; }
    b = o.trim();
  }
  return { ...post, title: t, body: b };
}

const CLOSING = "ご予約・お問い合わせを心よりお待ちしております。";

/**
 * 本日の出勤案内
 *   shifts: [{ name(表示名), start, end(分) }] の今日の分、diaryNames: 直近24時間に写メ日記を更新した人の表示名
 */
export function shiftPost({ today, shifts, diaryNames = [] }) {
  if (!shifts.length) return null;
  const rows = [...shifts].sort((a, b) => (a.start ?? 9999) - (b.start ?? 9999))
    .map((s) => `・${s.name}　${s.start == null ? "時間未定" : `${timeLabel(s.start)}〜${s.end == null ? "" : timeLabel(s.end)}`}`);
  const body = [
    `${dayLabel(today)}の出勤セラピストをご案内します。`,
    "",
    ...rows,
    "",
    ...(diaryNames.length ? [`写メ日記を更新しました：${diaryNames.join("・")}`, ""] : []),
    "空き状況はお気軽にお問い合わせください。",
    CLOSING,
  ].join("\n");
  return { type: "shift", key: `shift:${today}`, title: `【本日の出勤】${dayLabel(today)} ${shifts.length}名出勤`, body };
}

/** 割引のご案内（data/offers.json の実施中のもの1件） */
export function offerPost(offer, rules = []) {
  if (!offer) return null;
  const body = [
    `【${offer.name}】${offer.amount.toLocaleString("ja-JP")}円OFF`,
    "",
    `対象：${offer.target}`,
    `コース：${offer.courses}`,
    ...(offer.note ? ["", offer.note] : []),
    "",
    "ご予約時にお申し出ください（お電話・LINEは「特別割引希望」とお伝えください）。",
    "割引の併用はできません。指名料・オプション・延長は割引の対象外です。",
    "",
    CLOSING,
  ].join("\n");
  return { type: "offer", key: `offer:${offer.id}`, title: `【${offer.name}】${offer.badge ? offer.badge + " " : ""}${offer.amount.toLocaleString("ja-JP")}円OFF`, body };
}

/** 本日出勤するセラピストのご紹介（在籍情報の紹介文から。体の強調は外す） */
export function appealPost({ today, therapist, shift }) {
  if (!therapist || !shift) return null;
  const name = therapist.nameFull || therapist.name;
  const tags = (therapist.tags || []).filter((t) => !BODY_WORDS.test(t) && !NG_WORDS.test(t)).slice(0, 4);
  const intro = softenProfile(therapist.profile, 260);
  const time = shift.start == null ? "時間未定" : `${timeLabel(shift.start)}〜${shift.end == null ? "" : timeLabel(shift.end)}`;
  const body = [
    `本日${dayLabel(today)}は、${name}さんが ${time} で出勤します。`,
    ...(tags.length ? ["", `${tags.map((t) => `#${t}`).join(" ")}`] : []),
    ...(intro ? ["", intro] : []),
    "",
    `${name}さんのご指名・ご予約をお待ちしております。`,
  ].join("\n");
  return { type: "appeal", key: `appeal:${today}:${therapist.name}`, title: `【本日出勤】${name}さん ${time}`, body, therapist: therapist.name, displayName: name, isNew: !!therapist.isNew };
}

/** そのサイトに登録されているクーポンのご案内（サイトから読んだ内容だけ） */
export function couponPost(coupon) {
  if (!coupon || !coupon.title) return null;
  const body = [
    `当サイト限定のクーポンをご用意しています。`,
    "",
    `【${plain(coupon.title)}】`,
    ...(coupon.detail ? [plain(coupon.detail)] : []),
    "",
    "ご予約時に「クーポン利用」とお伝えください。条件はクーポンのページをご確認ください。",
    CLOSING,
  ].join("\n");
  return { type: "coupon", key: `coupon:${plain(coupon.title)}`, title: `【クーポン】${plain(coupon.title)}`, body };
}

/** エステ魂のニュースの転載（お店が書いた本文をそのまま。絵文字は外す） */
export function forwardPost(item) {
  if (!item || !item.title) return null;
  return { type: "forward", key: `forward:${item.id}`, title: plain(item.title), body: plain(item.body || item.title) };
}

/**
 * 次に出す1件を選ぶ。rotation は前回の種類の位置（state に保存）、done はその日に出した key の一覧。
 * candidates: { forward:[...], shift, offer:[...], appeal:[...], coupon:[...] }
 */
export function pickNext(candidates, { rotation = 0, done = [], site } = {}) {
  const ok = (p) => p && !done.includes(p.key) && allowedFor(site, p).ok;
  const fw = (candidates.forward || []).find(ok);
  if (fw) return { post: fw, rotation };
  for (let i = 1; i <= TYPES.length; i++) {
    const idx = (rotation + i) % TYPES.length;
    const type = TYPES[idx];
    const list = type === "shift" ? [candidates.shift] : candidates[type] || [];
    const p = list.find(ok);
    if (p) return { post: p, rotation: idx };
  }
  // 同じ日に一回りしたら、出勤案内は最新の内容で出し直してよい（時間がたつと出勤が変わるため）
  if (candidates.shift && allowedFor(site, candidates.shift).ok) return { post: { ...candidates.shift, key: `${candidates.shift.key}#${done.length}` }, rotation: 0 };
  return { post: null, rotation };
}

/**
 * その日の上限を 10:00〜翌5:00 に均等に配る：今の時点までに出してよい件数
 *   nowMin は営業日の分（翌2:00 は 26*60）。開始前は0、終了後は上限まで。
 */
export function allowedSoFar(quota, nowMin, { start = 10 * 60, end = 29 * 60 } = {}) {
  if (!(quota > 0) || nowMin < start) return 0;
  if (nowMin >= end) return quota;
  return Math.min(quota, Math.floor(((nowMin - start) / (end - start)) * quota) + 1);
}
