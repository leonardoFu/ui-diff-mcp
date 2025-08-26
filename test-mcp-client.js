#!/usr/bin/env node

/**
 * Simple MCP client to test the UI Diff server
 * Run: node test-mcp-client.js
 */

import { spawn } from 'child_process';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function testMCPServer() {
  // Start the MCP server
  const serverProcess = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Create transport and client
  const transport = new StdioClientTransport({
    reader: serverProcess.stdout,
    writer: serverProcess.stdin
  });
  
  const client = new Client({
    name: 'ui-diff-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });
  
  try {
    // Connect to server
    await client.connect(transport);
    console.log('✅ Connected to MCP server');
    
    // List available tools
    const tools = await client.listTools();
    console.log('🔧 Available tools:', tools.tools.map(t => t.name));
    
    // Test with sample data (these would be real image paths in practice)
    console.log('\\n📊 Testing compute_diff_regions...');
    try {
      const result = await client.callTool({
        name: 'compute_diff_regions',
        arguments: {
          target_path: './test-image1.png',
          current_path: './test-image2.png',
          threshold: 0.1,
          min_area_px: 64
        }
      });
      console.log('Result:', result);
    } catch (error) {
      console.log('Expected error (no test images):', error.message);
    }
    
    console.log('\\n🎯 Testing score_global...');
    try {
      const result = await client.callTool({
        name: 'score_global',
        arguments: {
          target_path: './test-image1.png',
          current_path: './test-image2.png'
        }
      });
      console.log('Result:', result);
    } catch (error) {
      console.log('Expected error (no test images):', error.message);
    }
    
    console.log('\\n🎨 Testing render_overlay...');
    try {
      const result = await client.callTool({
        name: 'render_overlay',
        arguments: {
          current_path: './test-image.png',
          regions: [
            {
              id: 'r1',
              bbox: [100, 100, 200, 150],
              score: 0.78,
              max: 0.91,
              area_px: 30000
            }
          ]
        }
      });
      console.log('Result:', result);
    } catch (error) {
      console.log('Expected error (no test images):', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Cleanup
    client.close();
    serverProcess.kill();
    console.log('\\n🔚 Test completed');
  }
}

testMCPServer().catch(console.error);