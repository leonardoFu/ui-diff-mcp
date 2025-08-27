import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';

async function testAlignment() {
  const transport = new StdioClientTransport({
    command: 'npm',
    args: ['run', 'start']
  });
  
  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });
  
  try {
    await client.connect(transport);
    
    console.log('=== TESTING COMPLETE ALIGNMENT WORKFLOW ===');
    
    // Create test output directory
    if (!fs.existsSync('/Users/leo/dev/personal/ui-diff-mcp/test-output')) {
      fs.mkdirSync('/Users/leo/dev/personal/ui-diff-mcp/test-output', { recursive: true });
    }
    
    // Test 1: Complete alignment workflow with auto method
    console.log('\n1. Testing complete alignment workflow (auto method):');
    const result1 = await client.request({
      method: 'tools/call',
      params: {
        name: 'compute_diff_with_alignment',
        arguments: {
          target_image: '/Users/leo/dev/personal/ui-diff-mcp/demo/active-tab/ui-design.png',
          result_image: '/Users/leo/dev/personal/ui-diff-mcp/demo/active-tab/result.png',
          alignment_method: 'auto',
          output_dir: '/Users/leo/dev/personal/ui-diff-mcp/test-output'
        }
      }
    });
    console.log('Result:', JSON.stringify(result1.content[0].text, null, 2));
    
    // Test 2: Test with phase correlation method
    console.log('\n2. Testing with phase_correlation method:');
    const result2 = await client.request({
      method: 'tools/call',
      params: {
        name: 'compute_diff_with_alignment',
        arguments: {
          target_image: '/Users/leo/dev/personal/ui-diff-mcp/demo/active-tab/ui-design.png',
          result_image: '/Users/leo/dev/personal/ui-diff-mcp/demo/active-tab/result.png',
          alignment_method: 'phase_correlation',
          output_dir: '/Users/leo/dev/personal/ui-diff-mcp/test-output'
        }
      }
    });
    console.log('Result:', JSON.stringify(result2.content[0].text, null, 2));
    
    await client.close();
    console.log('\n=== ALIGNMENT WORKFLOW TESTING COMPLETE ===');
    
  } catch (error) {
    console.error('Error during testing:', error.message);
    process.exit(1);
  }
}

testAlignment();
