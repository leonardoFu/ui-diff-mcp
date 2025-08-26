import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { computeDiffRegions } from './tools/compute-diff-regions.js';
import { scoreGlobal } from './tools/score-global.js';
import { renderOverlay } from './tools/render-overlay.js';
import { 
  ComputeDiffRegionsInputSchema,
  ScoreGlobalInputSchema,
  RenderOverlayInputSchema 
} from './types.js';

/**
 * Create and configure the MCP server with UI diff tools
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'ui-diff-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'compute_diff_regions',
          description: 'Compute difference regions between target and current UI images using SSIM/PSNR metrics. Returns structured JSON with regions, canvas info, and metrics as specified in deltavision doc.',
          inputSchema: {
            type: 'object',
            properties: {
              target_path: { 
                type: 'string', 
                description: 'Path to the target/reference image (design)' 
              },
              current_path: { 
                type: 'string', 
                description: 'Path to the current implementation image' 
              },
              threshold: { 
                type: 'number', 
                minimum: 0, 
                maximum: 1, 
                default: 0.0,
                description: 'Minimum difference threshold for region detection' 
              },
              min_area_px: { 
                type: 'integer', 
                minimum: 0, 
                default: 64,
                description: 'Minimum area in pixels for a region to be included' 
              }
            },
            required: ['target_path', 'current_path']
          }
        },
        {
          name: 'score_global',
          description: 'Compute global similarity scores (VMAF, SSIM, PSNR) between target and current images',
          inputSchema: {
            type: 'object',
            properties: {
              target_path: { 
                type: 'string', 
                description: 'Path to the target/reference image' 
              },
              current_path: { 
                type: 'string', 
                description: 'Path to the current implementation image' 
              }
            },
            required: ['target_path', 'current_path']
          }
        },
        {
          name: 'render_overlay',
          description: 'Render overlay visualization with highlighted difference regions on the current image',
          inputSchema: {
            type: 'object',
            properties: {
              current_path: { 
                type: 'string', 
                description: 'Path to the current implementation image' 
              },
              regions: {
                type: 'array',
                description: 'Array of regions to highlight',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    bbox: {
                      type: 'array',
                      items: { type: 'number' },
                      minItems: 4,
                      maxItems: 4,
                      description: '[x, y, width, height] bounding box'
                    },
                    score: { type: 'number', minimum: 0, maximum: 1 },
                    max: { type: 'number', minimum: 0, maximum: 1 },
                    area_px: { type: 'integer', minimum: 0 }
                  },
                  required: ['id', 'bbox', 'score', 'area_px']
                }
              }
            },
            required: ['current_path', 'regions']
          }
        }
      ]
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'compute_diff_regions': {
          const input = ComputeDiffRegionsInputSchema.parse(args);
          const result = await computeDiffRegions(input);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        }

        case 'score_global': {
          const input = ScoreGlobalInputSchema.parse(args);
          const result = await scoreGlobal(input);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        }

        case 'render_overlay': {
          const input = RenderOverlayInputSchema.parse(args);
          const overlayPath = await renderOverlay(input);
          return {
            content: [
              {
                type: 'text',
                text: `Overlay image created at: ${overlayPath}`
              }
            ]
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

/**
 * Start the server with stdio transport
 */
export async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('UI Diff MCP server running on stdio');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}