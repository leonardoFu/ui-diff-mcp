#!/usr/bin/env node

import { computeDiffRegions, scoreGlobal, renderOverlay } from './index.js';
import { promises as fs } from 'fs';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log(`
Usage: 
  ui-diff compute <target.png> <current.png> [threshold] [min_area_px]
  ui-diff score <target.png> <current.png>  
  ui-diff overlay <current.png> <regions.json>

Examples:
  ui-diff compute design.png implementation.png 0.1 100
  ui-diff score design.png implementation.png
  ui-diff overlay implementation.png regions.json
    `);
    process.exit(1);
  }
  
  const [command, ...cmdArgs] = args;
  
  try {
    switch (command) {
      case 'compute': {
        const [target, current, threshold, minArea] = cmdArgs;
        const result = await computeDiffRegions({
          target_path: target,
          current_path: current,
          threshold: threshold ? parseFloat(threshold) : 0.1,
          min_area_px: minArea ? parseInt(minArea) : 64,
          max_regions: 20,
          merge_score_threshold: 0.05,
          merge_distance_threshold: 50
        });
        
        console.log(JSON.stringify(result, null, 2));
        
        // Save regions to file for convenience
        await fs.writeFile('regions.json', JSON.stringify(result.regions, null, 2));
        console.log('\\nRegions saved to regions.json');
        break;
      }
      
      case 'score': {
        const [target, current] = cmdArgs;
        const result = await scoreGlobal({
          target_path: target,
          current_path: current
        });
        
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'overlay': {
        const [current, regionsFile] = cmdArgs;
        const regionsData = await fs.readFile(regionsFile, 'utf8');
        const regions = JSON.parse(regionsData);
        
        const overlayPath = await renderOverlay({
          current_path: current,
          regions
        });
        
        console.log(`Overlay created: ${overlayPath}`);
        break;
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}