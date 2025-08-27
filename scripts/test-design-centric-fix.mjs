import { computeDiffWithAlignment } from '../dist/tools/compute-diff-with-alignment.js';

async function testDesignCentricAlignment() {
  try {
    console.log('Testing design-centric alignment with dashboard demo images...');
    console.log('Design: 2896x2000, Implementation: 2892x2122');
    
    // Test with default parameters (should use design-centric alignment)
    const result = await computeDiffWithAlignment({
      target_path: './demo/dashboard/ui-design.png',
      current_path: './demo/dashboard/result.png',
      preserve_design: true,
      design_image_first: true,
      implementation_transforms_only: true,
      confidence_threshold: 0.7
    });

    console.log('\n✅ SUCCESS! Design-centric alignment worked');
    console.log('Final canvas dimensions:', result.canvas);
    console.log('Design preserved:', result.alignment.design_preserved);
    console.log('Implementation transformed:', result.alignment.implementation_transformed);
    console.log('Preprocessing applied:', result.alignment.preprocessing_applied);
    
    console.log('\nArtifacts created:');
    console.log('- Aligned design:', result.artifacts.aligned_design_path);
    console.log('- Aligned implementation:', result.artifacts.aligned_implementation_path);
    console.log('- Pixelmatch diff:', result.artifacts.pixelmatch_diff_path);
    console.log('- Overlay:', result.artifacts.overlay_path);

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    
    if (error.message.includes('Image dimensions must match')) {
      console.error('\nROOT CAUSE: Design-centric alignment failed to produce matching dimensions');
      console.error('Expected: Both aligned images should be 2896x2000 (design dimensions)');
    }
  }
}

testDesignCentricAlignment();