import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import { abs } from "../_lib/site";
import GalleryClient from "./GalleryClient";
import Breadcrumbs from "../_components/Breadcrumbs";

export const metadata = {
  title: "フォトギャラリー",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 の空間・セラピストのフォトギャラリー。",
  alternates: { canonical: abs("gallery/") },
  openGraph: { url: abs("gallery/"), title: "フォトギャラリー｜AROMA DAIAMOND 亀戸" },
};

export default function Gallery() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background:
            "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: "フォトギャラリー", path: "gallery/" }]} />
        <div className="page-head">
          <div className="ph-en">Gallery</div>
          <h1 className="ph-jp">フォトギャラリー</h1>
        </div>

        <NavGrid base="../" />

        <GalleryClient />

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
