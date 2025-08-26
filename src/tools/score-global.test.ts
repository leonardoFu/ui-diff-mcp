import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scoreGlobal } from './score-global.js';
import { createTestImages } from '../test-utils/image-helpers.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('score_global', () => {
  let testDir: string;
  let targetPath: string;
  let currentPath: string;
  let identicalPath: string;

  beforeAll(async () => {
    testDir = path.join(process.cwd(), 'test-artifacts', 'score-global');
    await fs.mkdir(testDir, { recursive: true });
    
    const { target, current } = await createTestImages();
    targetPath = path.join(testDir, 'target.png');
    currentPath = path.join(testDir, 'current.png');
    identicalPath = path.join(testDir, 'identical.png');
    
    await fs.writeFile(targetPath, target);
    await fs.writeFile(currentPath, current);
    await fs.writeFile(identicalPath, target); // Identical copy
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should return global metrics object with vmaf, ssim_avg, and psnr', async () => {
    const result = await scoreGlobal({
      target_path: targetPath,
      current_path: currentPath
    });

    expect(result).toHaveProperty('vmaf');
    expect(result).toHaveProperty('ssim_avg');
    expect(result).toHaveProperty('psnr');

    expect(typeof result.vmaf).toBe('number');
    expect(typeof result.ssim_avg).toBe('number');
    expect(typeof result.psnr).toBe('number');
  });

  it('should return high scores for identical images', async () => {
    const result = await scoreGlobal({
      target_path: targetPath,
      current_path: identicalPath
    });

    // Identical images should have perfect or near-perfect scores
    expect(result.ssim_avg).toBeGreaterThan(0.99);
    expect(result.psnr).toBeGreaterThan(40); // High PSNR for identical
    expect(result.vmaf).toBeGreaterThan(0.9); // VMAF fallback uses SSIM scale (0-1) * 100
  });

  it('should return lower scores for different images', async () => {
    const result = await scoreGlobal({
      target_path: targetPath,
      current_path: currentPath
    });

    // Different images should have lower scores
    expect(result.ssim_avg).toBeLessThan(1.0);
    expect(result.psnr).toBeLessThanOrEqual(100);
    expect(result.vmaf).toBeLessThanOrEqual(100);
  });

  it('should handle non-existent files gracefully', async () => {
    await expect(scoreGlobal({
      target_path: 'nonexistent.png',
      current_path: currentPath
    })).rejects.toThrow();
  });
});