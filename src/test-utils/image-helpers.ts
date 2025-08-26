import sharp from 'sharp';

export interface TestImages {
  target: Buffer;
  current: Buffer;
}

/**
 * Creates test images for testing - a target (reference) image and a current image with some differences
 */
export async function createTestImages(): Promise<TestImages> {
  const width = 800;
  const height = 600;

  // Create a simple target image - white background with some colored rectangles
  const target = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .composite([
    // Blue rectangle
    {
      input: Buffer.from(Array(100 * 100 * 3).fill(0).map((_, i) => 
        i % 3 === 0 ? 0 : i % 3 === 1 ? 0 : 255
      )),
      raw: { width: 100, height: 100, channels: 3 },
      top: 100,
      left: 150
    },
    // Red rectangle
    {
      input: Buffer.from(Array(80 * 120 * 3).fill(0).map((_, i) => 
        i % 3 === 0 ? 255 : 0
      )),
      raw: { width: 80, height: 120, channels: 3 },
      top: 300,
      left: 400
    }
  ])
  .png()
  .toBuffer();

  // Create current image with differences - same as target but with modified rectangles
  const current = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .composite([
    // Blue rectangle moved slightly and made green instead
    {
      input: Buffer.from(Array(100 * 100 * 3).fill(0).map((_, i) => 
        i % 3 === 0 ? 0 : i % 3 === 1 ? 255 : 0
      )),
      raw: { width: 100, height: 100, channels: 3 },
      top: 110, // Moved down by 10px
      left: 160  // Moved right by 10px
    },
    // Red rectangle made smaller
    {
      input: Buffer.from(Array(60 * 100 * 3).fill(0).map((_, i) => 
        i % 3 === 0 ? 255 : 0
      )),
      raw: { width: 60, height: 100, channels: 3 },
      top: 300,
      left: 400
    },
    // New yellow rectangle (additional difference)
    {
      input: Buffer.from(Array(50 * 50 * 3).fill(0).map((_, i) => 
        i % 3 === 0 ? 255 : i % 3 === 1 ? 255 : 0
      )),
      raw: { width: 50, height: 50, channels: 3 },
      top: 500,
      left: 600
    }
  ])
  .png()
  .toBuffer();

  return { target, current };
}