import { ComputeDiffRegionsInput, ComputeDiffRegionsResponse } from '../types.js';
import { computePSNR, computeSSIM, generateHeatmap } from '../utils/ffmpeg.js';
import { getImageDimensions, extractRegionsFromHeatmap } from '../utils/image-processing.js';
import { mergeRegions } from '../utils/region-merger.js';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Compute diff regions between target and current images
 * Implements the core tool as specified in deltavision doc
 */
export async function computeDiffRegions(input: ComputeDiffRegionsInput): Promise<ComputeDiffRegionsResponse> {
  const { 
    target_path, 
    current_path, 
    threshold = 0.0, 
    min_area_px = 64,
    max_regions = 20,
    merge_score_threshold = 0.05,
    merge_distance_threshold = 50
  } = input;
  
  // Validate input files exist
  await fs.access(target_path);
  await fs.access(current_path);
  
  // Generate unique heatmap path in test-artifacts directory
  const artifactsDir = path.join(process.cwd(), 'test-artifacts');
  await fs.mkdir(artifactsDir, { recursive: true });
  const heatmapPath = path.join(artifactsDir, `diff_heatmap_${Date.now()}.png`);
  
  try {
    // Get canvas dimensions from current image
    const dimensions = await getImageDimensions(current_path);
    
    // Generate heatmap using FFmpeg difference blend
    await generateHeatmap(current_path, target_path, heatmapPath);
    
    // Extract regions from heatmap
    const rawRegions = await extractRegionsFromHeatmap(heatmapPath, {
      threshold,
      minAreaPx: min_area_px
    });
    
    // Merge similar regions and limit output
    const regions = mergeRegions(rawRegions, {
      maxRegions: max_regions,
      scoreThreshold: merge_score_threshold,
      maxDistance: merge_distance_threshold
    });
    
    // Compute global metrics
    const [psnr, ssim_avg] = await Promise.all([
      computePSNR(current_path, target_path),
      computeSSIM(current_path, target_path)
    ]);
    
    return {
      canvas: {
        w: dimensions.width,
        h: dimensions.height
      },
      regions,
      metrics: {
        psnr,
        ssim_avg
      },
      artifacts: {
        heatmap_path: heatmapPath
      }
    };
  } catch (error) {
    // Clean up heatmap on error
    try {
      await fs.unlink(heatmapPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}