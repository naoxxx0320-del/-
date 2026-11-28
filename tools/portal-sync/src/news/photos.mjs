// ニュースに添える写真：本日出勤のセラピストの写真（各サイトの規約に合うと目視で選んだものだけ）
// 写真のファイルは Mac の photos フォルダ（config.local.json の photoDir、なければ repo の隣の photos）にある。
// 紹介（appeal）の投稿は本人の写真。それ以外は本日出勤の人を、出勤の早い順に投稿ごとに入れ替えて使う。
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, join } from "node:path";

// 下着・水着・露出の多いものは不可。服装が明確な写真だけ（2026-11-25〜26 目視で選定。みかの1・2枚目は下着に見えるため使わない）
export const SAFE = {
  れいこ: ["crry", "hni6", "nron", "2hij", "wbsu"],
  かのん: ["1hu0", "9p0q", "2psc"],
  さら: ["l71o"],
  ももこ: ["za34", "74zo"],
  ひなた: ["w0la", "5h13"],
  ななお: ["o6yj"],
  あい: ["llf1"],
  みなみ: ["neou", "zaq3", "5lem"],
  みか: ["17i0", "qv8i"],
  めぐみ: ["vfy1"], // 1枚目（ピンクのニット・胸元のレース）は下着に見えるため使わない（2026-11-28 目視）
};

/** 写真を添える人を決める（名前だけ。ファイルは photoFile で探す） */
export function pickPhotoName(post, todays, index = 0) {
  if (post && post.type === "appeal" && post.displayName) return SAFE[post.displayName] ? post.displayName : null;
  const names = [...(todays || [])].filter((s) => s && SAFE[s.name])
    .sort((a, b) => (a.start ?? 9999) - (b.start ?? 9999)).map((s) => s.name);
  const uniq = [...new Set(names)];
  return uniq.length ? uniq[((index % uniq.length) + uniq.length) % uniq.length] : null;
}

/** その人の1枚目の写真のファイル（なければ null） */
export function photoFile(name, photoDir) {
  const keys = SAFE[name];
  if (!keys || !photoDir || !existsSync(photoDir)) return null;
  const files = readdirSync(photoDir);
  for (const k of keys) { const f = files.find((x) => x.endsWith(`-${k}.jpg`) || x.endsWith(`-${k}.jpeg`)); if (f) return join(photoDir, f); }
  return null;
}

/** 余白を白で足して、写真全体が収まる形にした写真を作る（"square" 正方形／"4:3" 横長）。Mac の sips を使う。作れなければ元の写真 */
export function padded(file, shape, outDir) {
  if (!file || !shape || process.platform !== "darwin") return file;
  const size = spawnSync("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8" });
  const w = Number((size.stdout.match(/pixelWidth:\s*(\d+)/) || [])[1]), h = Number((size.stdout.match(/pixelHeight:\s*(\d+)/) || [])[1]);
  if (!w || !h) return file;
  let W, H;
  if (shape === "square") W = H = Math.max(w, h);
  else { H = Math.max(h, Math.ceil((w * 3) / 4)); W = Math.ceil((H * 4) / 3); }
  mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const out = join(outDir, `${shape.replace(":", "x")}-${basename(file)}`);
  if (existsSync(out)) return out;
  const r = spawnSync("/usr/bin/sips", ["-p", String(H), String(W), "--padColor", "FFFFFF", file, "--out", out], { encoding: "utf8" });
  return r.status === 0 && existsSync(out) ? out : file;
}
