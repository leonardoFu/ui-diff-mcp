import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computeDiffRegions } from '../tools/compute-diff-regions.js';
import { computeDiffWithAlignment } from '../tools/compute-diff-with-alignment.js';
import { createTestImages } from '../test-utils/image-helpers.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Region Merging Integration Tests', () => {
  let testDir: string;
  let targetPath: string;
  let currentPath: string;

  beforeAll(async () => {
    testDir = path.join(process.cwd(), 'test-artifacts', 'region-merging-integration');
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

  describe('End-to-end region merging workflow', () => {
    it('should demonstrate complete region merging pipeline', async () => {
      // Test with very permissive settings to force merging
      const result = await computeDiffRegions({
        target_path: targetPath,
        current_path: currentPath,
        threshold: 0.0,
        min_area_px: 1,
        max_regions: 5,
        merge_score_threshold: 0.3,
        merge_distance_threshold: 100
      });

      // Validate the complete response structure
      expect(result).toMatchObject({
        canvas: {
          w: expect.any(Number),
          h: expect.any(Number)
        },
        regions: expect.any(Array),
        metrics: {
          psnr: expect.any(Number),
          ssim_avg: expect.any(Number)
        },
        artifacts: {
          heatmap_path: expect.any(String)
        }
      });

      // Should respect max_regions limit
      expect(result.regions.length).toBeLessThanOrEqual(5);
      
      // All regions should be valid
      result.regions.forEach(region => {
        expect(region.id).toBeDefined();
        expect(region.bbox).toHaveLength(4);
        expect(region.score).toBeGreaterThan(0);
        expect(region.score).toBeLessThanOrEqual(1);
        expect(region.area_px).toBeGreaterThan(0);
        
        // Check bbox values are reasonable
        const [x, y, w, h] = region.bbox;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
      });

      // Verify artifacts exist
      const heatmapExists = await fs.access(result.artifacts.heatmap_path)
        .then(() => true)
        .catch(() => false);
      expect(heatmapExists).toBe(true);
    });

    it('should work with compute_diff_with_alignment integration', async () => {
      const result = await computeDiffWithAlignment({
        target_path: targetPath,
        current_path: currentPath,
        disable_alignment: true, // Disable for simpler test
        max_regions: 3,
        merge_score_threshold: 0.1,
        merge_distance_threshold: 50,
        min_region_area: 10
      });

      // Should have enhanced diff result structure
      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('alignment');
      expect(result).toHaveProperty('pixelmatch');
      expect(result).toHaveProperty('ffmpeg_metrics');
      expect(result).toHaveProperty('artifacts');
      expect(result).toHaveProperty('regions');

      // Should respect region limits
      expect(result.regions.length).toBeLessThanOrEqual(3);
      
      // Should have valid alignment info
      expect(result.alignment).toHaveProperty('preprocessing_applied');
      expect(result.alignment).toHaveProperty('shift_detection');
      
      // Should have pixelmatch results
      expect(result.pixelmatch).toHaveProperty('total_pixels');
      expect(result.pixelmatch).toHaveProperty('diff_pixels');
      expect(result.pixelmatch).toHaveProperty('percentage');
      
      // Should have FFmpeg metrics
      expect(result.ffmpeg_metrics).toHaveProperty('ssim_avg');
      expect(result.ffmpeg_metrics).toHaveProperty('psnr');
    });

    it('should demonstrate performance optimization with large region counts', async () => {
      // Create a baseline with no merging limits
      const unoptimized = await computeDiffRegions({
        target_path: targetPath,
        current_path: currentPath,
        threshold: 0.0,
        min_area_px: 1,
        max_regions: 1000, // Very high limit
        merge_score_threshold: 0.001, // Very strict merging
        merge_distance_threshold: 1 // Very strict distance
      });

      // Create optimized version with aggressive merging
      const optimized = await computeDiffRegions({
        target_path: targetPath,
        current_path: currentPath,
        threshold: 0.0,
        min_area_px: 1,
        max_regions: 10, // Limited output
        merge_score_threshold: 0.2, // Aggressive merging
        merge_distance_threshold: 100 // Generous distance
      });

      // Optimized should have fewer regions
      expect(optimized.regions.length).toBeLessThanOrEqual(10);
      expect(optimized.regions.length).toBeLessThanOrEqual(unoptimized.regions.length);
      
      // Both should maintain same metrics quality
      expect(optimized.metrics.psnr).toBeDefined();
      expect(optimized.metrics.ssim_avg).toBeDefined();
      expect(unoptimized.metrics.psnr).toBeDefined();
      expect(unoptimized.metrics.ssim_avg).toBeDefined();
    });

    it('should handle edge cases gracefully', async () => {
      // Test with very restrictive settings
      const minimal = await computeDiffRegions({
        target_path: targetPath,
        current_path: currentPath,
        threshold: 0.0,
        min_area_px: 1,
        max_regions: 1, // Only one region
        merge_score_threshold: 1.0, // Merge everything
        merge_distance_threshold: 10000 // Merge everything
      });

      expect(minimal.regions.length).toBeLessThanOrEqual(1);
      
      // Test with no merging
      const noMerging = await computeDiffRegions({
        target_path: targetPath,
        current_path: currentPath,
        threshold: 0.0,
        min_area_px: 1,
        max_regions: 20,
        merge_score_threshold: 0.0, // No merging by score
        merge_distance_threshold: 0 // No merging by distance
      });

      // Should still respect max_regions limit
      expect(noMerging.regions.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Backward compatibility validation', () => {
    it('should maintain exact compatibility with legacy API calls', async () => {
      // Call without any merging parameters (should use defaults)
      const legacy = await computeDiffRegions({
        target_path: targetPath,
        current_path: currentPath,
        threshold: 0.1,
        min_area_px: 64
      });

      // Should work exactly as before
      expect(legacy).toHaveProperty('canvas');
      expect(legacy).toHaveProperty('regions');
      expect(legacy).toHaveProperty('metrics');
      expect(legacy).toHaveProperty('artifacts');
      
      // Should use default max_regions of 20
      expect(legacy.regions.length).toBeLessThanOrEqual(20);
      
      // Each region should have the expected structure
      if (legacy.regions.length > 0) {
        const region = legacy.regions[0];
        expect(region).toHaveProperty('id');
        expect(region).toHaveProperty('bbox');
        expect(region).toHaveProperty('score');
        expect(region).toHaveProperty('area_px');
        expect(region.bbox).toHaveLength(4);
      }
    });
  });
});