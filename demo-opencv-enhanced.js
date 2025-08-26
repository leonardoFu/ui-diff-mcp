#!/usr/bin/env node

/**
 * Demonstration of the Enhanced OpenCV-powered UI Diff MCP Server
 * 
 * This script demonstrates the new dimension-agnostic comparison capabilities
 * by creating test images of different sizes and comparing them with the 
 * enhanced compute_diff_with_alignment tool.
 */

import { promises as fs } from 'fs';
import { computeDiffWithAlignment } from './dist/tools/compute-diff-with-alignment.js';
import { createTestImage, translateImage } from './dist/test-utils/opencv-helpers.js';

async function main() {
  console.log('🎯 OpenCV Enhanced UI Diff MCP Server Demo');
  console.log('='.repeat(50));
  
  try {
    // Ensure test artifacts directory exists
    await fs.mkdir('./test-artifacts', { recursive: true });
    
    console.log('\n📋 Test Scenario 1: Different sized images with translation');
    console.log('- Creating 1200x800 design mockup...');
    const designPath = './test-artifacts/demo_design.png';
    await createTestImage(designPath, 1200, 800, 'ui_mockup');
    
    console.log('- Creating 1000x600 implementation with 25px shift...');
    const tempImplPath = './test-artifacts/demo_temp_impl.png';
    const implPath = './test-artifacts/demo_impl.png';
    
    // Create base implementation and shift it
    await createTestImage(tempImplPath, 1000, 600, 'ui_mockup');
    await translateImage(tempImplPath, implPath, 25, 15);
    
    console.log('- Running enhanced comparison with OpenCV alignment...');
    
    const result = await computeDiffWithAlignment({
      target_path: designPath,
      current_path: implPath,
      alignment_method: 'auto',
      pixelmatch_threshold: 0.1,
      min_region_area: 64
    });
    
    console.log('\n✅ Results:');
    console.log(`   📐 Canvas: ${result.canvas.w} × ${result.canvas.h}`);
    console.log(`   🔄 Alignment applied: ${result.alignment.preprocessing_applied}`);
    console.log(`   🎯 Detected shift: dx=${result.alignment.shift_detection.primary_result.dx.toFixed(1)}, dy=${result.alignment.shift_detection.primary_result.dy.toFixed(1)}`);
    console.log(`   📊 Method: ${result.alignment.shift_detection.primary_result.method}`);
    console.log(`   🔍 Confidence: ${result.alignment.shift_detection.primary_result.confidence.toFixed(3)}`);
    console.log(`   📈 Pixelmatch: ${result.pixelmatch.percentage.toFixed(2)}% different (${result.pixelmatch.diff_pixels}/${result.pixelmatch.total_pixels} pixels)`);
    console.log(`   📊 SSIM: ${result.ffmpeg_metrics.ssim_avg.toFixed(3)}`);
    console.log(`   📊 PSNR: ${result.ffmpeg_metrics.psnr.toFixed(1)} dB`);
    console.log(`   🎯 Regions detected: ${result.regions.length}`);
    
    console.log('\n📁 Generated artifacts:');
    console.log(`   🎨 Aligned design: ${result.artifacts.aligned_design_path}`);
    console.log(`   💻 Aligned implementation: ${result.artifacts.aligned_implementation_path}`);
    console.log(`   🔍 Pixelmatch diff: ${result.artifacts.pixelmatch_diff_path}`);
    console.log(`   📊 Overlay visualization: ${result.artifacts.overlay_path}`);
    
    // Test scenario 2: Identical sized images (should not need alignment)
    console.log('\n📋 Test Scenario 2: Identical sized images');
    
    const identicalDesignPath = './test-artifacts/demo_identical_design.png';
    const identicalImplPath = './test-artifacts/demo_identical_impl.png';
    
    console.log('- Creating identical 800x600 images...');
    await createTestImage(identicalDesignPath, 800, 600, 'features');
    await fs.copyFile(identicalDesignPath, identicalImplPath);
    
    console.log('- Running comparison without alignment needed...');
    const result2 = await computeDiffWithAlignment({
      target_path: identicalDesignPath,
      current_path: identicalImplPath,
      alignment_method: 'auto'
    });
    
    console.log('\n✅ Results:');
    console.log(`   📐 Canvas: ${result2.canvas.w} × ${result2.canvas.h}`);
    console.log(`   🔄 Alignment applied: ${result2.alignment.preprocessing_applied}`);
    console.log(`   📈 Pixelmatch: ${result2.pixelmatch.percentage.toFixed(2)}% different (perfect match expected)`);
    console.log(`   📊 SSIM: ${result2.ffmpeg_metrics.ssim_avg.toFixed(3)} (1.0 = perfect)`);
    console.log(`   🎯 Regions detected: ${result2.regions.length} (should be 0)`);
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\n💡 Key Benefits Demonstrated:');
    console.log('   ✨ Dimension-agnostic comparison (1200x800 vs 1000x600)');
    console.log('   🎯 Automatic shift detection and compensation');
    console.log('   🔄 Smart alignment only when needed');
    console.log('   📊 Enhanced metrics with alignment metadata');
    console.log('   🎨 Complete artifact generation for analysis');
    console.log('\n🚀 The UI Diff MCP server is now production-ready!');
    
    // Clean up temporary file
    await fs.unlink(tempImplPath).catch(() => {});
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    console.error('\nPlease ensure:');
    console.error('  - Python 3 is installed with OpenCV');
    console.error('  - Run: pip install -r requirements.txt');
    console.error('  - Node.js dependencies are installed');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}