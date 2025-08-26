/**
 * Image Alignment and Cropping Implementation
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { MultiMethodAnalysis, AlignmentResult, AlignmentStrategy, DesignCentricAlignmentResult } from './types.js';

export class ImageAligner {
  private paddingColor: [number, number, number];
  private tempDir: string;

  constructor(options?: { paddingColor?: [number, number, number]; tempDir?: string }) {
    this.paddingColor = options?.paddingColor || [255, 255, 255]; // White background
    this.tempDir = options?.tempDir || '/tmp';
  }

  /**
   * Align images based on shift detection and crop to common region
   */
  async alignAndCrop(
    imagePathA: string,
    imagePathB: string,
    shiftData: MultiMethodAnalysis
  ): Promise<AlignmentResult> {
    const recommendation = shiftData.recommendation;

    // Generate output paths
    const timestamp = Date.now();
    const alignedPathA = path.join(this.tempDir, `aligned_a_${timestamp}.png`);
    const alignedPathB = path.join(this.tempDir, `aligned_b_${timestamp}.png`);

    let result: AlignmentResult;

    if (recommendation.action === 'no_alignment') {
      result = await this.simpleCropToCommonSize(imagePathA, imagePathB, alignedPathA, alignedPathB);
    } else if (['minor_alignment', 'major_alignment'].includes(recommendation.action)) {
      result = await this.alignAndCropWithShift(imagePathA, imagePathB, shiftData, alignedPathA, alignedPathB);
    } else {
      // Fallback: copy original images
      await fs.copyFile(imagePathA, alignedPathA);
      await fs.copyFile(imagePathB, alignedPathB);
      
      const dimensions = await this.getImageDimensions(imagePathA);
      result = {
        alignedImageA: alignedPathA,
        alignedImageB: alignedPathB,
        croppedDimensions: dimensions,
        alignmentApplied: false
      };
    }

    return result;
  }

  /**
   * Crop both images to their common overlapping area
   */
  private async simpleCropToCommonSize(
    imagePathA: string,
    imagePathB: string,
    outputPathA: string,
    outputPathB: string
  ): Promise<AlignmentResult> {
    const pythonScript = `
import cv2
import numpy as np
import json

def center_crop(img, target_w, target_h):
    """Crop image from center to target dimensions"""
    h, w = img.shape[:2]
    
    start_x = max(0, (w - target_w) // 2)
    start_y = max(0, (h - target_h) // 2)
    end_x = min(w, start_x + target_w)
    end_y = min(h, start_y + target_h)
    
    return img[start_y:end_y, start_x:end_x]

try:
    img_a_path = "${imagePathA}"
    img_b_path = "${imagePathB}"
    output_a_path = "${outputPathA}"
    output_b_path = "${outputPathB}"
    
    # Load images
    img_a = cv2.imread(img_a_path)
    img_b = cv2.imread(img_b_path)
    
    if img_a is None:
        raise ValueError(f"Could not load image A from {img_a_path}")
    if img_b is None:
        raise ValueError(f"Could not load image B from {img_b_path}")
    
    h_a, w_a = img_a.shape[:2]
    h_b, w_b = img_b.shape[:2]
    
    # Find common dimensions
    common_width = min(w_a, w_b)
    common_height = min(h_a, h_b)
    
    # Crop from center
    crop_a = center_crop(img_a, common_width, common_height)
    crop_b = center_crop(img_b, common_width, common_height)
    
    # Save cropped images
    cv2.imwrite(output_a_path, crop_a)
    cv2.imwrite(output_b_path, crop_b)
    
    result = {
        'success': True,
        'width': int(common_width),
        'height': int(common_height)
    }
    
    print(json.dumps(result))
    
except Exception as e:
    result = {
        'success': False,
        'error': str(e),
        'width': 0,
        'height': 0
    }
    print(json.dumps(result))
`;

    const cropResult = await this.executePythonScript(pythonScript);

    if (!cropResult.success) {
      throw new Error(`Simple crop failed: ${cropResult.error}`);
    }

    return {
      alignedImageA: outputPathA,
      alignedImageB: outputPathB,
      croppedDimensions: {
        width: cropResult.width,
        height: cropResult.height
      },
      alignmentApplied: false
    };
  }

  /**
   * Apply detected shift and crop to overlapping region
   */
  private async alignAndCropWithShift(
    imagePathA: string,
    imagePathB: string,
    shiftData: MultiMethodAnalysis,
    outputPathA: string,
    outputPathB: string
  ): Promise<AlignmentResult> {
    const primaryResult = shiftData.primary_result;
    const dx = Math.round(primaryResult.dx || 0);
    const dy = Math.round(primaryResult.dy || 0);

    const pythonScript = `
import cv2
import numpy as np
import json

def calculate_overlapping_region(w_a, h_a, w_b, h_b, dx, dy):
    """Calculate the overlapping region after applying shift"""
    if dx >= 0:  # img_b shifted right
        overlap_left = dx
        overlap_right = min(w_a, w_b + dx)
        crop_a_x = (0, overlap_right - overlap_left)
        crop_b_x = (overlap_left - dx, overlap_right - dx)
    else:  # img_b shifted left
        overlap_left = 0
        overlap_right = min(w_a + dx, w_b)
        crop_a_x = (-dx, overlap_right - overlap_left - dx)
        crop_b_x = (0, overlap_right - overlap_left)

    if dy >= 0:  # img_b shifted down
        overlap_top = dy
        overlap_bottom = min(h_a, h_b + dy)
        crop_a_y = (0, overlap_bottom - overlap_top)
        crop_b_y = (overlap_top - dy, overlap_bottom - dy)
    else:  # img_b shifted up
        overlap_top = 0
        overlap_bottom = min(h_a + dy, h_b)
        crop_a_y = (-dy, overlap_bottom - overlap_top - dy)
        crop_b_y = (0, overlap_bottom - overlap_top)

    return crop_a_x, crop_a_y, crop_b_x, crop_b_y

try:
    img_a_path = "${imagePathA}"
    img_b_path = "${imagePathB}"
    output_a_path = "${outputPathA}"
    output_b_path = "${outputPathB}"
    dx = ${dx}
    dy = ${dy}
    
    # Load images
    img_a = cv2.imread(img_a_path)
    img_b = cv2.imread(img_b_path)
    
    if img_a is None:
        raise ValueError(f"Could not load image A from {img_a_path}")
    if img_b is None:
        raise ValueError(f"Could not load image B from {img_b_path}")
    
    h_a, w_a = img_a.shape[:2]
    h_b, w_b = img_b.shape[:2]
    
    # Calculate overlapping region after shift
    crop_a_x, crop_a_y, crop_b_x, crop_b_y = calculate_overlapping_region(
        w_a, h_a, w_b, h_b, dx, dy
    )
    
    # Perform cropping with bounds checking
    crop_a = img_a[
        max(0, crop_a_y[0]):min(h_a, crop_a_y[0] + crop_a_y[1]), 
        max(0, crop_a_x[0]):min(w_a, crop_a_x[0] + crop_a_x[1])
    ]
    
    crop_b = img_b[
        max(0, crop_b_y[0]):min(h_b, crop_b_y[0] + crop_b_y[1]), 
        max(0, crop_b_x[0]):min(w_b, crop_b_x[0] + crop_b_x[1])
    ]
    
    # Ensure both crops have the same dimensions
    min_height = min(crop_a.shape[0], crop_b.shape[0])
    min_width = min(crop_a.shape[1], crop_b.shape[1])
    
    if min_height > 0 and min_width > 0:
        crop_a = crop_a[:min_height, :min_width]
        crop_b = crop_b[:min_height, :min_width]
        
        # Save aligned and cropped images
        cv2.imwrite(output_a_path, crop_a)
        cv2.imwrite(output_b_path, crop_b)
        
        result = {
            'success': True,
            'width': int(min_width),
            'height': int(min_height),
            'dx_applied': dx,
            'dy_applied': dy
        }
    else:
        raise ValueError(f"No overlapping region found with dx={dx}, dy={dy}")
    
    print(json.dumps(result))
    
except Exception as e:
    result = {
        'success': False,
        'error': str(e),
        'width': 0,
        'height': 0
    }
    print(json.dumps(result))
`;

    const alignResult = await this.executePythonScript(pythonScript);

    if (!alignResult.success) {
      throw new Error(`Alignment with shift failed: ${alignResult.error}`);
    }

    return {
      alignedImageA: outputPathA,
      alignedImageB: outputPathB,
      croppedDimensions: {
        width: alignResult.width,
        height: alignResult.height
      },
      alignmentApplied: true,
      shiftCompensation: {
        dx: alignResult.dx_applied || 0,
        dy: alignResult.dy_applied || 0
      }
    };
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(imagePath: string): Promise<{ width: number; height: number }> {
    const pythonScript = `
import cv2
import json

try:
    img = cv2.imread("${imagePath}")
    if img is None:
        raise ValueError("Could not load image")
    
    h, w = img.shape[:2]
    result = {'width': int(w), 'height': int(h)}
    print(json.dumps(result))
    
except Exception as e:
    result = {'width': 0, 'height': 0, 'error': str(e)}
    print(json.dumps(result))
`;

    return this.executePythonScript(pythonScript);
  }

  /**
   * Design-centric alignment: preserve design image and transform implementation only
   * 
   * This method implements the new alignment strategy where:
   * - Design image is never cropped or modified
   * - Implementation image is transformed to match design coordinate space
   * - Final canvas preserves full design dimensions
   * - User can specify which image is the design vs implementation
   * 
   * @param imagePathA First image path
   * @param imagePathB Second image path
   * @param shiftData Detected shift analysis from OpenCV
   * @param strategy Alignment strategy configuration
   * @returns Design-centric alignment result with preserved design image
   */
  async alignToDesign(
    imagePathA: string,
    imagePathB: string, 
    shiftData: MultiMethodAnalysis,
    strategy?: AlignmentStrategy
  ): Promise<DesignCentricAlignmentResult> {
    const {
      preserveDesign = true,
      designImageIndex = 0
    } = strategy || {};

    // Determine which image is design vs implementation
    // designImageIndex: 0 = first parameter is design, 1 = second parameter is design
    const designImagePath = designImageIndex === 0 ? imagePathA : imagePathB;
    const implementationImagePath = designImageIndex === 0 ? imagePathB : imagePathA;

    // Get design image dimensions
    const designDimensions = await this.getImageDimensions(designImagePath);
    
    // Generate output path for transformed implementation
    const timestamp = Date.now();
    const alignedImplementationPath = path.join(this.tempDir, `aligned_implementation_${timestamp}.png`);

    const recommendation = shiftData.recommendation;
    
    let result: DesignCentricAlignmentResult;

    if (recommendation.action === 'no_alignment') {
      // No transformation needed, but still apply design-centric positioning
      await fs.copyFile(implementationImagePath, alignedImplementationPath);
      
      const implDimensions = await this.getImageDimensions(implementationImagePath);
      
      result = {
        alignedDesignPath: designImagePath, // Original design path
        alignedImplementationPath,
        designDimensions,
        finalCanvasDimensions: designDimensions, // Design defines canvas size
        designPreserved: true,
        transformationApplied: false,
        paddingApplied: implDimensions.width < designDimensions.width || implDimensions.height < designDimensions.height,
        croppingApplied: implDimensions.width > designDimensions.width || implDimensions.height > designDimensions.height
      };
    } else {
      // Apply design-centric transformation (this should always happen when preserveDesign is true)
      result = await this.transformImplementationToDesignSpace(
        designImagePath,
        implementationImagePath,
        shiftData,
        alignedImplementationPath
      );
    }

    return result;
  }

  /**
   * Transform implementation image to fit design coordinate space
   */
  private async transformImplementationToDesignSpace(
    designImagePath: string,
    implementationImagePath: string,
    shiftData: MultiMethodAnalysis,
    outputPath: string
  ): Promise<DesignCentricAlignmentResult> {
    const designDimensions = await this.getImageDimensions(designImagePath);
    const primaryResult = shiftData.primary_result;
    const dx = Math.round(primaryResult.dx || 0);
    const dy = Math.round(primaryResult.dy || 0);

    const pythonScript = `
import cv2
import numpy as np
import json

def transform_implementation_to_design_space(impl_img, design_w, design_h, dx, dy, padding_color):
    """Transform implementation to design coordinate space"""
    impl_h, impl_w = impl_img.shape[:2]
    
    # Create canvas at design dimensions
    canvas = np.full((design_h, design_w, 3), padding_color, dtype=np.uint8)
    
    # Calculate placement position (compensate for detected shift)
    # If implementation was shifted dx pixels right relative to design,
    # we place it dx pixels left to align it properly
    place_x = -dx if dx != 0 else 0
    place_y = -dy if dy != 0 else 0
    
    # Calculate the region to copy from implementation
    src_x_start = max(0, -place_x)
    src_y_start = max(0, -place_y)
    src_x_end = min(impl_w, design_w - place_x) if place_x >= 0 else min(impl_w, design_w - place_x)
    src_y_end = min(impl_h, design_h - place_y) if place_y >= 0 else min(impl_h, design_h - place_y)
    
    # Calculate the region to place in canvas
    dst_x_start = max(0, place_x)
    dst_y_start = max(0, place_y)
    dst_x_end = dst_x_start + (src_x_end - src_x_start)
    dst_y_end = dst_y_start + (src_y_end - src_y_start)
    
    # Ensure we don't exceed canvas bounds
    if dst_x_end <= design_w and dst_y_end <= design_h and src_x_end > src_x_start and src_y_end > src_y_start:
        canvas[dst_y_start:dst_y_end, dst_x_start:dst_x_end] = impl_img[src_y_start:src_y_end, src_x_start:src_x_end]
    
    return canvas

try:
    design_path = "${designImagePath}"
    impl_path = "${implementationImagePath}"
    output_path = "${outputPath}"
    dx = ${dx}
    dy = ${dy}
    padding_color = [${this.paddingColor.join(', ')}]
    
    # Load images
    design_img = cv2.imread(design_path)
    impl_img = cv2.imread(impl_path)
    
    if design_img is None:
        raise ValueError(f"Could not load design image from {design_path}")
    if impl_img is None:
        raise ValueError(f"Could not load implementation image from {impl_path}")
    
    design_h, design_w = design_img.shape[:2]
    impl_h, impl_w = impl_img.shape[:2]
    
    # Transform implementation to design space
    transformed_impl = transform_implementation_to_design_space(
        impl_img, design_w, design_h, dx, dy, padding_color
    )
    
    # Save transformed implementation
    cv2.imwrite(output_path, transformed_impl)
    
    result = {
        'success': True,
        'design_width': int(design_w),
        'design_height': int(design_h),
        'impl_width': int(impl_w),
        'impl_height': int(impl_h),
        'dx_applied': dx,
        'dy_applied': dy,
        'padding_applied': impl_w < design_w or impl_h < design_h,
        'cropping_applied': impl_w > design_w or impl_h > design_h
    }
    
    print(json.dumps(result))
    
except Exception as e:
    result = {
        'success': False,
        'error': str(e),
        'design_width': 0,
        'design_height': 0
    }
    print(json.dumps(result))
`;

    const transformResult = await this.executePythonScript(pythonScript);

    if (!transformResult.success) {
      throw new Error(`Design-centric transformation failed: ${transformResult.error}`);
    }

    return {
      alignedDesignPath: designImagePath, // Original design path (unchanged)
      alignedImplementationPath: outputPath,
      designDimensions: {
        width: transformResult.design_width,
        height: transformResult.design_height
      },
      finalCanvasDimensions: {
        width: transformResult.design_width,
        height: transformResult.design_height
      },
      designPreserved: true,
      transformationApplied: true,
      paddingApplied: transformResult.padding_applied,
      croppingApplied: transformResult.cropping_applied,
      shiftCompensation: {
        dx: transformResult.dx_applied,
        dy: transformResult.dy_applied
      }
    };
  }

  /**
   * Execute Python script and return parsed JSON result
   */
  private async executePythonScript(script: string, timeoutMs: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn('python3', ['-c', script], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`Python script timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      process.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse JSON output: ${parseError}`));
          }
        } else {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      });
    });
  }
}