/**
 * OpenCV Global Shift Detection Implementation
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import {
  PhaseCorrelationResult,
  ECCRegistrationResult,
  FeatureMatchingResult,
  MultiMethodAnalysis,
  AlignmentRecommendation,
  DetectorConfig,
  DetectionMethod
} from './types.js';

export class OpenCVGlobalShiftDetector {
  private methods: DetectionMethod[];
  private timeoutMs: number;

  constructor(config?: Partial<DetectorConfig>) {
    this.methods = config?.methods ?? [
      { name: 'phase_correlation', enabled: true, confidenceThreshold: 0.1 },
      { name: 'ecc_registration', enabled: true, confidenceThreshold: 0.3 },
      { name: 'feature_matching', enabled: true, confidenceThreshold: 0.2 }
    ];
    this.timeoutMs = config?.timeoutMs ?? 30000; // 30 second timeout
  }

  /**
   * Phase Correlation Detection - Fast translation detection
   */
  async detectPhaseCorrelation(imagePathA: string, imagePathB: string): Promise<PhaseCorrelationResult> {
    const pythonScript = `
import cv2
import numpy as np
import json
import sys

try:
    img_a_path = "${imagePathA}"
    img_b_path = "${imagePathB}"
    
    # Load images
    img_a = cv2.imread(img_a_path)
    img_b = cv2.imread(img_b_path)
    
    if img_a is None:
        raise ValueError(f"Could not load image A from {img_a_path}")
    if img_b is None:
        raise ValueError(f"Could not load image B from {img_b_path}")
    
    # Convert to grayscale
    gray_a = cv2.cvtColor(img_a, cv2.COLOR_BGR2GRAY) if len(img_a.shape) == 3 else img_a
    gray_b = cv2.cvtColor(img_b, cv2.COLOR_BGR2GRAY) if len(img_b.shape) == 3 else img_b
    
    # For phase correlation, use images as-is if same size, otherwise resize
    if gray_a.shape == gray_b.shape:
        # Same size - use directly
        img_a_proc = gray_a
        img_b_proc = gray_b
        scale_x = 1.0
        scale_y = 1.0
    else:
        # Different sizes - resize to common dimensions
        min_height = min(gray_a.shape[0], gray_b.shape[0])
        min_width = min(gray_a.shape[1], gray_b.shape[1])
        
        img_a_proc = cv2.resize(gray_a, (min_width, min_height))
        img_b_proc = cv2.resize(gray_b, (min_width, min_height))
        
        scale_x = gray_a.shape[1] / min_width
        scale_y = gray_a.shape[0] / min_height
    
    # Phase correlation - OpenCV returns (y_shift, x_shift) - we need to swap to get (dx, dy)
    (y_shift_norm, x_shift_norm), response = cv2.phaseCorrelate(
        np.float32(img_a_proc), 
        np.float32(img_b_proc)
    )
    
    # Scale the result back to original image dimensions with proper coordinate mapping
    dx = y_shift_norm * scale_x  # y_shift becomes dx (swap)
    dy = x_shift_norm * scale_y  # x_shift becomes dy (swap)
    
    result = {
        'dx': float(dx),
        'dy': float(dy),
        'confidence': float(response),
        'method': 'phase_correlation'
    }
    
    print(json.dumps(result))
    
except Exception as e:
    result = {
        'dx': 0.0,
        'dy': 0.0,
        'confidence': 0.0,
        'method': 'phase_correlation',
        'error': str(e)
    }
    print(json.dumps(result))
`;

    return this.executePythonScript(pythonScript) as Promise<PhaseCorrelationResult>;
  }

  /**
   * ECC Registration - Affine transformation detection
   */
  async detectECCRegistration(imagePathA: string, imagePathB: string): Promise<ECCRegistrationResult> {
    const pythonScript = `
import cv2
import numpy as np
import json
import sys

try:
    img_a_path = "${imagePathA}"
    img_b_path = "${imagePathB}"
    
    # Load images
    img_a = cv2.imread(img_a_path)
    img_b = cv2.imread(img_b_path)
    
    if img_a is None:
        raise ValueError(f"Could not load image A from {img_a_path}")
    if img_b is None:
        raise ValueError(f"Could not load image B from {img_b_path}")
    
    # Convert to grayscale
    gray_a = cv2.cvtColor(img_a, cv2.COLOR_BGR2GRAY) if len(img_a.shape) == 3 else img_a
    gray_b = cv2.cvtColor(img_b, cv2.COLOR_BGR2GRAY) if len(img_b.shape) == 3 else img_b
    
    # Resize to common dimensions
    min_height = min(gray_a.shape[0], gray_b.shape[0])
    min_width = min(gray_a.shape[1], gray_b.shape[1])
    
    gray_a_resized = cv2.resize(gray_a, (min_width, min_height))
    gray_b_resized = cv2.resize(gray_b, (min_width, min_height))
    
    # Initialize warp matrix for affine transform
    warp_matrix = np.eye(2, 3, dtype=np.float32)
    
    # ECC algorithm with error handling
    try:
        (cc, warp_matrix) = cv2.findTransformECC(
            gray_a_resized, 
            gray_b_resized, 
            warp_matrix, 
            cv2.MOTION_AFFINE,
            criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 50, 1e-6)
        )
        
        # Extract transformation parameters
        dx = float(warp_matrix[0, 2])
        dy = float(warp_matrix[1, 2])
        scale_x = float(np.sqrt(warp_matrix[0, 0]**2 + warp_matrix[0, 1]**2))
        scale_y = float(np.sqrt(warp_matrix[1, 0]**2 + warp_matrix[1, 1]**2))
        rotation_deg = float(np.arctan2(warp_matrix[1, 0], warp_matrix[0, 0]) * 180 / np.pi)
        
        result = {
            'dx': dx,
            'dy': dy,
            'scale_x': scale_x,
            'scale_y': scale_y,
            'rotation_deg': rotation_deg,
            'confidence': float(cc),
            'warp_matrix': warp_matrix.tolist(),
            'method': 'ecc_registration'
        }
        
    except cv2.error as e:
        result = {
            'dx': 0.0, 'dy': 0.0, 'scale_x': 1.0, 'scale_y': 1.0, 
            'rotation_deg': 0.0, 'confidence': 0.0,
            'warp_matrix': warp_matrix.tolist(),
            'method': 'ecc_registration',
            'error': f'ECC registration failed: {str(e)}'
        }
    
    print(json.dumps(result))
    
except Exception as e:
    result = {
        'dx': 0.0, 'dy': 0.0, 'scale_x': 1.0, 'scale_y': 1.0, 
        'rotation_deg': 0.0, 'confidence': 0.0,
        'warp_matrix': [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
        'method': 'ecc_registration',
        'error': str(e)
    }
    print(json.dumps(result))
`;

    return this.executePythonScript(pythonScript) as Promise<ECCRegistrationResult>;
  }

  /**
   * Feature Matching + RANSAC - Robust detection using features
   */
  async detectFeatureMatching(imagePathA: string, imagePathB: string): Promise<FeatureMatchingResult> {
    const pythonScript = `
import cv2
import numpy as np
import json
import sys

try:
    img_a_path = "${imagePathA}"
    img_b_path = "${imagePathB}"
    
    # Load images
    img_a = cv2.imread(img_a_path)
    img_b = cv2.imread(img_b_path)
    
    if img_a is None:
        raise ValueError(f"Could not load image A from {img_a_path}")
    if img_b is None:
        raise ValueError(f"Could not load image B from {img_b_path}")
    
    # Convert to grayscale
    gray_a = cv2.cvtColor(img_a, cv2.COLOR_BGR2GRAY) if len(img_a.shape) == 3 else img_a
    gray_b = cv2.cvtColor(img_b, cv2.COLOR_BGR2GRAY) if len(img_b.shape) == 3 else img_b
    
    # ORB detector
    orb = cv2.ORB_create(nfeatures=1000)
    
    # Find keypoints and descriptors
    kp1, des1 = orb.detectAndCompute(gray_a, None)
    kp2, des2 = orb.detectAndCompute(gray_b, None)
    
    if des1 is None or des2 is None or len(des1) < 4 or len(des2) < 4:
        result = {
            'dx': 0.0, 'dy': 0.0, 'scale': 1.0, 'rotation_deg': 0.0,
            'confidence': 0.0, 'inlier_count': 0,
            'method': 'feature_matching',
            'error': 'Insufficient features detected'
        }
        print(json.dumps(result))
        sys.exit(0)
    
    # Match features
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(des1, des2)
    matches = sorted(matches, key=lambda x: x.distance)
    
    if len(matches) < 4:
        result = {
            'dx': 0.0, 'dy': 0.0, 'scale': 1.0, 'rotation_deg': 0.0,
            'confidence': 0.0, 'inlier_count': 0,
            'method': 'feature_matching',
            'error': 'Insufficient matches'
        }
        print(json.dumps(result))
        sys.exit(0)
    
    # Extract matched points
    src_pts = np.float32([kp1[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
    dst_pts = np.float32([kp2[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)
    
    # RANSAC to find affine transform
    M, inliers = cv2.estimateAffinePartial2D(
        src_pts, dst_pts, 
        method=cv2.RANSAC,
        ransacReprojThreshold=5.0
    )
    
    if M is None:
        result = {
            'dx': 0.0, 'dy': 0.0, 'scale': 1.0, 'rotation_deg': 0.0,
            'confidence': 0.0, 'inlier_count': 0,
            'method': 'feature_matching',
            'error': 'RANSAC failed'
        }
        print(json.dumps(result))
        sys.exit(0)
    
    # Extract parameters
    dx = float(M[0, 2])
    dy = float(M[1, 2])
    scale = float(np.sqrt(M[0, 0]**2 + M[0, 1]**2))
    rotation_deg = float(np.arctan2(M[1, 0], M[0, 0]) * 180 / np.pi)
    inlier_count = int(np.sum(inliers)) if inliers is not None else 0
    confidence = float(inlier_count / len(matches)) if len(matches) > 0 else 0.0
    
    result = {
        'dx': dx,
        'dy': dy,
        'scale': scale,
        'rotation_deg': rotation_deg,
        'confidence': confidence,
        'inlier_count': inlier_count,
        'method': 'feature_matching'
    }
    
    print(json.dumps(result))
    
except Exception as e:
    result = {
        'dx': 0.0, 'dy': 0.0, 'scale': 1.0, 'rotation_deg': 0.0,
        'confidence': 0.0, 'inlier_count': 0,
        'method': 'feature_matching',
        'error': str(e)
    }
    print(json.dumps(result))
`;

    return this.executePythonScript(pythonScript) as Promise<FeatureMatchingResult>;
  }

  /**
   * Multi-method analysis - run all enabled methods and consolidate results
   */
  async analyzeShift(imagePathA: string, imagePathB: string): Promise<MultiMethodAnalysis> {
    const results = [];

    // Run enabled methods
    for (const method of this.methods) {
      if (!method.enabled) continue;

      try {
        let result;
        switch (method.name) {
          case 'phase_correlation':
            result = await this.detectPhaseCorrelation(imagePathA, imagePathB);
            break;
          case 'ecc_registration':
            result = await this.detectECCRegistration(imagePathA, imagePathB);
            break;
          case 'feature_matching':
            result = await this.detectFeatureMatching(imagePathA, imagePathB);
            break;
        }
        if (result) results.push(result);
      } catch (error) {
        console.warn(`Method ${method.name} failed:`, error);
      }
    }

    // Select best result based on confidence
    const bestResult = results.reduce((best, current) => 
      (current.confidence > best.confidence) ? current : best
    );

    const recommendation = this.getAlignmentRecommendation(bestResult);
    const preprocessingNeeded = this.needsPreprocessing(bestResult);

    return {
      primary_result: bestResult,
      all_methods: results,
      recommendation,
      preprocessing_needed: preprocessingNeeded
    };
  }

  /**
   * Generate alignment recommendation based on detected shift
   */
  private getAlignmentRecommendation(result: any): AlignmentRecommendation {
    const dx = result.dx || 0;
    const dy = result.dy || 0;
    const confidence = result.confidence || 0;
    const method = result.method || 'phase_correlation';

    // Find threshold for this method
    const threshold = this.methods.find(m => m.name === method)?.confidenceThreshold || 0.1;

    if (confidence < threshold) {
      return {
        action: 'no_alignment',
        reason: 'Low confidence in shift detection'
      };
    }

    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
      return {
        action: 'no_alignment',
        reason: 'Negligible shift detected'
      };
    }

    if (Math.abs(dx) > 50 || Math.abs(dy) > 50) {
      return {
        action: 'major_alignment',
        reason: `Significant shift detected: dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}`,
        shift: { dx, dy }
      };
    }

    return {
      action: 'minor_alignment',
      reason: `Minor shift detected: dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}`,
      shift: { dx, dy }
    };
  }

  /**
   * Determine if preprocessing is needed
   */
  private needsPreprocessing(result: any): boolean {
    const scaleX = result.scale_x || result.scale || 1.0;
    const scaleY = result.scale_y || result.scale || 1.0;
    const rotation = Math.abs(result.rotation_deg || 0.0);

    // Scale deviation > 2% or rotation > 1 degree
    return (
      Math.abs(scaleX - 1.0) > 0.02 ||
      Math.abs(scaleY - 1.0) > 0.02 ||
      rotation > 1.0
    );
  }

  /**
   * Execute Python script and return parsed JSON result
   */
  private async executePythonScript(script: string): Promise<any> {
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
        reject(new Error(`Python script timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

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