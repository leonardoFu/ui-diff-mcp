import { computeDiffWithAlignment } from '../dist/tools/compute-diff-with-alignment.js';

console.log('🔄 COMPREHENSIVE REGRESSION TEST');
console.log('===============================');

// Test layout-shift demo (should be perfect match)
const layoutResult = await computeDiffWithAlignment({
  target_path: './demo/layout-shift/ui-design.png',
  current_path: './demo/layout-shift/result.png',
  preserve_design: true
});

console.log('\n📋 Layout Shift Demo:');
console.log('   Canvas:', `${layoutResult.canvas.w}x${layoutResult.canvas.h}`);
console.log('   Design preserved:', layoutResult.alignment?.design_preserved);
console.log('   SSIM:', layoutResult.ffmpeg_metrics?.ssim?.toFixed(3) || 'N/A');
console.log('   Regions:', layoutResult.regions?.length || 0);
console.log('   Status:', layoutResult.regions?.length === 0 ? '✅ Perfect Match' : '⚠️  Has Differences');

// Test active-tab demo
const activeResult = await computeDiffWithAlignment({
  target_path: './demo/active-tab/ui-design.png',
  current_path: './demo/active-tab/result.png',
  preserve_design: true
});

console.log('\n📋 Active Tab Demo:');
console.log('   Canvas:', `${activeResult.canvas.w}x${activeResult.canvas.h}`);
console.log('   Design preserved:', activeResult.alignment?.design_preserved);
console.log('   SSIM:', activeResult.ffmpeg_metrics?.ssim?.toFixed(3) || 'N/A');
console.log('   Regions:', activeResult.regions?.length || 0);
console.log('   Status:', activeResult.regions?.length < 50 ? '✅ Good Quality' : '⚠️  Many Differences');

// Test backwards compatibility
const legacyResult = await computeDiffWithAlignment({
  target_path: './demo/dashboard/ui-design.png',
  current_path: './demo/dashboard/result.png'
  // Using defaults
});

console.log('\n📋 Legacy Compatibility (Dashboard):');
console.log('   Canvas:', `${legacyResult.canvas.w}x${legacyResult.canvas.h}`);
console.log('   Design preserved:', legacyResult.alignment?.design_preserved);
console.log('   SSIM:', legacyResult.ffmpeg_metrics?.ssim?.toFixed(3) || 'N/A');
console.log('   Regions:', legacyResult.regions?.length || 0);

console.log('\n🎯 CRITICAL DIMENSION VERIFICATION');
console.log('   Dashboard Canvas:', `${legacyResult.canvas.w}x${legacyResult.canvas.h}`);
console.log('   Expected: 2896x2000');
console.log('   Match:', legacyResult.canvas.w === 2896 && legacyResult.canvas.h === 2000 ? '✅ PASSED' : '❌ FAILED');

console.log('\n✅ ALL REGRESSION TESTS COMPLETE');
