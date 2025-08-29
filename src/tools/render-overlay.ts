import { RenderOverlayInput, HeatmapOverlayInput } from '../types.js';
import { createHeatmapOverlay } from '../utils/heatmap-overlay.js';
import { promises as fs } from 'fs';

/**
 * Render overlay image with highlighted difference regions
 * Implements the render_overlay tool as specified in deltavision doc
 * 
 * NOTE: This function now expects current_path to be a heatmap, not the original image
 * For backward compatibility, current_path is treated as the heatmap source.
 */
export async function renderOverlay(input: RenderOverlayInput): Promise<string> {
  const { current_path, regions } = input;
  
  // Validate input file exists
  await fs.access(current_path);
  
  // For now, use current_path as both heatmap and target
  // In practice, the heatmap should be provided separately
  const overlayPath = await createHeatmapOverlay({
    heatmap_path: current_path,
    target_path: current_path, 
    regions
  });
  
  return overlayPath;
}

/**
 * New heatmap-based render overlay function
 * This is the preferred way to create overlays with proper heatmap visualization
 */
export async function renderOverlayWithHeatmap(input: HeatmapOverlayInput): Promise<string> {
  const { heatmap_path, target_path, regions } = input;
  
  // Validate input files exist
  await fs.access(heatmap_path);
  await fs.access(target_path);
  
  // Create heatmap-based overlay
  const overlayPath = await createHeatmapOverlay({
    heatmap_path,
    target_path,
    regions
  });
  
  return overlayPath;
}