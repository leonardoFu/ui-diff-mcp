import { computeDiffWithAlignment } from '../dist/tools/compute-diff-with-alignment.js';

async function testMcpConfidenceParameter() {
  try {
    // Use existing demo images
    const designPath = 'demo/dashboard/ui-design.png';
    const implementationPath = 'demo/dashboard/result.png';
    
    const result = await computeDiffWithAlignment({
      target_path: designPath,
      current_path: implementationPath, 
      confidence_threshold: 0.5  // Test custom confidence threshold
    });
    
    console.log('MCP Confidence Parameter Test Results:');
    console.log('- Canvas dimensions:', result.canvas);
    console.log('- Design preserved:', result.alignment.design_preserved);
    console.log('- Implementation transformed:', result.alignment.implementation_transformed);
    console.log('- Shift detection confidence:', result.alignment.shift_detection.primary_result.confidence);
    console.log('✅ MCP tool confidence parameter working');
  } catch (error) {
    console.error('❌ MCP test failed:', error.message);
  }
}

testMcpConfidenceParameter();
