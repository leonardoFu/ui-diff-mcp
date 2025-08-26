#!/usr/bin/env node

/**
 * Creates test images for manual MCP server testing
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';

async function createTestImages() {
  console.log('🎨 Creating test images...');
  
  // Create a simple "design" image - blue background with white text
  const designImage = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 70, g: 130, b: 180 } // Steel blue
    }
  })
  .composite([
    {
      input: Buffer.from(
        `<svg width="800" height="600">
          <rect width="800" height="600" fill="rgb(70,130,180)"/>
          <text x="400" y="200" font-family="Arial" font-size="48" fill="white" text-anchor="middle">
            Design Mockup
          </text>
          <rect x="300" y="300" width="200" height="100" fill="white" opacity="0.8"/>
          <text x="400" y="360" font-family="Arial" font-size="24" fill="black" text-anchor="middle">
            Button
          </text>
        </svg>`
      ),
      top: 0,
      left: 0
    }
  ])
  .png()
  .toBuffer();
  
  // Create an "implementation" image - similar but with differences
  const implementationImage = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 70, g: 130, b: 180 }
    }
  })
  .composite([
    {
      input: Buffer.from(
        `<svg width="800" height="600">
          <rect width="800" height="600" fill="rgb(70,130,180)"/>
          <text x="400" y="200" font-family="Arial" font-size="48" fill="white" text-anchor="middle">
            Implementation
          </text>
          <rect x="320" y="320" width="160" height="80" fill="lightgreen" opacity="0.9"/>
          <text x="400" y="370" font-family="Arial" font-size="20" fill="black" text-anchor="middle">
            Submit
          </text>
          <circle cx="100" cy="100" r="30" fill="red" opacity="0.7"/>
        </svg>`
      ),
      top: 0,
      left: 0
    }
  ])
  .png()
  .toBuffer();
  
  // Save test images
  await fs.writeFile('design.png', designImage);
  await fs.writeFile('implementation.png', implementationImage);
  
  console.log('✅ Created test images:');
  console.log('  - design.png (target/reference)');
  console.log('  - implementation.png (current/comparison)');
  console.log('');
  console.log('🧪 Test with these commands:');
  console.log('  npm run build');
  console.log('  node dist/cli.js compute design.png implementation.png 0.1 100');
  console.log('  node dist/cli.js score design.png implementation.png');
  console.log('  node dist/cli.js overlay implementation.png regions.json');
}

createTestImages().catch(console.error);