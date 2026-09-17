import versions from "../../data/photo-versions.json";

/* 写真の src を組み立てる。
   - http(s) のURLはそのまま
   - public/ 内のファイル名は base を付け、内容ハッシュ ?v= を付与
     （同名で差し替えても内容が変われば ?v= が変わり、キャッシュを無効化） */
export function photoSrc(photo, base = "") {
  if (!photo) return null;
  if (/^https?:\/\//.test(photo)) return photo;
  const v = versions[photo];
  return `${base}${photo}${v ? `?v=${v}` : ""}`;
}
