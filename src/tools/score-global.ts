import { ScoreGlobalInput, ScoreGlobalResponse } from '../types.js';
import { computePSNR, computeSSIM, computeVMAF } from '../utils/ffmpeg.js';
import { promises as fs } from 'fs';

/**
 * Compute global similarity scores between target and current images
 * Implements the score_global tool as specified in deltavision doc
 */
export async function scoreGlobal(input: ScoreGlobalInput): Promise<ScoreGlobalResponse> {
  const { target_path, current_path } = input;
  
  // Validate input files exist
  await fs.access(target_path);
  await fs.access(current_path);
  
  // Compute all global metrics in parallel
  const [vmaf, ssim_avg, psnr] = await Promise.all([
    computeVMAF(current_path, target_path),
    computeSSIM(current_path, target_path),
    computePSNR(current_path, target_path)
  ]);
  
  return {
    vmaf,
    ssim_avg,
    psnr
  };
}