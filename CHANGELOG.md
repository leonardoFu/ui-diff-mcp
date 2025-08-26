# Changelog

## v1.0.0 - 2025-08-25

### 🚀 Initial Release

**Core Features:**
- Complete MCP server implementation for UI design vs implementation comparison
- Three core tools: `compute_diff_regions`, `score_global`, `render_overlay`
- Advanced image metrics: SSIM, PSNR, and VMAF support
- FFmpeg integration for high-performance image processing
- Sharp-based region detection and overlay rendering

**Tools Implemented:**
- **compute_diff_regions**: Identifies difference regions using SSIM heatmaps
- **score_global**: Computes global similarity metrics (VMAF, SSIM, PSNR)  
- **render_overlay**: Creates visual overlays highlighting difference regions

**Technical Highlights:**
- Built using Test-Driven Development (TDD) methodology
- TypeScript with Zod schema validation
- Comprehensive test suite with 15 passing tests
- FFmpeg-based metrics computation with fallback handling
- Region extraction from heatmaps using contour-like detection
- MCP SDK integration for protocol compliance

**Architecture:**
- Modular design with separate tools, utilities, and types
- Robust error handling for missing dependencies
- Configurable thresholds and filtering options
- Both MCP server and CLI interfaces

**Based on Research:**
- Implements patterns from DeltaVision investigation document
- Follows deltavision JSON response schema specification
- Uses recommended FFmpeg filter chains for PSNR/VMAF
- Supports configurable region detection parameters

**Dependencies:**
- @modelcontextprotocol/sdk for MCP protocol
- sharp for image processing  
- zod for schema validation
- FFmpeg (external) for advanced metrics

**Development:**
- Full TypeScript support with strict compilation
- Vitest test framework with comprehensive coverage  
- Development and production build configurations
- CLI interface for standalone usage