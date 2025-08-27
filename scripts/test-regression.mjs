import { computeDiffWithAlignment } from '../dist/tools/compute-diff-with-alignment.js';

console.log('🔄 REGRESSION TESTING');
console.log('==================');

// Test layout-shift demo
const layoutResult = await computeDiffWithAlignment({
  target_path: './demo/layout-shift/ui-design.png',
  current_path: './demo/layout-shift/result.png',
  preserve_design: true,
  design_image_first: true,
  implementation_transforms_only: true
});

console.log('\n📋 Layout Shift Demo:');
console.log('   Canvas:', `${layoutResult.canvas.w}x${layoutResult.canvas.h}`);
console.log('   Design preserved:', layoutResult.design_preserved);
console.log('   SSIM:', layoutResult.metrics.ssim.toFixed(3));
console.log('   Diff %:', (layoutResult.metrics.pixelmatch.different_pixels / layoutResult.metrics.pixelmatch.total_pixels * 100).toFixed(2) + '%');

// Test active-tab demo
const activeResult = await computeDiffWithAlignment({
  target_path: './demo/active-tab/ui-design.png',
  current_path: './demo/active-tab/result.png',
  preserve_design: true,
  design_image_first: true,
  implementation_transforms_only: true
});

console.log('\n📋 Active Tab Demo:');
console.log('   Canvas:', `${activeResult.canvas.w}x${activeResult.canvas.h}`);
console.log('   Design preserved:', activeResult.design_preserved);
console.log('   SSIM:', activeResult.metrics.ssim.toFixed(3));
console.log('   Diff %:', (activeResult.metrics.pixelmatch.different_pixels / activeResult.metrics.pixelmatch.total_pixels * 100).toFixed(2) + '%');

// Test backwards compatibility with legacy parameters
const legacyResult = await computeDiffWithAlignment({
  target_path: './demo/dashboard/ui-design.png',
  current_path: './demo/dashboard/result.png'
  // No preserve_design specified - should use default true
});

console.log('\n📋 Legacy Compatibility Test:');
console.log('   Canvas:', `${legacyResult.canvas.w}x${legacyResult.canvas.h}`);
console.log('   Design preserved:', legacyResult.design_preserved);
console.log('   SSIM:', legacyResult.metrics.ssim.toFixed(3));

console.log('\n✅ REGRESSION TESTING COMPLETE');
