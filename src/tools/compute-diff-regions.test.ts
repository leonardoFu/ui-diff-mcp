import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computeDiffRegions } from './compute-diff-regions.js';
import { createTestImages } from '../test-utils/image-helpers.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('compute_diff_regions', () => {
  let testDir: string;
  let targetPath: string;
  let currentPath: string;

  beforeAll(async () => {
    testDir = path.join(process.cwd(), 'test-artifacts', 'compute-diff-regions');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test images - target (reference) and current (with differences)
    const { target, current } = await createTestImages();
    targetPath = path.join(testDir, 'target.png');
    currentPath = path.join(testDir, 'current.png');
    
    await fs.writeFile(targetPath, target);
    await fs.writeFile(currentPath, current);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should return structured JSON with canvas, regions, metrics, and artifacts', async () => {
    const result = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.1,
      min_area_px: 64
    });

    // Should match the expected JSON structure from deltavision doc
    expect(result).toHaveProperty('canvas');
    expect(result.canvas).toHaveProperty('w');
    expect(result.canvas).toHaveProperty('h');
    expect(typeof result.canvas.w).toBe('number');
    expect(typeof result.canvas.h).toBe('number');

    expect(result).toHaveProperty('regions');
    expect(Array.isArray(result.regions)).toBe(true);

    expect(result).toHaveProperty('metrics');
    expect(result.metrics).toHaveProperty('psnr');
    expect(result.metrics).toHaveProperty('ssim_avg');

    expect(result).toHaveProperty('artifacts');
    expect(result.artifacts).toHaveProperty('heatmap_path');
  });

  it('should return regions with correct structure', async () => {
    const result = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath
    });

    if (result.regions.length > 0) {
      const region = result.regions[0];
      expect(region).toHaveProperty('id');
      expect(region).toHaveProperty('bbox');
      expect(region).toHaveProperty('score');
      expect(region).toHaveProperty('area_px');
      
      expect(typeof region.id).toBe('string');
      expect(Array.isArray(region.bbox)).toBe(true);
      expect(region.bbox).toHaveLength(4);
      expect(typeof region.score).toBe('number');
      expect(typeof region.area_px).toBe('number');
    }
  });

  it('should generate heatmap artifact', async () => {
    const result = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath
    });

    const heatmapExists = await fs.access(result.artifacts.heatmap_path).then(() => true).catch(() => false);
    expect(heatmapExists).toBe(true);
  });

  it('should filter regions by min_area_px', async () => {
    const resultSmall = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      min_area_px: 1
    });

    const resultLarge = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      min_area_px: 10000
    });

    expect(resultLarge.regions.length).toBeLessThanOrEqual(resultSmall.regions.length);
  });

  it('should throw error for non-existent files', async () => {
    await expect(computeDiffRegions({
      target_path: 'nonexistent.png',
      current_path: currentPath
    })).rejects.toThrow();
  });
});