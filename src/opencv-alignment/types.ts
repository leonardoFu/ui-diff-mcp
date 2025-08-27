/**
 * Type definitions for OpenCV Global Shift Detection system
 */

export interface PhaseCorrelationResult {
  dx: number;
  dy: number;
  confidence: number;
  method: 'phase_correlation';
  error?: string;
}

export interface ECCRegistrationResult {
  dx: number;
  dy: number;
  scale_x: number;
  scale_y: number;
  rotation_deg: number;
  confidence: number;
  warp_matrix: number[][];
  method: 'ecc_registration';
  error?: string;
}

export interface FeatureMatchingResult {
  dx: number;
  dy: number;
  scale: number;
  rotation_deg: number;
  confidence: number;
  inlier_count: number;
  method: 'feature_matching';
  error?: string;
}

export type ShiftDetectionResult = 
  | PhaseCorrelationResult 
  | ECCRegistrationResult 
  | FeatureMatchingResult;

export interface AlignmentRecommendation {
  action: 'no_alignment' | 'minor_alignment' | 'major_alignment';
  reason: string;
  shift?: {
    dx: number;
    dy: number;
  };
}

export interface MultiMethodAnalysis {
  primary_result: ShiftDetectionResult;
  all_methods: ShiftDetectionResult[];
  recommendation: AlignmentRecommendation;
  preprocessing_needed: boolean;
}

export interface AlignmentResult {
  alignedImageA: string; // Path to aligned image A
  alignedImageB: string; // Path to aligned image B
  croppedDimensions: {
    width: number;
    height: number;
  };
  alignmentApplied: boolean;
  shiftCompensation?: {
    dx: number;
    dy: number;
  };
}

// New interface for design-centric alignment
export interface AlignmentStrategy {
  preserveDesign: boolean;        // Never crop design image
  designImageIndex: 0 | 1;        // Which image is the design (0 = first, 1 = second)
  confidenceThreshold?: number;   // Threshold for applying shift compensation (default: 0.7)
}

export interface DesignCentricAlignmentResult {
  alignedDesignPath: string;       // Path to design image (may be original)
  alignedImplementationPath: string; // Path to transformed implementation
  designDimensions: {
    width: number;
    height: number;
  };
  finalCanvasDimensions: {
    width: number;
    height: number;
  };
  designPreserved: boolean;        // True if design was never cropped
  transformationApplied: boolean;  // True if implementation was transformed
  paddingApplied?: boolean;        // True if implementation was padded
  croppingApplied?: boolean;       // True if implementation was cropped
  shiftCompensation?: {
    dx: number;
    dy: number;
  };
  confidenceBasedPlacement?: boolean; // True if high confidence shift compensation was used
}

export interface EnhancedDiffResult {
  canvas: { w: number; h: number };
  alignment: {
    shift_detection: MultiMethodAnalysis;
    preprocessing_applied: boolean;
    cropped_dimensions: { w: number; h: number };
    design_preserved?: boolean;        // NEW: True if design was preserved
    implementation_transformed?: boolean; // NEW: True if implementation was transformed
  };
  pixelmatch: {
    total_pixels: number;
    diff_pixels: number;
    percentage: number;
    threshold: number;
  };
  ffmpeg_metrics: {
    ssim_avg: number;
    psnr: number;
    vmaf?: number;
  };
  artifacts: {
    aligned_design_path: string;
    aligned_implementation_path: string;
    pixelmatch_diff_path: string;
    overlay_path: string;
  };
  regions: Array<{
    id: string;
    bbox: [number, number, number, number];
    score: number;
    area_px: number;
  }>;
}

export interface DetectionMethod {
  name: 'phase_correlation' | 'ecc_registration' | 'feature_matching';
  enabled: boolean;
  confidenceThreshold: number;
}

export interface DetectorConfig {
  methods: DetectionMethod[];
  timeoutMs?: number;
  maxImageSize?: {
    width: number;
    height: number;
  };
}