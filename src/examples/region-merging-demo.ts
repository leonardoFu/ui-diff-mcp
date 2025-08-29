/**
 * Region Merging Performance and Feature Demonstration
 * 
 * This example demonstrates the region merging functionality added to the UI Diff MCP server.
 * It shows how the new clustering algorithm optimizes response sizes while preserving critical
 * metadata for UI comparison workflows.
 */

import { computeDiffRegions } from '../tools/compute-diff-regions.js';
import { computeDiffWithAlignment } from '../tools/compute-diff-with-alignment.js';
import { createTestImages } from '../test-utils/image-helpers.js';
import { promises as fs } from 'fs';
import path from 'path';

async function demonstrateRegionMerging() {
  console.log('🔍 Region Merging Demo - UI Diff MCP Enhancement');
  console.log('=' .repeat(60));

  // Setup test environment
  const testDir = path.join(process.cwd(), 'test-artifacts', 'region-merging-demo');
  await fs.mkdir(testDir, { recursive: true });
  
  try {
    // Create test images
    console.log('📸 Creating test images...');
    const { target, current } = await createTestImages();
    const targetPath = path.join(testDir, 'target.png');
    const currentPath = path.join(testDir, 'current.png');
    
    await fs.writeFile(targetPath, target);
    await fs.writeFile(currentPath, current);
    console.log(`   ✅ Target image: ${targetPath}`);
    console.log(`   ✅ Current image: ${currentPath}`);

    console.log('\n📊 Performance Comparison:');
    console.log('-' .repeat(40));

    // 1. Legacy behavior (no merging, high region count)
    console.log('🔧 Testing legacy behavior (no optimization)...');
    const startLegacy = Date.now();
    const legacy = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.0,
      min_area_px: 1,
      max_regions: 1000, // Very high limit
      merge_score_threshold: 0.001, // Very strict
      merge_distance_threshold: 1 // Very strict
    });
    const legacyTime = Date.now() - startLegacy;
    
    console.log(`   📈 Legacy result: ${legacy.regions.length} regions`);
    console.log(`   ⏱️  Processing time: ${legacyTime}ms`);
    console.log(`   💾 Response size: ~${JSON.stringify(legacy).length} chars`);

    // 2. Optimized behavior (with merging)
    console.log('\n🚀 Testing optimized behavior (with merging)...');
    const startOptimized = Date.now();
    const optimized = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.0,
      min_area_px: 1,
      max_regions: 20, // Default limit
      merge_score_threshold: 0.05, // Default merging
      merge_distance_threshold: 50 // Default distance
    });
    const optimizedTime = Date.now() - startOptimized;
    
    console.log(`   📉 Optimized result: ${optimized.regions.length} regions`);
    console.log(`   ⏱️  Processing time: ${optimizedTime}ms`);
    console.log(`   💾 Response size: ~${JSON.stringify(optimized).length} chars`);
    
    // Calculate improvements
    const regionReduction = ((legacy.regions.length - optimized.regions.length) / legacy.regions.length * 100).toFixed(1);
    const sizeReduction = ((JSON.stringify(legacy).length - JSON.stringify(optimized).length) / JSON.stringify(legacy).length * 100).toFixed(1);
    
    console.log('\n📈 Performance Improvements:');
    console.log(`   🎯 Region count reduction: ${regionReduction}%`);
    console.log(`   📦 Response size reduction: ${sizeReduction}%`);

    // 3. Demonstrate different clustering strategies
    console.log('\n🎛️  Clustering Strategy Examples:');
    console.log('-' .repeat(40));

    // Aggressive clustering
    console.log('🔥 Aggressive clustering (max similarity grouping)...');
    const aggressive = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.0,
      min_area_px: 1,
      max_regions: 5,
      merge_score_threshold: 0.3, // Very permissive
      merge_distance_threshold: 200 // Very generous distance
    });
    console.log(`   🎯 Result: ${aggressive.regions.length} regions (ultra-compact)`);

    // Conservative clustering
    console.log('🎛️  Conservative clustering (preserve detail)...');
    const conservative = await computeDiffRegions({
      target_path: targetPath,
      current_path: currentPath,
      threshold: 0.0,
      min_area_px: 1,
      max_regions: 15,
      merge_score_threshold: 0.02, // Strict similarity
      merge_distance_threshold: 20 // Close proximity only
    });
    console.log(`   🔍 Result: ${conservative.regions.length} regions (detail-preserved)`);

    // 4. Integration with alignment
    console.log('\n🔄 Integration with Alignment:');
    console.log('-' .repeat(40));
    
    const alignedResult = await computeDiffWithAlignment({
      target_path: targetPath,
      current_path: currentPath,
      disable_alignment: true, // For demo simplicity
      max_regions: 10,
      merge_score_threshold: 0.1,
      merge_distance_threshold: 75
    });
    
    console.log(`   ✅ Enhanced diff with alignment: ${alignedResult.regions.length} regions`);
    console.log(`   🎯 Pixelmatch differences: ${alignedResult.pixelmatch.diff_pixels} pixels`);
    console.log(`   📊 SSIM score: ${alignedResult.ffmpeg_metrics.ssim_avg.toFixed(3)}`);
    console.log(`   📊 PSNR score: ${alignedResult.ffmpeg_metrics.psnr.toFixed(2)}dB`);

    // 5. Quality validation
    console.log('\n✅ Quality Validation:');
    console.log('-' .repeat(40));
    
    // Verify regions are properly structured
    const sampleRegion = optimized.regions[0];
    if (sampleRegion) {
      console.log('   📦 Sample merged region structure:');
      console.log(`      ID: ${sampleRegion.id}`);
      console.log(`      Bbox: [${sampleRegion.bbox.join(', ')}]`);
      console.log(`      Score: ${sampleRegion.score.toFixed(3)}`);
      console.log(`      Area: ${sampleRegion.area_px}px`);
      console.log(`      Max: ${sampleRegion.max?.toFixed(3) || 'N/A'}`);
    }

    console.log('\n🎉 Region Merging Demo Complete!');
    console.log('=' .repeat(60));
    console.log('✨ Key Benefits Demonstrated:');
    console.log('   🚀 Reduced response sizes for better performance');
    console.log('   🎯 Configurable clustering for different use cases');
    console.log('   🔄 Full integration with existing alignment pipeline');
    console.log('   📊 Preserved critical metadata and quality metrics');
    console.log('   🔧 Backward compatible API with sensible defaults');

  } finally {
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
    console.log('\n🧹 Cleanup completed');
  }
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateRegionMerging().catch(console.error);
}

export { demonstrateRegionMerging };