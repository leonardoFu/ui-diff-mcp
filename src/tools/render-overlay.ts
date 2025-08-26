import { RenderOverlayInput } from '../types.js';
import { createOverlayImage } from '../utils/image-processing.js';
import { promises as fs } from 'fs';

/**
 * Render overlay image with highlighted difference regions
 * Implements the render_overlay tool as specified in deltavision doc
 */
export async function renderOverlay(input: RenderOverlayInput): Promise<string> {
  const { current_path, regions } = input;
  
  // Validate input file exists
  await fs.access(current_path);
  
  // Create overlay image
  const overlayPath = await createOverlayImage(current_path, regions);
  
  return overlayPath;
}