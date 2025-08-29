import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderOverlayWithHeatmap } from './render-overlay.js';
import { createTestImages } from '../test-utils/image-helpers.js';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

describe('render-overlay heatmap integration', () => {
  let testDir: string;
  let heatmapPath: string;
  let targetPath: string;

  beforeAll(async () => {
    testDir = path.join(process.cwd(), 'test-artifacts', 'overlay-integration');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test heatmap and target images
    const { target } = await createTestImages();
    heatmapPath = path.join(testDir, 'heatmap.png');
    targetPath = path.join(testDir, 'target.png');
    
    // Create a test heatmap with some variation
    await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 100, g: 100, b: 100 }
      }
    }).png().toFile(heatmapPath);
    
    await fs.writeFile(targetPath, target);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create heatmap-based overlay through render-overlay interface', async () => {
    const regions = [
      {
        id: 'r1',
        bbox: [50, 50, 150, 100],
        score: 0.85,
        max: 0.95,
        area_px: 15000
      }
    ];

    const overlayPath = await renderOverlayWithHeatmap({
      heatmap_path: heatmapPath,
      target_path: targetPath,
      regions
    });

    expect(typeof overlayPath).toBe('string');
    expect(overlayPath).toMatch(/\.png$/);

    // Verify overlay exists and has correct dimensions
    const overlayExists = await fs.access(overlayPath).then(() => true).catch(() => false);
    expect(overlayExists).toBe(true);
    
    const overlayMeta = await sharp(overlayPath).metadata();
    const heatmapMeta = await sharp(heatmapPath).metadata();
    
    expect(overlayMeta.width).toBe(heatmapMeta.width);
    expect(overlayMeta.height).toBe(heatmapMeta.height);
  });

  it('should handle multiple regions with different scores', async () => {
    const regions = [
      { id: 'r1', bbox: [20, 20, 80, 80], score: 0.9, max: 0.95, area_px: 6400 },
      { id: 'r2', bbox: [200, 150, 100, 50], score: 0.7, max: 0.8, area_px: 5000 },
      { id: 'r3', bbox: [300, 50, 60, 120], score: 0.5, max: 0.6, area_px: 7200 }
    ];

    const overlayPath = await renderOverlayWithHeatmap({
      heatmap_path: heatmapPath,
      target_path: targetPath,
      regions
    });

    expect(typeof overlayPath).toBe('string');
    
    // Verify the output file is valid
    const overlayImage = sharp(overlayPath);
    const { width, height } = await overlayImage.metadata();
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});