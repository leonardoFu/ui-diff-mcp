import sharp from 'sharp';
import { Region } from '../types.js';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Get image dimensions
 */
export async function getImageDimensions(imagePath: string): Promise<{width: number, height: number}> {
  const metadata = await sharp(imagePath).metadata();
  
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not get dimensions for image: ${imagePath}`);
  }
  
  return {
    width: metadata.width,
    height: metadata.height
  };
}

/**
 * Extract regions from heatmap by finding high-intensity areas
 * This is a simplified implementation - in production you'd want more sophisticated
 * contour detection like OpenCV
 */
export async function extractRegionsFromHeatmap(
  heatmapPath: string, 
  options: { threshold?: number; minAreaPx?: number } = {}
): Promise<Region[]> {
  const { threshold = 0.3, minAreaPx = 64 } = options;
  
  const image = sharp(heatmapPath);
  const { width, height } = await image.metadata();
  
  if (!width || !height) {
    throw new Error('Could not get heatmap dimensions');
  }
  
  // Get raw pixel data
  const { data } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const regions: Region[] = [];
  
  // Simple threshold-based region detection
  // This is a basic implementation - production would use proper connected components
  const visited = new Set<string>();
  const thresholdValue = threshold * 255;
  
  for (let y = 0; y < height; y += 10) { // Sample every 10 pixels for performance
    for (let x = 0; x < width; x += 10) {
      const idx = y * width + x;
      const pixelValue = data[idx];
      
      if (pixelValue > thresholdValue && !visited.has(`${x},${y}`)) {
        // Found a bright pixel, try to define a region around it
        const region = findRegionAroundPoint(data, width, height, x, y, thresholdValue, visited);
        
        if (region && region.area_px >= minAreaPx) {
          regions.push({
            id: `r${regions.length + 1}`,
            bbox: region.bbox,
            score: region.score,
            max: region.max,
            area_px: region.area_px
          });
        }
      }
    }
  }
  
  // Sort regions by score (highest first)
  return regions.sort((a, b) => b.score - a.score);
}

/**
 * Simple region growing algorithm around a seed point
 */
function findRegionAroundPoint(
  data: Buffer,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  threshold: number,
  visited: Set<string>
): { bbox: [number, number, number, number]; score: number; max: number; area_px: number } | null {
  
  const regionSize = 50; // Simple fixed region size for minimal implementation
  
  const x = Math.max(0, seedX - regionSize / 2);
  const y = Math.max(0, seedY - regionSize / 2);
  const w = Math.min(regionSize, width - x);
  const h = Math.min(regionSize, height - y);
  
  // Mark area as visited
  for (let py = y; py < y + h; py += 5) {
    for (let px = x; px < x + w; px += 5) {
      visited.add(`${px},${py}`);
    }
  }
  
  // Calculate stats for this region
  let sum = 0;
  let max = 0;
  let count = 0;
  
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const idx = py * width + px;
      if (idx < data.length) {
        const value = data[idx];
        sum += value;
        max = Math.max(max, value);
        count++;
      }
    }
  }
  
  return {
    bbox: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)],
    score: sum / count / 255, // Normalize to 0-1
    max: max / 255, // Normalize to 0-1
    area_px: Math.round(w * h)
  };
}

