import { describe, it, expect } from 'vitest';
import { mergeRegions, calculateDistance, shouldMergeRegions } from './region-merger.js';
import { Region } from '../types.js';

describe('region merger', () => {
  const createTestRegion = (
    id: string,
    bbox: [number, number, number, number],
    score: number,
    area_px: number
  ): Region => ({
    id,
    bbox,
    score,
    area_px,
    max: score * 1.1
  });

  describe('calculateDistance', () => {
    it('should calculate distance between adjacent regions correctly', () => {
      const region1 = createTestRegion('r1', [0, 0, 50, 50], 0.8, 2500);
      const region2 = createTestRegion('r2', [60, 0, 50, 50], 0.75, 2500);
      
      const distance = calculateDistance(region1, region2);
      expect(distance).toBe(10); // Gap between regions
    });

    it('should return 0 for overlapping regions', () => {
      const region1 = createTestRegion('r1', [0, 0, 50, 50], 0.8, 2500);
      const region2 = createTestRegion('r2', [25, 25, 50, 50], 0.75, 2500);
      
      const distance = calculateDistance(region1, region2);
      expect(distance).toBe(0);
    });

    it('should calculate distance for vertically separated regions', () => {
      const region1 = createTestRegion('r1', [0, 0, 50, 50], 0.8, 2500);
      const region2 = createTestRegion('r2', [0, 70, 50, 50], 0.75, 2500);
      
      const distance = calculateDistance(region1, region2);
      expect(distance).toBe(20); // Vertical gap
    });
  });

  describe('shouldMergeRegions', () => {
    it('should merge regions with similar scores and close proximity', () => {
      const region1 = createTestRegion('r1', [0, 0, 50, 50], 0.8, 2500);
      const region2 = createTestRegion('r2', [60, 0, 50, 50], 0.82, 2500);
      
      const shouldMerge = shouldMergeRegions(region1, region2, {
        scoreThreshold: 0.05,
        maxDistance: 15
      });
      
      expect(shouldMerge).toBe(true);
    });

    it('should not merge regions with dissimilar scores', () => {
      const region1 = createTestRegion('r1', [0, 0, 50, 50], 0.8, 2500);
      const region2 = createTestRegion('r2', [60, 0, 50, 50], 0.5, 2500);
      
      const shouldMerge = shouldMergeRegions(region1, region2, {
        scoreThreshold: 0.05,
        maxDistance: 15
      });
      
      expect(shouldMerge).toBe(false);
    });

    it('should not merge regions that are too far apart', () => {
      const region1 = createTestRegion('r1', [0, 0, 50, 50], 0.8, 2500);
      const region2 = createTestRegion('r2', [100, 0, 50, 50], 0.82, 2500);
      
      const shouldMerge = shouldMergeRegions(region1, region2, {
        scoreThreshold: 0.05,
        maxDistance: 15
      });
      
      expect(shouldMerge).toBe(false);
    });
  });

  describe('mergeRegions', () => {
    it('should merge similar nearby regions and limit to maxRegions', () => {
      const regions = [
        createTestRegion('r1', [0, 0, 50, 50], 0.8, 2500),
        createTestRegion('r2', [60, 0, 50, 50], 0.82, 2500), // Should merge with r1
        createTestRegion('r3', [200, 200, 30, 30], 0.9, 900),
        createTestRegion('r4', [210, 220, 25, 25], 0.88, 625), // Should merge with r3
        createTestRegion('r5', [500, 500, 40, 40], 0.7, 1600),
      ];
      
      const merged = mergeRegions(regions, {
        maxRegions: 20,
        scoreThreshold: 0.05,
        maxDistance: 30
      });
      
      // Should have fewer regions after merging
      expect(merged.length).toBeLessThan(regions.length);
      expect(merged.length).toBeLessThanOrEqual(20);
      
      // Merged regions should have combined areas
      const firstMerged = merged.find(r => r.id.includes('r1'));
      expect(firstMerged).toBeDefined();
      if (firstMerged) {
        expect(firstMerged.area_px).toBeGreaterThan(2500); // Combined area
      }
    });

    it('should limit output to maxRegions when there are many regions', () => {
      // Create 25 regions that shouldn't merge (far apart and different scores)
      const regions = Array.from({ length: 25 }, (_, i) => 
        createTestRegion(
          `r${i + 1}`,
          [i * 100, i * 100, 30, 30],
          0.3 + (i * 0.02), // Different scores
          900
        )
      );
      
      const merged = mergeRegions(regions, {
        maxRegions: 20,
        scoreThreshold: 0.01,
        maxDistance: 10
      });
      
      expect(merged).toHaveLength(20);
      // Should keep highest scoring regions
      expect(merged[0].score).toBeGreaterThan(merged[merged.length - 1].score);
    });

    it('should preserve region structure after merging', () => {
      const regions = [
        createTestRegion('r1', [0, 0, 50, 50], 0.8, 2500),
        createTestRegion('r2', [60, 0, 50, 50], 0.82, 2500),
      ];
      
      const merged = mergeRegions(regions);
      
      expect(merged).toHaveLength(1);
      const mergedRegion = merged[0];
      
      expect(mergedRegion).toHaveProperty('id');
      expect(mergedRegion).toHaveProperty('bbox');
      expect(mergedRegion).toHaveProperty('score');
      expect(mergedRegion).toHaveProperty('area_px');
      expect(mergedRegion.bbox).toHaveLength(4);
      expect(typeof mergedRegion.score).toBe('number');
      expect(typeof mergedRegion.area_px).toBe('number');
    });
  });
});