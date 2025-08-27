import { computeDiffWithAlignment } from './dist/tools/compute-diff-with-alignment.js';

console.log('🔄 SIMPLE REGRESSION TEST');

try {
  const result = await computeDiffWithAlignment({
    target_path: './demo/layout-shift/ui-design.png',
    current_path: './demo/layout-shift/result.png',
    preserve_design: true
  });
  
  console.log('✅ Layout Shift Result:');
  console.log('   Canvas:', result.canvas);
  console.log('   Keys:', Object.keys(result));
  if (result.metrics) {
    console.log('   Metrics keys:', Object.keys(result.metrics));
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
