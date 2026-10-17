import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import GalleryClient from "./GalleryClient";
import Breadcrumbs from "../_components/Breadcrumbs";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata("gallery");

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
