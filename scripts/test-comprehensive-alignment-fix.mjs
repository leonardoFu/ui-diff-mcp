import { computeDiffWithAlignment } from '../dist/tools/compute-diff-with-alignment.js';
import { createServer } from '../dist/server.js';

async function runComprehensiveTests() {
  console.log('🧪 COMPREHENSIVE ALIGNMENT FIX TESTING');
  console.log('======================================\n');

  const tests = [
    {
      name: 'Dashboard Demo - Design-Centric (Default)',
      config: {
        target_path: './demo/dashboard/ui-design.png',
        current_path: './demo/dashboard/result.png',
        preserve_design: true,
        design_image_first: true
      }
    },
    {
      name: 'Dashboard Demo - Legacy Cropping Mode',
      config: {
        target_path: './demo/dashboard/ui-design.png',
        current_path: './demo/dashboard/result.png',
        preserve_design: false,
        implementation_transforms_only: false
      }
    },
    {
      name: 'Active Tab Demo - Design-Centric',
      config: {
        target_path: './demo/active-tab/ui-design.png',
        current_path: './demo/active-tab/result.png',
        preserve_design: true,
        design_image_first: true
      }
    },
    {
      name: 'Layout Shift Demo - Design-Centric',
      config: {
        target_path: './demo/layout-shift/ui-design.png',
        current_path: './demo/layout-shift/result.png',
        preserve_design: true,
        design_image_first: true
      }
    }
  ];

  for (const test of tests) {
    console.log(`\n📋 TEST: ${test.name}`);
    console.log('─'.repeat(50));
    
    try {
      const result = await computeDiffWithAlignment(test.config);
      
      console.log(`✅ SUCCESS`);
      console.log(`   Canvas: ${result.canvas.w}x${result.canvas.h}`);
      console.log(`   Design preserved: ${result.alignment.design_preserved}`);
      console.log(`   Implementation transformed: ${result.alignment.implementation_transformed}`);
      console.log(`   Preprocessing applied: ${result.alignment.preprocessing_applied}`);
      console.log(`   Pixelmatch diff: ${result.pixelmatch.percentage.toFixed(2)}%`);
      console.log(`   SSIM: ${result.ffmpeg_metrics.ssim_avg.toFixed(3)}`);
      console.log(`   Regions found: ${result.regions.length}`);
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
    }
  }
  
  console.log('\n🔧 MCP SERVER INTERFACE TEST');
  console.log('─'.repeat(30));
  
  try {
    const server = createServer();
    const tools = await server.request({ method: 'tools/list' }, {});
    const alignTool = tools.tools.find(t => t.name === 'compute_diff_with_alignment');
    
    if (alignTool) {
      console.log('✅ MCP tool found');
      const props = alignTool.inputSchema.properties;
      const newParams = ['preserve_design', 'design_image_first', 'implementation_transforms_only', 'confidence_threshold'];
      const exposedParams = newParams.filter(p => p in props);
      console.log(`   Exposed design-centric params: ${exposedParams.join(', ')}`);
      console.log(`   All parameters exposed: ${exposedParams.length === newParams.length ? 'YES' : 'NO'}`);
    } else {
      console.log('❌ MCP tool not found');
    }
    
  } catch (error) {
    console.log(`❌ MCP test failed: ${error.message}`);
  }
  
  console.log('\n🎯 CRITICAL DIMENSION TEST');  
  console.log('─'.repeat(25));
  
  // Test the specific failing case from the issue
  try {
    const result = await computeDiffWithAlignment({
      target_path: './demo/dashboard/ui-design.png',  // 2896x2000
      current_path: './demo/dashboard/result.png',    // 2892x2122
      preserve_design: true,
      design_image_first: true
    });
    
    if (result.canvas.w === 2896 && result.canvas.h === 2000) {
      console.log('✅ CRITICAL FIX VERIFIED: Aligned images have matching dimensions');
      console.log(`   Expected: 2896x2000, Got: ${result.canvas.w}x${result.canvas.h}`);
    } else {
      console.log(`❌ DIMENSION MISMATCH: Expected 2896x2000, Got: ${result.canvas.w}x${result.canvas.h}`);
    }
    
  } catch (error) {
    if (error.message.includes('Image dimensions must match')) {
      console.log('❌ CRITICAL FIX FAILED: Still getting dimension mismatch error');
    } else {
      console.log(`❌ Unexpected error: ${error.message}`);
    }
  }
  
  console.log('\n✨ TESTING COMPLETE');
}

runComprehensiveTests().catch(console.error);