# DeltaVision MCP — UI Diff via SSIM/PSNR (with VMAF stop condition)
_Last updated: 2025-08-24_

## Why
Use image-level signals to guide an LLM to **where** a UI implementation diverges from the design, and **when to stop** iterating. We emphasize:
- **SSIM heatmap** → structural, per-pixel similarity useful for **localization** (regions to fix).
- **PSNR** → simple error magnitude for **ranking** severity.
- **VMAF** → perceptual **global stop condition** to decide when the UI is “good enough.”

This doc exports the design choices, FFmpeg/Python recipes, MCP tool contracts, and an iteration loop you can drop into your build system.

---

## System Overview

**Inputs**
- `target.png` — the canonical design snapshot.
- `current.png` — a render/screenshot of the current build.

**Outputs**
- `diff_heatmap.png` — a visualization to highlight differences (SSIM heatmap or pixel-diff).
- `regions.json` — bounding boxes with scores (from SSIM map and/or diff map).
- `metrics.json` — global metrics (PSNR, SSIM avg), and **VMAF**.
- (Optional) `report.md` — human-readable summary for PR comments.

**Control Flow**
1. Normalize images (size, DPR, fonts) to minimize false positives.
2. Compute SSIM (map) and PSNR; generate a **heatmap** and **regions**.
3. Feed `regions.json` + relevant code to LLM; apply a minimal patch.
4. Re-render → recompute metrics.
5. Stop when **VMAF ≥ target** (and optionally SSIM ≥ threshold) or no regions exceed a score threshold.

---

## Implementation Options

### A) FFmpeg-only (fast; zero Python deps)
- **PSNR (global)**
  ```bash
  ffmpeg -i current.png -i target.png -lavfi psnr -f null -
  ```
  Parse stderr for `psnr_avg` (or per-plane PSNR).

- **SSIM (global)**
  ```bash
  ffmpeg -i current.png -i target.png -lavfi ssim=stats_file=ssim.log -f null -
  ```
  Parse `ssim.log` for overall scores.

- **Heatmap (visual localization)**
  *Approximate* with a pixel-difference map. This is not true SSIM-per-pixel, but is useful and fast:
  ```bash
  ffmpeg -i current.png -i target.png -filter_complex "[0][1]blend=all_mode=difference,format=gray,normalize=independent=1:range=full,eq=contrast=2.0" -frames:v 1 diff_heatmap.png
  ```
  Then threshold & find contours (see “Region Extraction”).

**Pros:** single dependency, very fast.  
**Cons:** No native per-pixel SSIM map from FFmpeg; the visual heatmap is a *difference* map.

---

### B) Hybrid (recommended): FFmpeg for PSNR/VMAF, Python for **true SSIM heatmap**
Use `skimage.metrics.structural_similarity` with `full=True` to obtain the SSIM map, which you convert into a heatmap and regions. Keep FFmpeg for PSNR and VMAF.

**Python (SSIM heatmap)**
```python
from skimage.metrics import structural_similarity as ssim
import cv2, numpy as np

a = cv2.imread("target.png")
b = cv2.imread("current.png")
a = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
b = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)

score, ssim_map = ssim(a, b, full=True)         # ssim_map in [0..1], 1 = identical
heat = (1.0 - ssim_map)                         # invert: high = more different
heat_norm = (255 * (heat / (heat.max() + 1e-6))).astype(np.uint8)
cv2.imwrite("diff_heatmap.png", heat_norm)
```

**FFmpeg (PSNR + VMAF)**
```bash
# PSNR
ffmpeg -i current.png -i target.png -lavfi psnr -f null -

# VMAF (requires ffmpeg with --enable-libvmaf)
ffmpeg -i current.png -i target.png -lavfi libvmaf=log_path=vmaf.json -f null -
```
**Pros:** true SSIM heatmap; still simple.  
**Cons:** adds Python dependency.

---

## Region Extraction (from heatmap)

1. **Blur** slightly to remove speckle noise: Gaussian blur (σ ≈ 1.0).
2. **Threshold** (Otsu or fixed percentile) to binary mask.
3. **Morphology**: dilate → erode (closing) to merge adjacent small differences.
4. **Contours / Connected components**: compute bounding boxes.
5. **Scores per region**:
   - `mean_heat` (mean of heatmap over bbox)
   - `max_heat`
   - `area_px`
   - `psnr_local` (optional): compute PSNR on the cropped region to rank severity
   - `ssim_local` (optional): average SSIM on the region

**Example (Python/OpenCV)**
```python
import cv2, numpy as np, json

heat = cv2.imread("diff_heatmap.png", cv2.IMREAD_GRAYSCALE)
blur = cv2.GaussianBlur(heat, (5,5), 0)
_, mask = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8), iterations=1)

contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

regions = []
for i, c in enumerate(contours):
    x,y,w,h = cv2.boundingRect(c)
    roi = heat[y:y+h, x:x+w]
    regions.append({
        "id": f"r{i+1}",
        "bbox": [int(x), int(y), int(w), int(h)],
        "score": float(roi.mean())/255.0,   # 0..1 severity
        "max": float(roi.max())/255.0,
        "area_px": int(w*h)
    })

with open("regions.json", "w") as f:
    json.dump({"canvas": {"w": int(heat.shape[1]), "h": int(heat.shape[0])},
               "regions": sorted(regions, key=lambda r: r["score"], reverse=True)}, f, indent=2)
```

---

## MCP Server Design

### Tools
- **`compute_diff_regions`**
  - **Args**: `target_path`, `current_path`, `{threshold: float (0..1), min_area_px: int}`
  - **Returns**: `{canvas:{{w,h}}, regions:[{{id,bbox,score,max,area_px}}], metrics:{{psnr, ssim_avg}}, artifacts:{{heatmap_path}}}`

- **`score_global`**
  - **Args**: `target_path`, `current_path`
  - **Returns**: `{vmaf: float, ssim_avg: float, psnr: float}`

- **`render_overlay`**
  - **Args**: `current_path`, `regions`
  - **Returns**: path to a PNG with translucent red boxes for UX/debug.

### Example Response
```json
{
  "canvas": {"w": 1440, "h": 900},
  "regions": [
    {"id":"r1","bbox":[960,72,240,48],"score":0.78,"max":0.91,"area_px":11520},
    {"id":"r2","bbox":[40,640,320,120],"score":0.66,"max":0.82,"area_px":38400}
  ],
  "metrics": {"psnr": 31.8, "ssim_avg": 0.947},
  "artifacts": {"heatmap_path":"diff_heatmap.png"}
}
```

### JSON Schema (sketch)
```json
{
  "type": "object",
  "properties": {
    "canvas": {"type":"object","properties":{"w":{"type":"integer"},"h":{"type":"integer"}}},
    "regions": {
      "type": "array",
      "items": {
        "type":"object",
        "properties": {
          "id":{"type":"string"},
          "bbox":{"type":"array","items":{"type":"integer"},"minItems":4,"maxItems":4},
          "score":{"type":"number"},
          "max":{"type":"number"},
          "area_px":{"type":"integer"}
        },
        "required":["id","bbox","score"]
      }
    },
    "metrics": {"type":"object","properties":{"psnr":{"type":"number"},"ssim_avg":{"type":"number"},"vmaf":{"type":"number"}}},
    "artifacts": {"type":"object","properties":{"heatmap_path":{"type":"string"}}}
  },
  "required": ["canvas","regions","metrics"]
}
```

---

## Prompting the LLM (context engineering)

**System prompt stub**
> You are a UI code fixer. Only modify code to reduce differences in the specified regions. Prefer CSS/layout changes before structural refactors. Use minimal patches. Reference regions by ID.

**Tool output → instruction**
- Provide `regions.json` + current code excerpt (or file/line ranges).
- Ask for:
  1) a **unified diff** patch,
  2) a short explanation **per region ID** changed,
  3) a summary of expected metric change (↑SSIM, ↑PSNR).

**Stopping**
- After each patch, re-render and recompute metrics. Stop when `vmaf ≥ VMAF_TARGET` (e.g., 92–95) _and_ no region has `score ≥ REGION_SEVERITY_TARGET` (e.g., 0.35).

---

## Tuning

- **Normalization**: enforce same viewport size, DPR, font set, and OS text rendering if possible.
- **Thresholds**: Start with Otsu; override with fixed percentile (e.g., top 5–10% heat).
- **Min area**: Ignore tiny speckles, e.g., `< 64–128 px²`.
- **Ranking**: Sort regions by `score` (mean heat) × `log(area_px)`.
- **VMAF target**: 92+ is a reasonable default; adapt per product.

---

## CLI Examples

**Generate visual heatmap (fast approximation)**
```bash
ffmpeg -i current.png -i target.png -filter_complex "[0][1]blend=all_mode=difference,format=gray,normalize=independent=1:range=full,eq=contrast=2.0" -frames:v 1 diff_heatmap.png
```

**Compute PSNR & SSIM logs**
```bash
ffmpeg -i current.png -i target.png -lavfi psnr -f null - 2> psnr.log
ffmpeg -i current.png -i target.png -lavfi ssim=stats_file=ssim.log -f null -
```

**Compute VMAF (global)**
```bash
ffmpeg -i current.png -i target.png -lavfi libvmaf=log_path=vmaf.json -f null -
```

---

## Quick MCP Sketch (Node, pseudo-code)

```ts
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import sharp from "sharp";
import { ssimHeatmap, regionsFromHeatmap } from "./vision"; // your Python/wasm bridge or JS impl

export const tools = {
  compute_diff_regions: async ({ target_path, current_path, threshold=0.0, min_area_px=64 }) => {
    const heatmapPath = "diff_heatmap.png";
    await ssimHeatmap(target_path, current_path, heatmapPath);   // Python or wasm
    const regions = await regionsFromHeatmap(heatmapPath, { min_area_px });
    const psnr = await runFF("psnr", current_path, target_path);
    const ssimAvg = await runFF("ssim", current_path, target_path);
    return { canvas: await getSize(current_path), regions, metrics: { psnr, ssim_avg: ssimAvg }, artifacts: { heatmap_path: heatmapPath } };
  },
  score_global: async ({ target_path, current_path }) => {
    const vmaf = await runFF("vmaf", current_path, target_path);
    const psnr = await runFF("psnr", current_path, target_path);
    const ssimAvg = await runFF("ssim", current_path, target_path);
    return { vmaf, ssim_avg: ssimAvg, psnr };
  }
};
```

---

## Edge Cases & Mitigations
- **Anti-aliased text**: Use slight blur before SSIM; set a minimum area to avoid kerning speckles.
- **Color-space drift**: Force sRGB; disable HDR tone-mapping.
- **Different canvases**: Resize to the target’s exact H×W before comparison.
- **Dynamic content**: Mask volatile regions (timestamps, ads) before diffing.

---

## Roadmap
- **Tile-wise LPIPS** (optional) to catch perceptual mismatches in color/weight.
- **Keypoint anchoring** (ORB/SIFT) for robust positional shift detection.
- **Automated PR comments** that include overlay previews and top-3 fix suggestions.

---

## Dependencies
- **FFmpeg** with `libvmaf` enabled for VMAF.
- **Python** (optional) + `scikit-image`, `opencv-python` for SSIM map & region extraction.
- **Node/TS** (if building the MCP server in JS): `sharp`/`jimp` for I/O, or a Python bridge.

---

## Glossary
- **SSIM**: Structural similarity index, 0..1 (1 = identical).
- **PSNR**: Peak signal-to-noise ratio, ↑ is better (dB).
- **VMAF**: Video Multi-Method Assessment Fusion, perceptual 0..100 (↑ is better).

---

## License & Notes
This doc is implementation guidance. Ensure FFmpeg’s build includes `--enable-libvmaf` on your CI runners.
