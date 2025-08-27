#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

async function testAlignment() {
    console.log('=== TESTING UI DIFF ALIGNMENT WITH DEMO IMAGES ===\n');
    
    const targetPath = path.resolve('./demo/active-tab/ui-design.png');
    const currentPath = path.resolve('./demo/active-tab/result.png');
    const outputDir = path.resolve('./test-artifacts');
    
    console.log('Target (design) image:', targetPath);
    console.log('Current (result) image:', currentPath);
    console.log('Output directory:', outputDir);
    console.log('');
    
    // Create a simple MCP client to test the alignment
    const mcpServer = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let responseBuffer = '';
    
    mcpServer.stdout.on('data', (data) => {
        responseBuffer += data.toString();
        console.log('Server output:', data.toString().trim());
    });
    
    mcpServer.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
    });
    
    // Send initialization request
    const initRequest = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }
    };
    
    console.log('Sending initialization request...');
    mcpServer.stdin.write(JSON.stringify(initRequest) + '\n');
    
    // Wait a bit then send alignment request
    setTimeout(() => {
        const alignmentRequest = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "compute_diff_with_alignment",
                "arguments": {
                    "target_path": targetPath,
                    "current_path": currentPath,
                    "output_dir": outputDir,
                    "alignment_method": "auto",
                    "preserve_design": true,
                    "design_is_target": true
                }
            }
        };
        
        console.log('\nSending alignment test request...');
        console.log('Request:', JSON.stringify(alignmentRequest, null, 2));
        mcpServer.stdin.write(JSON.stringify(alignmentRequest) + '\n');
        
        // Close after sending request
        setTimeout(() => {
            mcpServer.stdin.end();
        }, 2000);
        
    }, 1000);
    
    mcpServer.on('close', (code) => {
        console.log(`\nMCP server process exited with code ${code}`);
        console.log('\n=== TEST COMPLETE ===');
    });
}

testAlignment().catch(console.error);