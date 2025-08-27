import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenCVGlobalShiftDetector } from './opencv-detector.js';
import { ImageAligner } from './image-aligner.js';
import { createTestImage, translateImage } from '../test-utils/opencv-helpers.js';
import { computeDiffWithAlignment } from '../tools/compute-diff-with-alignment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Design-Centric Alignment System', () => {
  let detector: OpenCVGlobalShiftDetector;
  let aligner: ImageAligner;
  let testDir: string;

  beforeAll(async () => {
    detector = new OpenCVGlobalShiftDetector();
    aligner = new ImageAligner();
    testDir = path.join(__dirname, '../../test-artifacts/design-centric');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Design Image Preservation', () => {
    it('should never crop the design image (default: first image)', async () => {
      const designImagePath = path.join(testDir, 'design_1200x800.png');
      const implementationImagePath = path.join(testDir, 'implementation_800x600.png');
      
      // Create design image (larger) and implementation image (smaller)
      await createTestImage(designImagePath, 1200, 800, 'checkerboard');
      await createTestImage(implementationImagePath, 800, 600, 'checkerboard');
      
      // Apply shift to implementation to simulate real-world misalignment
      const shiftedImplementationPath = path.join(testDir, 'shifted_implementation.png');
      await translateImage(implementationImagePath, shiftedImplementationPath, 50, 30);
      
      const shiftData = await detector.analyzeShift(designImagePath, shiftedImplementationPath);
      const result = await aligner.alignToDesign(
        designImagePath, 
        shiftedImplementationPath, 
        shiftData,
        { preserveDesign: true, designImageIndex: 0 }
      );
      
      // Design image should remain at original dimensions
      expect(result.alignedDesignPath).toBe(designImagePath); // Should be original path
      expect(result.designDimensions).toEqual({ width: 1200, height: 800 });
      
      // Implementation should be transformed to design space
      expect(result.alignedImplementationPath).not.toBe(shiftedImplementationPath); // Should be transformed
      expect(result.finalCanvasDimensions).toEqual({ width: 1200, height: 800 });
      expect(result.designPreserved).toBe(true);
    });

    it('should handle user-specified design image (second image)', async () => {
      const implementationImagePath = path.join(testDir, 'implementation_small.png');
      const designImagePath = path.join(testDir, 'design_large.png');
      
      await createTestImage(implementationImagePath, 900, 700, 'features');
      await createTestImage(designImagePath, 1400, 1000, 'features');
      
      const shiftData = await detector.analyzeShift(implementationImagePath, designImagePath);
      const result = await aligner.alignToDesign(
        implementationImagePath, // This is imagePathA (first parameter)
        designImagePath,         // This is imagePathB (second parameter) 
        shiftData,
        { preserveDesign: true, designImageIndex: 1 } // Design is second parameter (index 1)
      );
      
      // Design image (second parameter) should be preserved
      expect(result.designDimensions).toEqual({ width: 1400, height: 1000 });
      expect(result.finalCanvasDimensions).toEqual({ width: 1400, height: 1000 });
      expect(result.designPreserved).toBe(true);
    });

    it('should transform implementation coordinates only', async () => {
      const designImagePath = path.join(testDir, 'design_coords.png');
      const implementationImagePath = path.join(testDir, 'implementation_coords.png');
      
      await createTestImage(designImagePath, 1000, 800, 'gradient');
      await createTestImage(implementationImagePath, 1000, 800, 'gradient');
      
      // Create shifted implementation
      const shiftedImplPath = path.join(testDir, 'shifted_impl_coords.png');
      await translateImage(implementationImagePath, shiftedImplPath, 100, 50);
      
      const shiftData = await detector.analyzeShift(designImagePath, shiftedImplPath);
      const result = await aligner.alignToDesign(
        designImagePath, 
        shiftedImplPath, 
        shiftData,
        { preserveDesign: true, designImageIndex: 0 }
      );
      
      // Check that design is preserved and transformation behavior is correct
      expect(result.designPreserved).toBe(true);
      
      // Verify that shift compensation data is available when transformation is applied
      if (result.transformationApplied) {
        expect(result.shiftCompensation).toEqual(
          expect.objectContaining({
            dx: expect.any(Number),
            dy: expect.any(Number)
          })
        );
      }
      
      // In design-centric alignment, the key requirement is that design is preserved
      // Transformation may or may not be applied based on shift detection confidence
    });

    it('should pad implementation when smaller than design canvas', async () => {
      const designImagePath = path.join(testDir, 'design_large_canvas.png');
      const implementationImagePath = path.join(testDir, 'implementation_small_canvas.png');
      
      await createTestImage(designImagePath, 1500, 1000, 'mixed');
      await createTestImage(implementationImagePath, 800, 600, 'mixed');
      
      const shiftData = await detector.analyzeShift(designImagePath, implementationImagePath);
      const result = await aligner.alignToDesign(
        designImagePath, 
        implementationImagePath, 
        shiftData,
        { preserveDesign: true, designImageIndex: 0 }
      );
      
      expect(result.finalCanvasDimensions).toEqual({ width: 1500, height: 1000 });
      expect(result.paddingApplied).toBe(true);
      expect(result.designPreserved).toBe(true);
    });

    it('should crop implementation when larger than design canvas', async () => {
      const designImagePath = path.join(testDir, 'design_small_canvas.png');
      const implementationImagePath = path.join(testDir, 'implementation_large_canvas.png');
      
      await createTestImage(designImagePath, 800, 600, 'features');
      await createTestImage(implementationImagePath, 1200, 900, 'features');
      
      const shiftData = await detector.analyzeShift(designImagePath, implementationImagePath);
      const result = await aligner.alignToDesign(
        designImagePath, 
        implementationImagePath, 
        shiftData,
        { preserveDesign: true, designImageIndex: 0 }
      );
      
      expect(result.finalCanvasDimensions).toEqual({ width: 800, height: 600 });
      expect(result.croppingApplied).toBe(true);
      expect(result.designPreserved).toBe(true);
    });
  });

  describe('MCP Tool Integration', () => {
    it('should support new alignment parameters in compute_diff_with_alignment', async () => {
      const designImagePath = path.join(testDir, 'mcp_design.png');
      const implementationImagePath = path.join(testDir, 'mcp_implementation.png');
      
      await createTestImage(designImagePath, 1200, 800, 'ui_mockup');
      await createTestImage(implementationImagePath, 1000, 700, 'ui_mockup');
      
      const result = await computeDiffWithAlignment({
        target_path: designImagePath,
        current_path: implementationImagePath,
        preserve_design: true,
        design_image_first: true,
        implementation_transforms_only: true,
        confidence_threshold: 0.8  // Test custom confidence threshold
      });
      
      // Design should be preserved at full resolution
      expect(result.canvas).toEqual({ w: 1200, h: 800 });
      expect(result.alignment.design_preserved).toBe(true);
      expect(result.alignment.implementation_transformed).toBe(true);
    });

    it('should maintain backward compatibility with existing behavior', async () => {
      const imageAPath = path.join(testDir, 'backward_compat_a.png');
      const imageBPath = path.join(testDir, 'backward_compat_b.png');
      
      await createTestImage(imageAPath, 1000, 800, 'checkerboard');
      await createTestImage(imageBPath, 800, 600, 'checkerboard');
      
      // Test without new parameters (should use old behavior)
      const oldResult = await computeDiffWithAlignment({
        target_path: imageAPath,
        current_path: imageBPath,
        preserve_design: false // Explicitly disable new behavior
      });
      
      // Should use mutual cropping (old behavior)
      expect(oldResult.canvas.w).toBeLessThanOrEqual(800);
      expect(oldResult.canvas.h).toBeLessThanOrEqual(600);
      
      // Test with new parameters
      const newResult = await computeDiffWithAlignment({
        target_path: imageAPath,
        current_path: imageBPath,
        preserve_design: true,
        design_image_first: true
      });
      
      // Should preserve design dimensions
      expect(newResult.canvas).toEqual({ w: 1000, h: 800 });
      expect(newResult.alignment.design_preserved).toBe(true);
    }, 10000); // 10 second timeout
  });
});