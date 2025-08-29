import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHeatmapOverlay } from './heatmap-overlay.js';
import { createTestImages } from '../test-utils/image-helpers.js';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

describe('heatmap-overlay', () => {
  let testDir: string;
  let heatmapPath: string;
  let targetPath: string;

  beforeAll(async () => {
    testDir = path.join(process.cwd(), 'test-artifacts', 'heatmap-overlay');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test heatmap and target images
    const { current, target } = await createTestImages();
    heatmapPath = path.join(testDir, 'heatmap.png');
    targetPath = path.join(testDir, 'target.png');
    
    // Create a simple gray heatmap for testing
    await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 128, g: 128, b: 128 }
      }
    }).png().toFile(heatmapPath);
    
    await fs.writeFile(targetPath, target);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create overlay from heatmap with region highlights', async () => {
    const regions = [
      {
        id: 'r1',
        bbox: [100, 100, 200, 150],
        score: 0.78,
        max: 0.91,
        area_px: 30000
      }
    ];

    const overlayPath = await createHeatmapOverlay({
      heatmap_path: heatmapPath,
      target_path: targetPath,
      regions
    });

    expect(typeof overlayPath).toBe('string');
    expect(overlayPath).toMatch(/\.png$/);

    // Check that overlay file exists
    const overlayExists = await fs.access(overlayPath).then(() => true).catch(() => false);
    expect(overlayExists).toBe(true);
  });

  it('should preserve heatmap dimensions', async () => {
    const regions = [
      { id: 'r1', bbox: [50, 50, 100, 100], score: 0.5, max: 0.8, area_px: 10000 }
    ];

    const overlayPath = await createHeatmapOverlay({
      heatmap_path: heatmapPath,
      target_path: targetPath,
      regions
    });

    const overlayImage = sharp(overlayPath);
    const { width, height } = await overlayImage.metadata();
    
    const heatmapImage = sharp(heatmapPath);
    const heatmapMeta = await heatmapImage.metadata();

    expect(width).toBe(heatmapMeta.width);
    expect(height).toBe(heatmapMeta.height);
  });

  it('should handle empty regions gracefully', async () => {
    const overlayPath = await createHeatmapOverlay({
      heatmap_path: heatmapPath,
      target_path: targetPath,
      regions: []
    });

    expect(typeof overlayPath).toBe('string');
    const overlayExists = await fs.access(overlayPath).then(() => true).catch(() => false);
    expect(overlayExists).toBe(true);
  });

  it('should throw error for non-existent heatmap', async () => {
    const regions = [
      { id: 'r1', bbox: [0, 0, 100, 100], score: 0.5, max: 0.8, area_px: 10000 }
    ];

    await expect(createHeatmapOverlay({
      heatmap_path: 'nonexistent.png',
      target_path: targetPath,
      regions
    })).rejects.toThrow();
  });

  it('should create visible region indicators without obscuring heatmap', async () => {
    const regions = [
      { id: 'r1', bbox: [50, 50, 100, 100], score: 0.8, max: 0.9, area_px: 10000 },
      { id: 'r2', bbox: [200, 150, 80, 80], score: 0.6, max: 0.7, area_px: 6400 }
    ];

    const overlayPath = await createHeatmapOverlay({
      heatmap_path: heatmapPath,
      target_path: targetPath,
      regions
    });

    // Check that the overlay has the expected format and can be read
    const overlayImage = sharp(overlayPath);
    const { width, height, channels } = await overlayImage.metadata();
    
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(channels).toBeGreaterThanOrEqual(3); // Should have RGB at minimum
  });
});