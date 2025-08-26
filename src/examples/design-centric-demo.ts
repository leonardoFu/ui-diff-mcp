/**
 * Design-Centric Alignment Demonstration
 * 
 * This example shows how the new design-centric alignment system works
 * compared to the legacy mutual cropping approach.
 */

import { computeDiffWithAlignment } from '../tools/compute-diff-with-alignment.js';
import { createTestImage, translateImage } from '../test-utils/opencv-helpers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function demonstrateDesignCentricAlignment() {
  console.log('🎨 Design-Centric Alignment Demonstration');
  console.log('==========================================');

  // Create demo directory
  const demoDir = path.join(__dirname, '../../demo-artifacts');
  await import('fs').then(fs => fs.promises.mkdir(demoDir, { recursive: true }));

  // Create test images
  const designPath = path.join(demoDir, 'design_1200x800.png');
  const implPath = path.join(demoDir, 'implementation_900x600.png');
  const shiftedImplPath = path.join(demoDir, 'implementation_shifted.png');

  console.log('📝 Creating test images...');
  console.log(`  Design: 1200×800 pixels`);
  console.log(`  Implementation: 900×600 pixels`);

  await createTestImage(designPath, 1200, 800, 'ui_mockup');
  await createTestImage(implPath, 900, 600, 'ui_mockup');
  await translateImage(implPath, shiftedImplPath, 50, 30);

  // Test 1: NEW Design-Centric Behavior (default)
  console.log('\n🆕 NEW: Design-Centric Alignment');
  console.log('--------------------------------');
  
  const newResult = await computeDiffWithAlignment({
    target_path: designPath,
    current_path: shiftedImplPath,
    preserve_design: true,        // NEW: Preserve design dimensions
    design_image_first: true      // NEW: target_path is design
  });

  console.log(`✅ Final Canvas: ${newResult.canvas.w}×${newResult.canvas.h}`);
  console.log(`✅ Design Preserved: ${newResult.alignment.design_preserved}`);
  console.log(`✅ Implementation Transformed: ${newResult.alignment.implementation_transformed}`);
  console.log(`📄 Artifacts:`);
  console.log(`   - Design (preserved): ${newResult.artifacts.aligned_design_path}`);
  console.log(`   - Implementation (transformed): ${newResult.artifacts.aligned_implementation_path}`);
  console.log(`   - Diff overlay: ${newResult.artifacts.overlay_path}`);

  // Test 2: OLD Mutual Cropping Behavior (for comparison)
  console.log('\n📜 LEGACY: Mutual Cropping Alignment');
  console.log('------------------------------------');
  
  const legacyResult = await computeDiffWithAlignment({
    target_path: designPath,
    current_path: shiftedImplPath,
    preserve_design: false        // OLD: Use mutual cropping
  });

  console.log(`✅ Final Canvas: ${legacyResult.canvas.w}×${legacyResult.canvas.h}`);
  console.log(`✅ Both Images Cropped to Common Area`);
  console.log(`📄 Artifacts:`);
  console.log(`   - Cropped Design: ${legacyResult.artifacts.aligned_design_path}`);
  console.log(`   - Cropped Implementation: ${legacyResult.artifacts.aligned_implementation_path}`);

  // Test 3: User-specified design image (implementation first)
  console.log('\n🔄 ADVANCED: User-Specified Design Image');
  console.log('----------------------------------------');
  
  const advancedResult = await computeDiffWithAlignment({
    target_path: shiftedImplPath,      // Implementation first
    current_path: designPath,          // Design second
    preserve_design: true,
    design_image_first: false          // NEW: current_path is design
  });

  console.log(`✅ Final Canvas: ${advancedResult.canvas.w}×${advancedResult.canvas.h}`);
  console.log(`✅ Design (second image) Preserved: ${advancedResult.alignment.design_preserved}`);

  console.log('\n🎯 Summary of Benefits:');
  console.log('----------------------');
  console.log('✨ Design integrity maintained at full resolution');
  console.log('✨ Complete design context preserved for comparison');
  console.log('✨ Implementation transformed to design coordinate space');
  console.log('✨ Backward compatible with legacy behavior');
  console.log('✨ User control over design vs implementation roles');

  console.log(`\n📁 Demo artifacts saved to: ${demoDir}`);
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateDesignCentricAlignment().catch(console.error);
}