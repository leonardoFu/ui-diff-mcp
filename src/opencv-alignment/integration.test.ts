import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeDiffWithAlignment } from '../tools/compute-diff-with-alignment.js';
import { createTestImage, translateImage } from '../test-utils/opencv-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('OpenCV Integration Tests', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = path.join(__dirname, '../../test-artifacts/integration');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('End-to-End Pipeline', () => {
    it('should complete full pipeline with alignment for shifted images', async () => {
      const designPath = path.join(testDir, 'design_ui.png');
      const implPath = path.join(testDir, 'impl_ui.png');
      
      // Create realistic UI mockups
      await createTestImage(designPath, 1200, 800, 'ui_mockup');
      await translateImage(designPath, implPath, 30, 20);
      
      const result = await computeDiffWithAlignment({
        target_path: designPath,
        current_path: implPath,
        alignment_method: 'auto',
        pixelmatch_threshold: 0.1,
        min_region_area: 64
      });
      
      // Validate structure
      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('alignment');
      expect(result).toHaveProperty('pixelmatch');
      expect(result).toHaveProperty('ffmpeg_metrics');
      expect(result).toHaveProperty('artifacts');
      expect(result).toHaveProperty('regions');
      
      // Validate alignment was applied
      expect(result.alignment.preprocessing_applied).toBe(true);
      expect(result.alignment.shift_detection.primary_result.dx).toBeCloseTo(30, 1);
      expect(result.alignment.shift_detection.primary_result.dy).toBeCloseTo(20, 0);
      
      // Validate canvas dimensions are reasonable (design-centric: preserves original design dimensions)
      expect(result.canvas.w).toBeGreaterThan(0);
      expect(result.canvas.h).toBeGreaterThan(0);
      // With design-centric alignment, canvas should preserve design dimensions
      expect(result.canvas.w).toBe(1200); // Design dimensions preserved
      expect(result.canvas.h).toBe(800);
      
      // Validate pixelmatch results
      expect(result.pixelmatch.total_pixels).toBe(result.canvas.w * result.canvas.h);
      expect(result.pixelmatch.percentage).toBeGreaterThanOrEqual(0);
      expect(result.pixelmatch.percentage).toBeLessThan(30); // UI mockups may have some visible differences when shifted
      
      // Validate FFmpeg metrics
      expect(result.ffmpeg_metrics.ssim_avg).toBeGreaterThan(0.8); // Good similarity for UI mockups
      expect(result.ffmpeg_metrics.psnr).toBeGreaterThan(10); // Some quality maintained
      
      // Validate artifacts exist
      for (const artifactPath of Object.values(result.artifacts)) {
        await expect(fs.access(artifactPath)).resolves.toBeUndefined();
      }
    }, 30000); // Allow 30s for complete pipeline
    
    it('should handle identical sized images without alignment', async () => {
      const designPath = path.join(testDir, 'design_identical.png');
      const implPath = path.join(testDir, 'impl_identical.png');
      
      // Create identical images
      await createTestImage(designPath, 800, 600, 'features');
      await fs.copyFile(designPath, implPath);
      
      const result = await computeDiffWithAlignment({
        target_path: designPath,
        current_path: implPath,
        disable_alignment: true
      });
      
      // Should have no preprocessing
      expect(result.alignment.preprocessing_applied).toBe(false);
      
      // Should have perfect match
      expect(result.pixelmatch.percentage).toBe(0);
      expect(result.ffmpeg_metrics.ssim_avg).toBeCloseTo(1.0, 2);
      
      // Should have no regions
      expect(result.regions).toHaveLength(0);
    });
    
    it('should handle different sized images gracefully', async () => {
      const designPath = path.join(testDir, 'design_large.png');
      const implPath = path.join(testDir, 'impl_small.png');
      
      await createTestImage(designPath, 1200, 900, 'features');
      await createTestImage(implPath, 800, 600, 'features');
      
      const result = await computeDiffWithAlignment({
        target_path: designPath,
        current_path: implPath,
        alignment_method: 'phase_correlation',
        preserve_design: false // Use old behavior for this specific test
      });
      
      // Should complete without errors
      expect(result).toBeDefined();
      expect(result.canvas.w).toBeLessThanOrEqual(800); // Limited by smaller image (old behavior)
      expect(result.canvas.h).toBeLessThanOrEqual(600);
    });
    
    it('should perform within time limits for realistic UI images', async () => {
      const designPath = path.join(testDir, 'design_1080p.png');
      const implPath = path.join(testDir, 'impl_1080p.png');
      
      // Create realistic 1080p UI images
      await createTestImage(designPath, 1920, 1080, 'ui_mockup');
      await translateImage(designPath, implPath, 15, 25);
      
      const startTime = Date.now();
      
      const result = await computeDiffWithAlignment({
        target_path: designPath,
        current_path: implPath
      });
      
      const duration = Date.now() - startTime;
      
      // Should complete within 7 seconds (allowing for CI overhead and system variations)
      expect(duration).toBeLessThan(7000);
      
      // Should produce valid results
      expect(result.alignment.shift_detection.primary_result.confidence).toBeGreaterThan(0.1);
      expect(result.pixelmatch.total_pixels).toBeGreaterThan(0);
    }, 10000);
    
    it('should maintain accuracy within tolerance requirements', async () => {
      const designPath = path.join(testDir, 'design_accuracy.png');
      const implPath = path.join(testDir, 'impl_accuracy.png');
      
      const expectedDx = 42;
      const expectedDy = 28;
      
      await createTestImage(designPath, 800, 600, 'features');
      await translateImage(designPath, implPath, expectedDx, expectedDy);
      
      const result = await computeDiffWithAlignment({
        target_path: designPath,
        current_path: implPath,
        alignment_method: 'phase_correlation'
      });
      
      const detectedDx = result.alignment.shift_detection.primary_result.dx;
      const detectedDy = result.alignment.shift_detection.primary_result.dy;
      
      // Should be within ±2px tolerance as per requirements
      expect(Math.abs(detectedDx - expectedDx)).toBeLessThanOrEqual(2);
      expect(Math.abs(detectedDy - expectedDy)).toBeLessThanOrEqual(2);
      
      // Should achieve >95% accuracy rating
      const accuracyX = 1 - Math.abs(detectedDx - expectedDx) / Math.max(Math.abs(expectedDx), 1);
      const accuracyY = 1 - Math.abs(detectedDy - expectedDy) / Math.max(Math.abs(expectedDy), 1);
      const overallAccuracy = (accuracyX + accuracyY) / 2;
      
      expect(overallAccuracy).toBeGreaterThan(0.95);
    });
  });
});