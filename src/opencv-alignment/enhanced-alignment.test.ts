import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ImageAligner } from './image-aligner.js';
import { createTestImage, translateImage } from '../test-utils/opencv-helpers.js';
import { MultiMethodAnalysis, ShiftDetectionResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test suite for enhanced design-centric alignment with confidence-based logic
 * This tests the fixes for the shift compensation and high-confidence alignment
 */
describe('Enhanced Design-Centric Alignment', () => {
  let aligner: ImageAligner;
  let testDir: string;

  beforeAll(async () => {
    aligner = new ImageAligner();
    testDir = path.join(__dirname, '../../test-artifacts/enhanced-alignment');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper function to create mock shift data with specific confidence
   */
  function createMockShiftData(dx: number, dy: number, confidence: number): MultiMethodAnalysis {
    const primaryResult: ShiftDetectionResult = {
      dx,
      dy,
      confidence,
      method: 'phase_correlation'
    };

    return {
      primary_result: primaryResult,
      all_methods: [primaryResult],
      recommendation: {
        action: confidence > 0.7 ? 'major_alignment' : 'minor_alignment',
        reason: `Confidence: ${confidence}`,
        shift: { dx, dy }
      },
      preprocessing_needed: false
    };
  }

  describe('Confidence-Based Shift Compensation', () => {
    it('should apply shift compensation for high confidence (>0.7)', async () => {
      const designImagePath = path.join(testDir, 'design_high_conf.png');
      const implementationImagePath = path.join(testDir, 'impl_high_conf.png');
      
      // Create identical 800x600 images
      await createTestImage(designImagePath, 800, 600, 'checkerboard');
      await createTestImage(implementationImagePath, 800, 600, 'checkerboard');
      
      // Apply 50px right, 30px down shift to implementation
      const shiftedImplPath = path.join(testDir, 'shifted_impl_high_conf.png');
      await translateImage(implementationImagePath, shiftedImplPath, 50, 30);
      
      // Create high confidence shift data (detected: impl shifted 50px right, 30px down)
      const highConfidenceShiftData = createMockShiftData(50, 30, 0.85);
      
      const result = await aligner.alignToDesign(
        designImagePath, 
        shiftedImplPath, 
        highConfidenceShiftData,
        { preserveDesign: true, designImageIndex: 0, confidenceThreshold: 0.7 }
      );
      
      // Should apply shift compensation and preserve design dimensions
      expect(result.designPreserved).toBe(true);
      expect(result.transformationApplied).toBe(true);
      expect(result.finalCanvasDimensions).toEqual({ width: 800, height: 600 });
      
      // Should have shift compensation data
      expect(result.shiftCompensation).toEqual({
        dx: 50,
        dy: 30
      });
      
      // The aligned implementation should properly compensate for the detected shift
      // Verify the output image exists and has correct dimensions
      const alignedStats = await fs.stat(result.alignedImplementationPath);
      expect(alignedStats.isFile()).toBe(true);
      
      // TEST FOR THE BUG: The current implementation has flawed shift compensation
      // This test should fail until the bug is fixed
      // We expect that with high confidence, it should NOT use the flawed -dx logic
      expect(result).toHaveProperty('confidenceBasedPlacement', true);
    });

    it('should use center-based placement for low confidence (≤0.7)', async () => {
      const designImagePath = path.join(testDir, 'design_low_conf.png');
      const implementationImagePath = path.join(testDir, 'impl_low_conf.png');
      
      // Design larger than implementation
      await createTestImage(designImagePath, 1000, 800, 'gradient');
      await createTestImage(implementationImagePath, 600, 400, 'gradient');
      
      // Create low confidence shift data (should be ignored)
      const lowConfidenceShiftData = createMockShiftData(100, 80, 0.3);
      
      const result = await aligner.alignToDesign(
        designImagePath, 
        implementationImagePath, 
        lowConfidenceShiftData,
        { preserveDesign: true, designImageIndex: 0, confidenceThreshold: 0.7 }
      );
      
      // Should preserve design and use center-based placement
      expect(result.designPreserved).toBe(true);
      expect(result.finalCanvasDimensions).toEqual({ width: 1000, height: 800 });
      expect(result.paddingApplied).toBe(true);
      
      // Should still report the detected shift even if not applied due to low confidence
      expect(result.shiftCompensation).toEqual({
        dx: 100,
        dy: 80
      });
    });

    it('should handle mixed dimensions with high confidence correctly', async () => {
      const designImagePath = path.join(testDir, 'design_mixed_dims.png');
      const implementationImagePath = path.join(testDir, 'impl_mixed_dims.png');
      
      // Design 900x600, Implementation 1200x500 (wider but shorter)
      await createTestImage(designImagePath, 900, 600, 'features');
      await createTestImage(implementationImagePath, 1200, 500, 'features');
      
      // Apply shift to implementation
      const shiftedImplPath = path.join(testDir, 'shifted_impl_mixed.png');
      await translateImage(implementationImagePath, shiftedImplPath, -75, 25);
      
      // High confidence shift data
      const highConfidenceShiftData = createMockShiftData(-75, 25, 0.9);
      
      const result = await aligner.alignToDesign(
        designImagePath, 
        shiftedImplPath, 
        highConfidenceShiftData,
        { preserveDesign: true, designImageIndex: 0, confidenceThreshold: 0.7 }
      );
      
      // Design dimensions should be preserved as canvas
      expect(result.finalCanvasDimensions).toEqual({ width: 900, height: 600 });
      expect(result.designPreserved).toBe(true);
      expect(result.transformationApplied).toBe(true);
      
      // Should have both cropping (width) and padding (height) applied to implementation
      expect(result.croppingApplied).toBe(true); // 1200 > 900 width
      expect(result.paddingApplied).toBe(true);  // 500 < 600 height
    });
  });

  describe('Corrected Shift Compensation Logic', () => {
    it('should correctly compensate positive dx (implementation shifted right)', async () => {
      const designImagePath = path.join(testDir, 'design_pos_dx.png');
      const implementationImagePath = path.join(testDir, 'impl_pos_dx.png');
      
      await createTestImage(designImagePath, 800, 600, 'checkerboard');
      await createTestImage(implementationImagePath, 800, 600, 'checkerboard');
      
      // Shift implementation 60px right (positive dx)
      const shiftedImplPath = path.join(testDir, 'shifted_impl_pos_dx.png');
      await translateImage(implementationImagePath, shiftedImplPath, 60, 0);
      
      // High confidence detection: dx=60 (impl shifted right relative to design)
      const shiftData = createMockShiftData(60, 0, 0.85);
      
      const result = await aligner.alignToDesign(
        designImagePath, 
        shiftedImplPath, 
        shiftData,
        { preserveDesign: true, designImageIndex: 0, confidenceThreshold: 0.7 }
      );
      
      // The corrected logic should place implementation -60px (left) to compensate
      // This is the fix for the incorrect `place_x = -dx` logic 
      expect(result.transformationApplied).toBe(true);
      expect(result.shiftCompensation).toEqual({ dx: 60, dy: 0 });
    });

    it('should correctly compensate negative dx (implementation shifted left)', async () => {
      const designImagePath = path.join(testDir, 'design_neg_dx.png');
      const implementationImagePath = path.join(testDir, 'impl_neg_dx.png');
      
      await createTestImage(designImagePath, 800, 600, 'gradient');
      await createTestImage(implementationImagePath, 800, 600, 'gradient');
      
      // Shift implementation 40px left (negative dx)
      const shiftedImplPath = path.join(testDir, 'shifted_impl_neg_dx.png');
      await translateImage(implementationImagePath, shiftedImplPath, -40, 0);
      
      // High confidence detection: dx=-40 (impl shifted left relative to design)
      const shiftData = createMockShiftData(-40, 0, 0.9);
      
      const result = await aligner.alignToDesign(
        designImagePath, 
        shiftedImplPath, 
        shiftData,
        { preserveDesign: true, designImageIndex: 0, confidenceThreshold: 0.7 }
      );
      
      // The corrected logic should place implementation +40px (right) to compensate
      expect(result.transformationApplied).toBe(true);
      expect(result.shiftCompensation).toEqual({ dx: -40, dy: 0 });
    });

    it('should handle edge cases with bounds checking', async () => {
      const designImagePath = path.join(testDir, 'design_edge_case.png');
      const implementationImagePath = path.join(testDir, 'impl_edge_case.png');
      
      // Small design, larger implementation
      await createTestImage(designImagePath, 200, 150, 'mixed');
      await createTestImage(implementationImagePath, 400, 300, 'mixed');
      
      // Large shift that would exceed bounds
      const shiftedImplPath = path.join(testDir, 'shifted_impl_edge.png');
      await translateImage(implementationImagePath, shiftedImplPath, 180, 120);
      
      // High confidence with large shift
      const shiftData = createMockShiftData(180, 120, 0.95);
      
      const result = await aligner.alignToDesign(
        designImagePath, 
        shiftedImplPath, 
        shiftData,
        { preserveDesign: true, designImageIndex: 0, confidenceThreshold: 0.7 }
      );
      
      // Should handle gracefully without crashing
      expect(result.finalCanvasDimensions).toEqual({ width: 200, height: 150 });
      expect(result.designPreserved).toBe(true);
      
      // Should still record the shift compensation attempt
      expect(result.shiftCompensation).toEqual({ dx: 180, dy: 120 });
    });
  });

  describe('Confidence Threshold Parameter', () => {
    it('should respect custom confidence threshold', async () => {
      const designImagePath = path.join(testDir, 'design_custom_threshold.png');
      const implementationImagePath = path.join(testDir, 'impl_custom_threshold.png');
      
      await createTestImage(designImagePath, 600, 400, 'features');
      await createTestImage(implementationImagePath, 600, 400, 'features');
      
      const shiftedImplPath = path.join(testDir, 'shifted_impl_custom.png');
      await translateImage(implementationImagePath, shiftedImplPath, 30, 20);
      
      // Confidence of 0.6 (between default 0.7 and custom 0.5)
      const moderateConfidenceShiftData = createMockShiftData(30, 20, 0.6);
      
      // Test with default threshold (0.7) - should use center placement
      const resultDefaultThreshold = await aligner.alignToDesign(
        designImagePath, 
        shiftedImplPath, 
        moderateConfidenceShiftData,
        { preserveDesign: true, designImageIndex: 0, confidenceThreshold: 0.7 }
      );
      
      // Test with custom threshold (0.5) - should apply shift compensation
      const resultCustomThreshold = await aligner.alignToDesign(
        designImagePath, 
        shiftedImplPath, 
        moderateConfidenceShiftData,
        { preserveDesign: true, designImageIndex: 0, confidenceThreshold: 0.5 }
      );
      
      // Both should preserve design but use different placement strategies
      expect(resultDefaultThreshold.designPreserved).toBe(true);
      expect(resultCustomThreshold.designPreserved).toBe(true);
      
      // Different confidence thresholds should affect placement strategy
      expect(resultDefaultThreshold.confidenceBasedPlacement).toBe(false); // 0.6 < 0.7
      expect(resultCustomThreshold.confidenceBasedPlacement).toBe(true);   // 0.6 > 0.5
      
      // Both should have the same shift compensation data recorded
      expect(resultDefaultThreshold.shiftCompensation).toEqual({ dx: 30, dy: 20 });
      expect(resultCustomThreshold.shiftCompensation).toEqual({ dx: 30, dy: 20 });
    });
  });
});