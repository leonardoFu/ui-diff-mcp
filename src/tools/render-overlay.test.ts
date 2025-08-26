import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderOverlay } from './render-overlay.js';
import { createTestImages } from '../test-utils/image-helpers.js';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

describe('render_overlay', () => {
  let testDir: string;
  let currentPath: string;

  beforeAll(async () => {
    testDir = path.join(process.cwd(), 'test-artifacts', 'render-overlay');
    await fs.mkdir(testDir, { recursive: true });
    
    const { current } = await createTestImages();
    currentPath = path.join(testDir, 'current.png');
    await fs.writeFile(currentPath, current);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should return path to overlay image', async () => {
    const regions = [
      {
        id: 'r1',
        bbox: [100, 100, 200, 150],
        score: 0.78,
        max: 0.91,
        area_px: 30000
      },
      {
        id: 'r2', 
        bbox: [300, 200, 100, 100],
        score: 0.65,
        max: 0.82,
        area_px: 10000
      }
    ];

    const overlayPath = await renderOverlay({
      current_path: currentPath,
      regions
    });

    expect(typeof overlayPath).toBe('string');
    expect(overlayPath).toMatch(/\.png$/);

    // Check that overlay file exists
    const overlayExists = await fs.access(overlayPath).then(() => true).catch(() => false);
    expect(overlayExists).toBe(true);
  });

  it('should create overlay with correct dimensions', async () => {
    const regions = [
      { id: 'r1', bbox: [50, 50, 100, 100], score: 0.5, max: 0.8, area_px: 10000 }
    ];

    const overlayPath = await renderOverlay({
      current_path: currentPath,
      regions
    });

    const overlayImage = sharp(overlayPath);
    const { width, height } = await overlayImage.metadata();
    
    const currentImage = sharp(currentPath);
    const currentMeta = await currentImage.metadata();

    expect(width).toBe(currentMeta.width);
    expect(height).toBe(currentMeta.height);
  });

  it('should handle empty regions array', async () => {
    const overlayPath = await renderOverlay({
      current_path: currentPath,
      regions: []
    });

    expect(typeof overlayPath).toBe('string');
    const overlayExists = await fs.access(overlayPath).then(() => true).catch(() => false);
    expect(overlayExists).toBe(true);
  });

  it('should handle non-existent current image', async () => {
    const regions = [
      { id: 'r1', bbox: [0, 0, 100, 100], score: 0.5, max: 0.8, area_px: 10000 }
    ];

    await expect(renderOverlay({
      current_path: 'nonexistent.png',
      regions
    })).rejects.toThrow();
  });
});