#!/usr/bin/env node

/**
 * Test script to verify the streamlined MCP server works with just the "diff" tool
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createServer } from './dist/server.js';

async function testStreamlinedMCP() {
  console.log('🧪 Testing Streamlined MCP Server...\n');
  
  try {
    // Create the streamlined server
    const server = createServer();
    console.log('✅ Server created successfully');
    
    // Test tool listing
    console.log('\n📋 Testing tool listing...');
    const toolsResponse = await server.request({
      method: 'tools/list',
      params: {}
    }, { requestId: 'test-1' });
    
    const tools = toolsResponse.tools || [];
    console.log(`Found ${tools.length} tool(s):`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    
    // Verify we only have the "diff" tool
    if (tools.length === 1 && tools[0].name === 'diff') {
      console.log('✅ Correct - only "diff" tool is registered');
    } else {
      console.error('❌ Error - Expected only "diff" tool, got:', tools.map(t => t.name));
      return false;
    }
    
    // Test tool schema
    console.log('\n🔧 Testing tool schema...');
    const diffTool = tools[0];
    const requiredParams = diffTool.inputSchema?.required || [];
    console.log(`Required parameters: ${requiredParams.join(', ')}`);
    
    if (requiredParams.includes('target_path') && requiredParams.includes('current_path')) {
      console.log('✅ Required parameters are correct');
    } else {
      console.error('❌ Error - Missing required parameters');
      return false;
    }
    
    // Check available parameters
    const properties = diffTool.inputSchema?.properties || {};
    const availableParams = Object.keys(properties);
    console.log(`Available parameters: ${availableParams.join(', ')}`);
    
    const expectedParams = [
      'target_path', 'current_path', 'alignment_method', 'pixelmatch_threshold',
      'min_region_area', 'disable_alignment', 'preserve_design', 
      'design_image_first', 'implementation_transforms_only'
    ];
    
    const hasAllParams = expectedParams.every(param => availableParams.includes(param));
    if (hasAllParams) {
      console.log('✅ All expected parameters are available');
    } else {
      const missing = expectedParams.filter(param => !availableParams.includes(param));
      console.error('❌ Error - Missing parameters:', missing);
      return false;
    }
    
    console.log('\n🎉 All tests passed! The streamlined MCP server is working correctly.');
    console.log('\n📊 Summary:');
    console.log('  ✓ Server registration successful');
    console.log('  ✓ Only "diff" tool exposed');
    console.log('  ✓ All parameters available');
    console.log('  ✓ Required parameters validated');
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testStreamlinedMCP().then(success => {
  process.exit(success ? 0 : 1);
});