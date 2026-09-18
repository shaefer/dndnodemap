import { toSVGString, type SVGRenderOptions } from "../../core/exporter";
import type { WorldMap } from "../../types/map";

// 2x the 1200x800 base canvas — crisp for print/zoom without being a huge
// file; flat-color regions + thin lines + sparse text compress tightly as
// PNG, so this is expected to stay well under 1MB for a typical map. Revisit
// if real exports turn out larger than that in practice.
const IMAGE_EXPORT_SCALE = 2;

// Not in core/ — Image/canvas/Blob are browser-only APIs, which core/ must
// stay free of (spec Section 2). Reuses the same pure toSVGString() that
// backend/ can also call, so this is just an SVG->PNG rasterization step
// layered on top, not a second rendering implementation.
export function downloadMapImage(map: WorldMap, options: SVGRenderOptions): Promise<void> {
  const svgString = toSVGString(map, IMAGE_EXPORT_SCALE, options);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(svgUrl);
      if (!ctx) {
        reject(new Error("Canvas is not supported in this browser."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not generate the image."));
          return;
        }
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${map.name.replace(/\s+/g, "-").toLowerCase()}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("Could not render the map to an image."));
    };
    img.src = svgUrl;
  });
}
