"use client";
// サイト全体のリンククリックを1か所で計測する（各ボタンに個別の計測コードを書かない）。
//   tel: リンク           → phone_reservation_click（求人ページ上では recruit_phone_click）
//   お客様向けLINE        → line_reservation_click
//   セラピスト求人のLINE  → recruit_line_click
// 送るのはクリックしたページの場所だけ（電話番号・LINE ID などは送らない）。
import { useEffect } from "react";
import links from "../../data/links.json";
import recruitCfg from "../../data/recruit-config.json";
import { track } from "../_lib/track";

const norm = (u) => String(u || "").replace(/\/+$/, "");
const LINE_GUEST = norm(links.line);
const LINE_RECRUIT = norm(recruitCfg.recruitLine);

export default function ClickTracking() {
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const params = { link_location: window.location.pathname };
      const onRecruit = /^\/(recruit|careers)\//.test(window.location.pathname);
      if (href.startsWith("tel:")) track(onRecruit ? "recruit_phone_click" : "phone_reservation_click", params);
      else if (LINE_RECRUIT && norm(href) === LINE_RECRUIT) track("recruit_line_click", params);
      else if (LINE_GUEST && norm(href) === LINE_GUEST) track("line_reservation_click", params);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
