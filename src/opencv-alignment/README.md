# OpenCV Global Shift Detection System

This module provides dimension-agnostic UI comparison using OpenCV computer vision algorithms to detect and compensate for global shifts between images before comparison.

## Features

- **Phase Correlation**: Fast translation detection for pure shifts
- **ECC Registration**: Affine transformation detection (translation, rotation, scaling)
- **Feature Matching + RANSAC**: Robust detection using ORB features
- **Multi-Method Analysis**: Consolidates results from multiple detection methods
- **Automatic Alignment**: Crops images to overlapping regions after shift compensation
- **Intelligent Preprocessing**: Determines when alignment is needed vs. direct comparison

## Usage

### Basic Detection

```typescript
import { OpenCVGlobalShiftDetector } from './opencv-detector.js';

const detector = new OpenCVGlobalShiftDetector();

// Detect shift between two images
const result = await detector.analyzeShift('design.png', 'implementation.png');

console.log(result.primary_result);
// { dx: 25, dy: 15, confidence: 0.85, method: 'phase_correlation' }

console.log(result.recommendation);
// { action: 'minor_alignment', reason: 'Minor shift detected', shift: { dx: 25, dy: 15 } }
```

### Image Alignment

```typescript
import { ImageAligner } from './image-aligner.js';

const aligner = new ImageAligner();

// Align and crop images based on shift analysis
const alignmentResult = await aligner.alignAndCrop(
  'design.png', 
  'implementation.png', 
  shiftAnalysis
);

console.log(alignmentResult);
// {
//   alignedImageA: '/tmp/aligned_a_123456.png',
//   alignedImageB: '/tmp/aligned_b_123456.png', 
//   croppedDimensions: { width: 800, height: 600 },
//   alignmentApplied: true,
//   shiftCompensation: { dx: 25, dy: 15 }
// }
```

### Enhanced Diff with Alignment

```typescript
import { computeDiffWithAlignment } from '../tools/compute-diff-with-alignment.js';

const result = await computeDiffWithAlignment({
  target_path: 'design.png',
  current_path: 'implementation.png',
  alignment_method: 'auto', // or 'phase_correlation', 'ecc', 'feature_matching'
  pixelmatch_threshold: 0.1,
  min_region_area: 64
});

console.log(result);
// {
//   canvas: { w: 800, h: 600 },
//   alignment: {
//     shift_detection: { ... },
//     preprocessing_applied: true,
//     cropped_dimensions: { w: 800, h: 600 }
//   },
//   pixelmatch: { total_pixels: 480000, diff_pixels: 1250, percentage: 0.26 },
//   ffmpeg_metrics: { ssim_avg: 0.95, psnr: 42.3, vmaf: 85.2 },
//   artifacts: { ... },
//   regions: [ ... ]
// }
```

## Detection Methods

### Phase Correlation
- **Best for**: Pure translations (no rotation/scaling)
- **Speed**: Fastest (O(n log n))
- **Accuracy**: Sub-pixel precision for translations
- **Limitations**: Struggles with rotations and scaling

### ECC Registration  
- **Best for**: Affine transformations (translation + rotation + scaling)
- **Speed**: Medium (iterative algorithm)
- **Accuracy**: High for complex transformations
- **Limitations**: May fail to converge on dissimilar images

### Feature Matching + RANSAC
- **Best for**: Robust detection with outlier rejection
- **Speed**: Slowest (feature extraction + matching)
- **Accuracy**: Good for images with sufficient features
- **Limitations**: Requires distinctive visual features

## Configuration

### Detector Configuration

```typescript
const detector = new OpenCVGlobalShiftDetector({
  methods: [
    { name: 'phase_correlation', enabled: true, confidenceThreshold: 0.1 },
    { name: 'ecc_registration', enabled: true, confidenceThreshold: 0.3 },
    { name: 'feature_matching', enabled: false, confidenceThreshold: 0.2 }
  ],
  timeoutMs: 30000
});
```

### Alignment Configuration

```typescript
const aligner = new ImageAligner({
  paddingColor: [255, 255, 255], // White background for padding
  tempDir: '/tmp/ui-diff-alignment'
});
```

## Performance Characteristics

| Operation | Time Complexity | Memory Usage | Typical Duration |
|-----------|----------------|--------------|------------------|
| Phase Correlation | O(n log n) | Low | 50-200ms |
| ECC Registration | O(n × iterations) | Medium | 200-800ms |
| Feature Matching | O(n × m) | Medium | 300-1000ms |
| Image Alignment | O(n) | Low | 100-300ms |
| Full Pipeline | Combined | Medium | 500-2000ms |

## Error Handling

The system gracefully handles various failure modes:

- **No detectable features**: Falls back to simple dimension matching
- **Excessive shift detected**: Reports as potentially different content  
- **OpenCV errors**: Graceful degradation to basic comparison
- **Memory constraints**: Processes large images at reduced resolution
- **Method failures**: Uses best available result from successful methods

## Requirements

### Python Dependencies
```bash
pip install opencv-python>=4.8.0 opencv-contrib-python>=4.8.0 numpy>=1.24.0
```

### Node.js Dependencies  
```bash
npm install pixelmatch pngjs sharp
```

## File Structure

```
opencv-alignment/
├── opencv-detector.ts     # Main detection algorithms
├── image-aligner.ts       # Alignment and cropping logic
├── types.ts              # TypeScript type definitions
├── opencv-alignment.test.ts # Comprehensive test suite
└── README.md             # This documentation
```

## Integration with MCP Server

The alignment system integrates with the MCP server through the `compute_diff_with_alignment` tool:

```json
{
  "name": "compute_diff_with_alignment",
  "description": "Enhanced UI diff comparison with OpenCV global shift detection",
  "parameters": {
    "target_path": "string",
    "current_path": "string", 
    "alignment_method": "auto|phase_correlation|ecc|feature_matching",
    "pixelmatch_threshold": "number",
    "min_region_area": "number",
    "disable_alignment": "boolean"
  }
}
```

This provides a complete solution for dimension-agnostic UI comparison that can handle real-world design-to-implementation comparison scenarios.