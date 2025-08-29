import { Region } from '../types.js';

export interface RegionMergerOptions {
  maxRegions?: number;
  scoreThreshold?: number;
  maxDistance?: number;
}

/**
 * Calculate the minimum distance between two regions' bounding boxes
 */
export function calculateDistance(region1: Region, region2: Region): number {
  const [x1, y1, w1, h1] = region1.bbox;
  const [x2, y2, w2, h2] = region2.bbox;
  
  // Convert to x1, y1, x2, y2 format for easier calculation
  const r1 = {
    left: x1,
    top: y1,
    right: x1 + w1,
    bottom: y1 + h1
  };
  
  const r2 = {
    left: x2,
    top: y2,
    right: x2 + w2,
    bottom: y2 + h2
  };
  
  // Check for overlap
  if (r1.right >= r2.left && r1.left <= r2.right &&
      r1.bottom >= r2.top && r1.top <= r2.bottom) {
    return 0; // Overlapping regions have 0 distance
  }
  
  // Calculate minimum distance between rectangles
  const horizontalDistance = Math.max(0, Math.max(r2.left - r1.right, r1.left - r2.right));
  const verticalDistance = Math.max(0, Math.max(r2.top - r1.bottom, r1.top - r2.bottom));
  
  return Math.sqrt(horizontalDistance * horizontalDistance + verticalDistance * verticalDistance);
}

/**
 * Check if two regions should be merged based on similarity and proximity
 */
export function shouldMergeRegions(
  region1: Region, 
  region2: Region, 
  options: { scoreThreshold: number; maxDistance: number }
): boolean {
  const { scoreThreshold, maxDistance } = options;
  
  // Check score similarity
  const scoreDiff = Math.abs(region1.score - region2.score);
  if (scoreDiff > scoreThreshold) {
    return false;
  }
  
  // Check spatial proximity
  const distance = calculateDistance(region1, region2);
  return distance <= maxDistance;
}

/**
 * Merge two regions into a single region with combined properties
 */
function mergeTwo(region1: Region, region2: Region): Region {
  const [x1, y1, w1, h1] = region1.bbox;
  const [x2, y2, w2, h2] = region2.bbox;
  
  // Calculate bounding box that encompasses both regions
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1 + w1, x2 + w2);
  const maxY = Math.max(y1 + h1, y2 + h2);
  
  const combinedWidth = maxX - minX;
  const combinedHeight = maxY - minY;
  const combinedArea = combinedWidth * combinedHeight;
  
  // Weighted average score based on areas
  const totalOriginalArea = region1.area_px + region2.area_px;
  const weightedScore = (region1.score * region1.area_px + region2.score * region2.area_px) / totalOriginalArea;
  
  // Maximum of the max values (if present)
  const combinedMax = Math.max(region1.max || region1.score, region2.max || region2.score);
  
  return {
    id: `${region1.id}+${region2.id}`,
    bbox: [minX, minY, combinedWidth, combinedHeight],
    score: weightedScore,
    max: combinedMax,
    area_px: combinedArea
  };
}

/**
 * Merge similar regions based on score similarity and spatial proximity
 * Limits output to maximum specified number of regions
 */
export function mergeRegions(
  regions: Region[],
  options: RegionMergerOptions = {}
): Region[] {
  const {
    maxRegions = 20,
    scoreThreshold = 0.05,
    maxDistance = 50
  } = options;
  
  if (regions.length === 0) {
    return [];
  }
  
  // Sort regions by score (highest first) to prioritize important regions
  const sortedRegions = [...regions].sort((a, b) => b.score - a.score);
  
  // Use greedy clustering approach
  const merged: Region[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < sortedRegions.length; i++) {
    if (used.has(i)) continue;
    
    let currentRegion = sortedRegions[i];
    used.add(i);
    
    // Try to merge with remaining regions
    let foundMerge = true;
    while (foundMerge) {
      foundMerge = false;
      
      for (let j = i + 1; j < sortedRegions.length; j++) {
        if (used.has(j)) continue;
        
        const candidateRegion = sortedRegions[j];
        
        if (shouldMergeRegions(currentRegion, candidateRegion, { scoreThreshold, maxDistance })) {
          currentRegion = mergeTwo(currentRegion, candidateRegion);
          used.add(j);
          foundMerge = true;
          break; // Start over to find more merges with the new merged region
        }
      }
    }
    
    merged.push(currentRegion);
  }
  
  // Sort merged regions by score and limit to maxRegions
  return merged
    .sort((a, b) => b.score - a.score)
    .slice(0, maxRegions);
}