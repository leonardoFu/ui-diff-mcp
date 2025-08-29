/**
 * Enhanced MCP tool for UI diff comparison with OpenCV alignment
 */
import { promises as fs } from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { OpenCVGlobalShiftDetector } from '../opencv-alignment/opencv-detector.js';
import { ImageAligner } from '../opencv-alignment/image-aligner.js';
import { EnhancedDiffResult } from '../opencv-alignment/types.js';
import { scoreGlobal } from './score-global.js';
import { renderOverlay } from './render-overlay.js';
import { computeDiffRegions } from './compute-diff-regions.js';

export interface ComputeDiffWithAlignmentInput {
  target_path: string;
  current_path: string;
  alignment_method?: 'auto' | 'phase_correlation' | 'ecc' | 'feature_matching';
  pixelmatch_threshold?: number;
  min_region_area?: number;
  disable_alignment?: boolean;
  
  // Region merging options
  max_regions?: number;
  merge_score_threshold?: number;
  merge_distance_threshold?: number;
  
  // NEW: Design-centric alignment parameters
  /** 
   * Never crop the design image (default: true) 
   * When true, design image dimensions are preserved and implementation is transformed to fit
   * When false, uses legacy mutual cropping behavior for backward compatibility
   */
  preserve_design?: boolean;
  
  /** 
   * Which image is the design reference (default: true) 
   * When true, target_path is treated as the design image
   * When false, current_path is treated as the design image
   */
  design_image_first?: boolean;
  
  /** 
   * Only transform implementation image (default: true) 
   * When true, only the implementation image is transformed/padded/cropped
   * When false, both images may be modified (legacy behavior)
   */
  implementation_transforms_only?: boolean;
  
  /**
   * Confidence threshold for applying shift compensation (default: 0.7)
   * Shift compensation is only applied when detection confidence is above this threshold
   * Lower confidence uses center-based placement for stability
   */
  confidence_threshold?: number;
}

/**
 * Pixelmatch comparison wrapper
 */
class PixelmatchComparator {
  async compareAligned(
    alignedImgA: Buffer,
    alignedImgB: Buffer,
    options: {
      threshold?: number;
      includeAA?: boolean;
      alpha?: number;
      aaColor?: [number, number, number];
      diffColor?: [number, number, number];
    } = {}
  ): Promise<{
    totalPixels: number;
    diffPixels: number;
    percentage: number;
    diffImageBuffer: Buffer;
    threshold: number;
  }> {
    const img1 = PNG.sync.read(alignedImgA);
    const img2 = PNG.sync.read(alignedImgB);

    if (img1.width !== img2.width || img1.height !== img2.height) {
      throw new Error(
        `Image dimensions must match: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`
      );
    }

    const diff = new PNG({ width: img1.width, height: img1.height });

    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      img1.width,
      img1.height,
      {
        threshold: options.threshold ?? 0.1,
        includeAA: options.includeAA ?? false,
        alpha: options.alpha ?? 0.1,
        aaColor: options.aaColor ?? [255, 255, 0],
        diffColor: options.diffColor ?? [255, 0, 0]
      }
    );

    const totalPixels = img1.width * img1.height;
    const percentage = (numDiffPixels / totalPixels) * 100;
    const diffImageBuffer = PNG.sync.write(diff);

    return {
      totalPixels,
      diffPixels: numDiffPixels,
      percentage,
      diffImageBuffer,
      threshold: options.threshold ?? 0.1
    };
  }
}

/**
 * Compute UI diff with OpenCV alignment preprocessing
 */
export async function computeDiffWithAlignment(
  input: ComputeDiffWithAlignmentInput
): Promise<EnhancedDiffResult> {
  const {
    target_path,
    current_path,
    alignment_method = 'auto',
    pixelmatch_threshold = 0.1,
    min_region_area = 64,
    disable_alignment = false,
    // NEW: Design-centric alignment parameters
    preserve_design = true,
    design_image_first = true,
    implementation_transforms_only = true,
    confidence_threshold = 0.7,
    // Region merging options
    max_regions = 20,
    merge_score_threshold = 0.05,
    merge_distance_threshold = 50
  } = input;

  try {
    // Verify input files exist
    await fs.access(target_path);
    await fs.access(current_path);

    let alignedTargetPath = target_path;
    let alignedCurrentPath = current_path;
    let shiftAnalysis = null;
    let alignmentResult = null;
    let designCentricResult = null;
    let preprocessingApplied = false;
    let designPreserved = false;
    let implementationTransformed = false;

    // Step 1: Detect global shift (unless disabled)
    if (!disable_alignment) {
      const detector = new OpenCVGlobalShiftDetector({
        methods: [
          { name: 'phase_correlation', enabled: alignment_method === 'auto' || alignment_method === 'phase_correlation', confidenceThreshold: 0.1 },
          { name: 'ecc_registration', enabled: alignment_method === 'auto' || alignment_method === 'ecc', confidenceThreshold: 0.3 },
          { name: 'feature_matching', enabled: alignment_method === 'auto' || alignment_method === 'feature_matching', confidenceThreshold: 0.2 }
        ]
      });

      shiftAnalysis = await detector.analyzeShift(target_path, current_path);

      // Step 2: Choose alignment strategy
      const aligner = new ImageAligner({
        tempDir: path.join(process.cwd(), 'test-artifacts')
      });

      if (preserve_design && implementation_transforms_only) {
        // NEW: Design-centric alignment
        designCentricResult = await aligner.alignToDesign(
          target_path,
          current_path,
          shiftAnalysis,
          {
            preserveDesign: preserve_design,
            designImageIndex: design_image_first ? 0 : 1,
            confidenceThreshold: confidence_threshold
          }
        );

        alignedTargetPath = designCentricResult.alignedDesignPath;
        alignedCurrentPath = designCentricResult.alignedImplementationPath;
        preprocessingApplied = designCentricResult.transformationApplied;
        designPreserved = designCentricResult.designPreserved;
        implementationTransformed = designCentricResult.transformationApplied;
      } else {
        // OLD: Mutual cropping alignment (backward compatibility)
        alignmentResult = await aligner.alignAndCrop(
          target_path,
          current_path,
          shiftAnalysis
        );

        alignedTargetPath = alignmentResult.alignedImageA;
        alignedCurrentPath = alignmentResult.alignedImageB;
        preprocessingApplied = alignmentResult.alignmentApplied;
      }
    }

    // Step 3: Pixelmatch comparison on aligned images
    const comparator = new PixelmatchComparator();
    const alignedTargetBuffer = await fs.readFile(alignedTargetPath);
    const alignedCurrentBuffer = await fs.readFile(alignedCurrentPath);

    const pixelmatchResult = await comparator.compareAligned(
      alignedTargetBuffer,
      alignedCurrentBuffer,
      { threshold: pixelmatch_threshold }
    );

    // Step 4: Save pixelmatch diff
    const timestamp = Date.now();
    const pixelmatchDiffPath = path.join(
      process.cwd(),
      'test-artifacts',
      `pixelmatch_diff_${timestamp}.png`
    );
    await fs.writeFile(pixelmatchDiffPath, pixelmatchResult.diffImageBuffer);

    // Step 5: FFmpeg metrics on aligned images
    const ffmpegMetrics = await scoreGlobal({
      target_path: alignedTargetPath,
      current_path: alignedCurrentPath
    });

    // Step 6: Region extraction using existing compute_diff_regions
    const regionsResult = await computeDiffRegions({
      target_path: alignedTargetPath,
      current_path: alignedCurrentPath,
      threshold: 0.0,
      min_area_px: min_region_area,
      max_regions,
      merge_score_threshold,
      merge_distance_threshold
    });

    // Step 7: Create overlay visualization
    const overlayPath = await renderOverlay({
      current_path: alignedCurrentPath,
      regions: regionsResult.regions
    });

    // Get final canvas dimensions with proper type handling
    const canvasDimensions = designCentricResult?.finalCanvasDimensions || alignmentResult?.croppedDimensions || regionsResult.canvas;
    const finalWidth = 'w' in canvasDimensions ? canvasDimensions.w : canvasDimensions.width;
    const finalHeight = 'h' in canvasDimensions ? canvasDimensions.h : canvasDimensions.height;

    return {
      canvas: {
        w: finalWidth,
        h: finalHeight
      },
      alignment: {
        shift_detection: shiftAnalysis || {
          primary_result: { dx: 0, dy: 0, confidence: 0, method: 'none' as any },
          all_methods: [],
          recommendation: { action: 'no_alignment', reason: 'Alignment disabled' },
          preprocessing_needed: false
        },
        preprocessing_applied: preprocessingApplied,
        cropped_dimensions: {
          w: finalWidth,
          h: finalHeight
        },
        design_preserved: designPreserved,
        implementation_transformed: implementationTransformed
      },
      pixelmatch: {
        total_pixels: pixelmatchResult.totalPixels,
        diff_pixels: pixelmatchResult.diffPixels,
        percentage: pixelmatchResult.percentage,
        threshold: pixelmatchResult.threshold
      },
      ffmpeg_metrics: {
        ssim_avg: ffmpegMetrics.ssim_avg,
        psnr: ffmpegMetrics.psnr,
        vmaf: ffmpegMetrics.vmaf
      },
      artifacts: {
        aligned_design_path: alignedTargetPath,
        aligned_implementation_path: alignedCurrentPath,
        pixelmatch_diff_path: pixelmatchDiffPath,
        overlay_path: overlayPath
      },
      regions: regionsResult.regions
    };

  } catch (error) {
    throw new Error(`Enhanced diff computation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}