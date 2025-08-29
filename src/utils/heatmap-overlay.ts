import sharp from 'sharp';
import { Region, HeatmapOverlayInput } from '../types.js';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Create overlay image using heatmap as base with highlighted regions
 * This replaces the old createOverlayImage that used solid red rectangles
 */
export async function createHeatmapOverlay(input: HeatmapOverlayInput): Promise<string> {
  const { heatmap_path, target_path, regions } = input;
  
  // Validate input files exist
  await fs.access(heatmap_path);
  await fs.access(target_path);
  
  // Create output path in test-artifacts directory
  const artifactsDir = path.join(process.cwd(), 'test-artifacts');
  await fs.mkdir(artifactsDir, { recursive: true });
  const outputPath = path.join(artifactsDir, `heatmap_overlay_${Date.now()}.png`);
  
  // Start with the heatmap as base
  const baseImage = sharp(heatmap_path);
  const { width, height } = await baseImage.metadata();
  
  if (!width || !height) {
    throw new Error('Could not get heatmap dimensions');
  }
  
  // If no regions, just copy the heatmap
  if (regions.length === 0) {
    await baseImage.png().toFile(outputPath);
    return outputPath;
  }
  
  // Create region highlights as overlays - using borders instead of solid fills
  const composites = regions.map((region) => {
    const [x, y, w, h] = region.bbox;
    
    // Create a border highlight instead of solid rectangle
    // Color intensity based on region score - higher score = more prominent
    const borderThickness = Math.max(2, Math.min(5, Math.round(region.score * 5))); 
    const alpha = Math.max(0.6, Math.min(0.9, region.score)); // More opaque for higher scores
    
    // Use color gradient based on score: red for high, orange for medium, yellow for low
    const getHighlightColor = (score: number) => {
      if (score >= 0.8) return { r: 255, g: 0, b: 0, alpha }; // Red for high importance
      if (score >= 0.5) return { r: 255, g: 165, b: 0, alpha }; // Orange for medium
      return { r: 255, g: 255, b: 0, alpha }; // Yellow for low importance
    };
    
    const highlightColor = getHighlightColor(region.score);
    
    // Create border overlay by creating a hollow rectangle
    const borderBuffer = Buffer.alloc(w * h * 4);
    
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const idx = (py * w + px) * 4;
        
        // Create border: top, bottom, left, right edges with variable thickness
        const isBorder = 
          py < borderThickness || 
          py >= h - borderThickness || 
          px < borderThickness || 
          px >= w - borderThickness;
        
        if (isBorder) {
          borderBuffer[idx] = highlightColor.r;     // Red
          borderBuffer[idx + 1] = highlightColor.g; // Green
          borderBuffer[idx + 2] = highlightColor.b; // Blue
          borderBuffer[idx + 3] = Math.round(highlightColor.alpha * 255); // Alpha
        } else {
          borderBuffer[idx + 3] = 0; // Transparent interior
        }
      }
    }
    
    return {
      input: borderBuffer,
      raw: { width: w, height: h, channels: 4 as const },
      top: y,
      left: x,
      blend: 'over' as const
    };
  });
  
  // Apply all border overlays to the heatmap
  await baseImage
    .composite(composites)
    .png()
    .toFile(outputPath);
  
  return outputPath;
}