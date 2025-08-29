import { z } from 'zod';

// Region schema as defined in deltavision doc
export const RegionSchema = z.object({
  id: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  score: z.number().min(0).max(1),
  max: z.number().min(0).max(1).optional(),
  area_px: z.number().int().min(0)
});

export const CanvasSchema = z.object({
  w: z.number().int().min(1),
  h: z.number().int().min(1)
});

export const MetricsSchema = z.object({
  psnr: z.number(),
  ssim_avg: z.number().min(0).max(1),
  vmaf: z.number().min(0).max(100).optional()
});

export const ArtifactsSchema = z.object({
  heatmap_path: z.string()
});

// Main response schema matching deltavision doc example
export const ComputeDiffRegionsResponseSchema = z.object({
  canvas: CanvasSchema,
  regions: z.array(RegionSchema),
  metrics: MetricsSchema,
  artifacts: ArtifactsSchema
});

export const ScoreGlobalResponseSchema = z.object({
  vmaf: z.number().min(0).max(100),
  ssim_avg: z.number().min(0).max(1),
  psnr: z.number()
});

// Input schemas
export const ComputeDiffRegionsInputSchema = z.object({
  target_path: z.string(),
  current_path: z.string(),
  threshold: z.number().min(0).max(1).default(0.0),
  min_area_px: z.number().int().min(0).default(64),
  // Region merging options
  max_regions: z.number().int().min(1).default(20),
  merge_score_threshold: z.number().min(0).max(1).default(0.05),
  merge_distance_threshold: z.number().min(0).default(50)
});

export const ScoreGlobalInputSchema = z.object({
  target_path: z.string(),
  current_path: z.string()
});

export const RenderOverlayInputSchema = z.object({
  current_path: z.string(),
  regions: z.array(RegionSchema)
});

export const HeatmapOverlayInputSchema = z.object({
  heatmap_path: z.string(),
  target_path: z.string(),
  regions: z.array(RegionSchema)
});

export const ComputeDiffWithAlignmentInputSchema = z.object({
  target_path: z.string(),
  current_path: z.string(),
  alignment_method: z.enum(['auto', 'phase_correlation', 'ecc', 'feature_matching']).default('auto'),
  pixelmatch_threshold: z.number().min(0).max(1).default(0.1),
  min_region_area: z.number().int().min(0).default(64),
  disable_alignment: z.boolean().default(false),
  // Design-centric alignment parameters
  preserve_design: z.boolean().default(true),
  design_image_first: z.boolean().default(true),
  implementation_transforms_only: z.boolean().default(true),
  confidence_threshold: z.number().min(0).max(1).default(0.7),
  // Region merging options
  max_regions: z.number().int().min(1).default(20),
  merge_score_threshold: z.number().min(0).max(1).default(0.05),
  merge_distance_threshold: z.number().min(0).default(50)
});

// TypeScript types
export type Region = z.infer<typeof RegionSchema>;
export type Canvas = z.infer<typeof CanvasSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type Artifacts = z.infer<typeof ArtifactsSchema>;
export type ComputeDiffRegionsResponse = z.infer<typeof ComputeDiffRegionsResponseSchema>;
export type ScoreGlobalResponse = z.infer<typeof ScoreGlobalResponseSchema>;
export type ComputeDiffRegionsInput = z.infer<typeof ComputeDiffRegionsInputSchema>;
export type ScoreGlobalInput = z.infer<typeof ScoreGlobalInputSchema>;
export type RenderOverlayInput = z.infer<typeof RenderOverlayInputSchema>;
export type HeatmapOverlayInput = z.infer<typeof HeatmapOverlayInputSchema>;
export type ComputeDiffWithAlignmentInput = z.infer<typeof ComputeDiffWithAlignmentInputSchema>;