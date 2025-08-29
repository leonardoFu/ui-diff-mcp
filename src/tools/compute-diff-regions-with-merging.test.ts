import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computeDiffRegions } from './compute-diff-regions.js';
import { createTestImages } from '../test-utils/image-helpers.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('compute_diff_regions with region merging', () => {
  let testDir: string;
  let targetPath: string;
  let currentPath: string;

  beforeAll(async () => {
    testDir = path.join(process.cwd(), 'test-artifacts', 'compute-diff-regions-merging');
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

  it('should limit regions to max_regions parameter', async () => {
    const resultWith5 = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.0,
      min_area_px: 1,
      max_regions: 5
    });

    const resultWith10 = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.0,
      min_area_px: 1,
      max_regions: 10
    });

    expect(resultWith5.regions.length).toBeLessThanOrEqual(5);
    expect(resultWith10.regions.length).toBeLessThanOrEqual(10);
    expect(resultWith5.regions.length).toBeLessThanOrEqual(resultWith10.regions.length);
  });

  it('should merge regions with similar scores when configured', async () => {
    // Very permissive merging should result in fewer regions
    const permissive = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.0,
      min_area_px: 1,
      merge_score_threshold: 0.5, // Very high threshold
      merge_distance_threshold: 200 // Very high distance
    });

    // Strict merging should result in more regions
    const strict = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.0,
      min_area_px: 1,
      merge_score_threshold: 0.001, // Very low threshold
      merge_distance_threshold: 5 // Very low distance
    });

    expect(permissive.regions.length).toBeLessThanOrEqual(strict.regions.length);
  });

  it('should preserve highest scoring regions when limiting', async () => {
    const result = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.0,
      min_area_px: 1,
      max_regions: 3
    });

    // Should have at most 3 regions
    expect(result.regions.length).toBeLessThanOrEqual(3);
    
    // Regions should be sorted by score (highest first)
    if (result.regions.length > 1) {
      for (let i = 0; i < result.regions.length - 1; i++) {
        expect(result.regions[i].score).toBeGreaterThanOrEqual(result.regions[i + 1].score);
      }
    }
  });

  it('should maintain backward compatibility with default parameters', async () => {
    const result = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath
    });

    // Should have default max_regions of 20
    expect(result.regions.length).toBeLessThanOrEqual(20);
    
    // Should maintain same structure as before
    expect(result).toHaveProperty('canvas');
    expect(result).toHaveProperty('regions');
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('artifacts');
  });

  it('should handle merged region structure correctly', async () => {
    const result = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.0,
      min_area_px: 1,
      merge_score_threshold: 0.2,
      merge_distance_threshold: 100
    });

    // Check that merged regions have correct structure
    result.regions.forEach(region => {
      expect(region).toHaveProperty('id');
      expect(region).toHaveProperty('bbox');
      expect(region).toHaveProperty('score');
      expect(region).toHaveProperty('area_px');
      
      expect(typeof region.id).toBe('string');
      expect(Array.isArray(region.bbox)).toBe(true);
      expect(region.bbox).toHaveLength(4);
      expect(typeof region.score).toBe('number');
      expect(typeof region.area_px).toBe('number');
      expect(region.score).toBeGreaterThan(0);
      expect(region.score).toBeLessThanOrEqual(1);
    });
  });
});