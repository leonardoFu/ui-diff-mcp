import { createServer } from '../dist/server.js';

async function testMCPServer() {
  console.log('🔌 Testing MCP Server Interface');
  console.log('================================\n');
  
  const server = createServer();
  
  try {
    // Test tool listing
    console.log('📋 Testing tool listing...');
    const toolsResponse = await server.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    
    const alignTool = toolsResponse.result.tools.find(t => t.name === 'compute_diff_with_alignment');
    
    if (!alignTool) {
      console.log('❌ compute_diff_with_alignment tool not found');
      return;
    }
    
    console.log('✅ Tool found');
    console.log('Description:', alignTool.description);
    
    const props = alignTool.inputSchema.properties;
    const designCentricParams = [
      'preserve_design',
      'design_image_first', 
      'implementation_transforms_only',
      'confidence_threshold'
    ];
    
    console.log('\n🎯 Design-Centric Parameters:');
    designCentricParams.forEach(param => {
      if (param in props) {
        console.log(`✅ ${param}: ${props[param].description}`);
        console.log(`   Type: ${props[param].type}, Default: ${props[param].default}`);
      } else {
        console.log(`❌ ${param}: NOT FOUND`);
      }
    });
    
    // Test tool execution with design-centric parameters
    console.log('\n🧪 Testing tool execution...');
    const executeResponse = await server.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'compute_diff_with_alignment',
        arguments: {
          target_path: './demo/dashboard/ui-design.png',
          current_path: './demo/dashboard/result.png',
          preserve_design: true,
          design_image_first: true,
          implementation_transforms_only: true,
          confidence_threshold: 0.8
        }
      }
    });
    
    if (executeResponse.result && executeResponse.result.content) {
      const result = JSON.parse(executeResponse.result.content[0].text);
      console.log('✅ Tool execution successful');
      console.log(`   Canvas dimensions: ${result.canvas.w}x${result.canvas.h}`);
      console.log(`   Design preserved: ${result.alignment.design_preserved}`);
      console.log(`   Implementation transformed: ${result.alignment.implementation_transformed}`);
    } else if (executeResponse.error) {
      console.log('❌ Tool execution failed:', executeResponse.error);
    }
    
  } catch (error) {
    console.error('❌ MCP server test failed:', error.message);
  }
  
  console.log('\n✨ MCP server testing complete');
}

testMCPServer().catch(console.error);