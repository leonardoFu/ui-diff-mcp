import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computeDiffWithAlignment } from './compute-diff-with-alignment.js';
import { createTestImages } from '../test-utils/image-helpers.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('compute_diff_with_alignment with region merging', () => {
  let testDir: string;
  let targetPath: string;
  let currentPath: string;

  beforeAll(async () => {
    testDir = path.join(process.cwd(), 'test-artifacts', 'compute-diff-alignment-merging');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test images
    const { target, current } = await createTestImages();
    targetPath = path.join(testDir, 'target.png');
    currentPath = path.join(testDir, 'current.png');
    
    await fs.writeFile(targetPath, target);
    await fs.writeFile(currentPath, current);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should integrate region merging with alignment processing', async () => {
    const result = await computeDiffWithAlignment({
      target_path: targetPath,
      current_path: currentPath,
      disable_alignment: true, // Disable alignment for simpler test
      max_regions: 5,
      merge_score_threshold: 0.1,
      merge_distance_threshold: 50
    });

    // Should have the complete enhanced diff result structure
    expect(result).toHaveProperty('canvas');
    expect(result).toHaveProperty('alignment');
    expect(result).toHaveProperty('pixelmatch');
    expect(result).toHaveProperty('ffmpeg_metrics');
    expect(result).toHaveProperty('artifacts');
    expect(result).toHaveProperty('regions');
    
    // Should respect max_regions limit
    expect(result.regions.length).toBeLessThanOrEqual(5);
  });

  it('should pass merging parameters correctly to compute_diff_regions', async () => {
    const restrictive = await computeDiffWithAlignment({
      target_path: targetPath,
      current_path: currentPath,
      disable_alignment: true,
      max_regions: 3,
      merge_score_threshold: 0.01,
      merge_distance_threshold: 10
    });

    const permissive = await computeDiffWithAlignment({
      target_path: targetPath,
      current_path: currentPath,
      disable_alignment: true,
      max_regions: 10,
      merge_score_threshold: 0.3,
      merge_distance_threshold: 100
    });

    // Should respect the max_regions limits
    expect(restrictive.regions.length).toBeLessThanOrEqual(3);
    expect(permissive.regions.length).toBeLessThanOrEqual(10);
    
    // Both should return valid regions with proper structure
    expect(Array.isArray(restrictive.regions)).toBe(true);
    expect(Array.isArray(permissive.regions)).toBe(true);
  });

  it('should maintain backward compatibility with default merging parameters', async () => {
    const result = await computeDiffWithAlignment({
      target_path: targetPath,
      current_path: currentPath,
      disable_alignment: true
    });

    // Should use default max_regions of 20
    expect(result.regions.length).toBeLessThanOrEqual(20);
    
    // Should maintain the same result structure
    expect(result).toHaveProperty('regions');
    expect(Array.isArray(result.regions)).toBe(true);
  });
});