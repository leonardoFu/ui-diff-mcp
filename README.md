# UI Diff MCP Server

A Model Context Protocol (MCP) server for comparing UI designs vs implementations using advanced image metrics (SSIM, PSNR, VMAF).

Based on the [DeltaVision investigation document](docs/deltavision-ssim-psnr-vmaf-investigation.md), this server provides three core tools for automated UI difference detection and analysis.

## Features

- **🎯 Precise Region Detection**: Uses SSIM heatmaps to identify specific UI differences
- **📊 Multiple Metrics**: PSNR, SSIM, and VMAF for comprehensive similarity analysis  
- **🎨 Visual Overlays**: Generate annotated images highlighting difference regions
- **⚡ Fast Processing**: FFmpeg-based implementation for performance
- **🔧 Flexible**: Configurable thresholds and minimum area filters

## Tools

### `compute_diff_regions`

Computes difference regions between target (design) and current (implementation) images.

**Input:**
```typescript
{
  target_path: string,     // Path to design/reference image
  current_path: string,    // Path to implementation image  
  threshold?: number,      // Min difference threshold (0-1, default: 0.0)
  min_area_px?: number    // Min region area in pixels (default: 64)
}
```

**Output:**
```json
{
  "canvas": {"w": 1440, "h": 900},
  "regions": [
    {"id":"r1","bbox":[960,72,240,48],"score":0.78,"max":0.91,"area_px":11520}
  ],
  "metrics": {"psnr": 31.8, "ssim_avg": 0.947},
  "artifacts": {"heatmap_path":"diff_heatmap.png"}
}
```

### `score_global`

Computes global similarity scores between two images.

**Input:**
```typescript
{
  target_path: string,
  current_path: string
}
```

**Output:**
```json
{
  "vmaf": 92.5,
  "ssim_avg": 0.947, 
  "psnr": 31.8
}
```

### `render_overlay`

Renders overlay visualization with highlighted difference regions.

**Input:**
```typescript
{
  current_path: string,
  regions: Region[]  // From compute_diff_regions output
}
```

**Output:**
```
"path/to/overlay_image.png"
```

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "ui-diff": {
      "command": "node",
      "args": ["/path/to/ui-diff-mcp/dist/index.js"]
    }
  }
}
```

### Direct Usage

```typescript
import { computeDiffRegions, scoreGlobal, renderOverlay } from 'ui-diff-mcp';

// Analyze differences
const result = await computeDiffRegions({
  target_path: './design.png',
  current_path: './implementation.png',
  threshold: 0.1,
  min_area_px: 100
});

// Get global scores  
const scores = await scoreGlobal({
  target_path: './design.png', 
  current_path: './implementation.png'
});

// Create overlay visualization
const overlayPath = await renderOverlay({
  current_path: './implementation.png',
  regions: result.regions
});
```

## Requirements

- **Node.js** 18+
- **FFmpeg** with libvmaf support (for VMAF metrics)
  ```bash
  # macOS
  brew install ffmpeg
  
  # Linux
  apt-get install ffmpeg
  ```

## Testing

```bash
npm test          # Run all tests
npm run test:watch # Watch mode for development
```

## Development

Built using Test-Driven Development (TDD):

1. **Red Phase**: Tests written first defining expected behavior
2. **Green Phase**: Minimal implementation to pass tests  
3. **Refactor Phase**: Optimization while keeping tests green

### Architecture

```
src/
├── tools/           # Core MCP tools
│   ├── compute-diff-regions.ts
│   ├── score-global.ts
│   └── render-overlay.ts
├── utils/          # Utility functions
│   ├── ffmpeg.ts   # FFmpeg integration
│   └── image-processing.ts
├── types.ts        # TypeScript types & Zod schemas
├── server.ts       # MCP server implementation
└── index.ts        # Main entry point
```

## Based on DeltaVision Research

This implementation follows the patterns and recommendations from the [DeltaVision investigation document](docs/deltavision-ssim-psnr-vmaf-investigation.md), including:

- FFmpeg-based PSNR/VMAF computation
- SSIM heatmap generation for region detection
- Structured JSON responses matching specified schema
- Configurable thresholds and filtering options

## License

MIT