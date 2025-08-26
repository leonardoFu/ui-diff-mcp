/**
 * Test utilities for OpenCV testing - creating test images and transformations
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export type TestPattern = 'checkerboard' | 'gradient' | 'circles' | 'features' | 'noise' | 'blank' | 'mixed' | 'ui_mockup';

/**
 * Create a test image with specified pattern using Python/OpenCV
 */
export async function createTestImage(
  outputPath: string, 
  width: number, 
  height: number, 
  pattern: TestPattern
): Promise<void> {
  const pythonScript = `
import cv2
import numpy as np
import sys

def create_checkerboard(w, h):
    tile_size = 32
    tiles_x = w // tile_size + 1
    tiles_y = h // tile_size + 1
    
    img = np.zeros((tiles_y * tile_size, tiles_x * tile_size), dtype=np.uint8)
    for y in range(tiles_y):
        for x in range(tiles_x):
            if (x + y) % 2 == 0:
                img[y*tile_size:(y+1)*tile_size, x*tile_size:(x+1)*tile_size] = 255
    
    return img[:h, :w]

def create_gradient(w, h):
    img = np.zeros((h, w), dtype=np.uint8)
    for y in range(h):
        img[y, :] = int((y / h) * 255)
    return img

def create_circles(w, h):
    img = np.zeros((h, w), dtype=np.uint8)
    for i in range(5):
        center_x = (i + 1) * w // 6
        center_y = h // 2
        radius = min(w, h) // 12
        cv2.circle(img, (center_x, center_y), radius, 255, -1)
    return img

def create_features(w, h):
    img = np.zeros((h, w), dtype=np.uint8)
    # Create various shapes for feature detection
    cv2.rectangle(img, (50, 50), (150, 150), 255, -1)
    cv2.circle(img, (300, 200), 50, 128, -1)
    cv2.ellipse(img, (500, 300), (60, 40), 45, 0, 360, 200, -1)
    # Add some noise for texture
    noise = np.random.randint(0, 50, (h, w), dtype=np.uint8)
    img = cv2.add(img, noise)
    return img

def create_noise(w, h):
    return np.random.randint(0, 256, (h, w), dtype=np.uint8)

def create_blank(w, h):
    return np.full((h, w), 128, dtype=np.uint8)

def create_mixed(w, h):
    img = create_checkerboard(w, h)
    # Add some features
    cv2.circle(img, (w//4, h//4), min(w, h)//8, 128, -1)
    cv2.rectangle(img, (3*w//4-50, 3*h//4-50), (3*w//4+50, 3*h//4+50), 64, -1)
    return img

def create_ui_mockup(w, h):
    img = np.full((h, w, 3), 255, dtype=np.uint8)  # White background
    
    # Header
    cv2.rectangle(img, (0, 0), (w, 80), (52, 152, 219), -1)
    cv2.putText(img, "UI Mockup", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 2)
    
    # Navigation
    cv2.rectangle(img, (0, 80), (200, h), (236, 240, 241), -1)
    for i in range(5):
        y = 120 + i * 60
        cv2.rectangle(img, (20, y), (180, y+40), (149, 165, 166), -1)
    
    # Content area
    cv2.rectangle(img, (220, 100), (w-20, h-20), (245, 245, 245), -1)
    
    # Some content blocks
    for i in range(3):
        y = 140 + i * 100
        cv2.rectangle(img, (240, y), (w-40, y+60), (127, 140, 141), -1)
    
    return img

width = ${width}
height = ${height}
pattern = "${pattern}"
output_path = "${outputPath}"

patterns = {
    'checkerboard': create_checkerboard,
    'gradient': create_gradient,
    'circles': create_circles,
    'features': create_features,
    'noise': create_noise,
    'blank': create_blank,
    'mixed': create_mixed,
    'ui_mockup': create_ui_mockup
}

if pattern not in patterns:
    print(f"Unknown pattern: {pattern}", file=sys.stderr)
    sys.exit(1)

img = patterns[pattern](width, height)

# Convert to BGR if grayscale for consistency
if len(img.shape) == 2:
    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

cv2.imwrite(output_path, img)
print(f"Created {pattern} image at {output_path}")
`;

  return new Promise((resolve, reject) => {
    const process = spawn('python3', ['-c', pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python script failed: ${stderr}`));
      }
    });
  });
}

/**
 * Translate an image by dx, dy pixels using Python/OpenCV
 */
export async function translateImage(
  inputPath: string,
  outputPath: string,
  dx: number,
  dy: number
): Promise<void> {
  const pythonScript = `
import cv2
import numpy as np

input_path = "${inputPath}"
output_path = "${outputPath}"
dx = ${dx}
dy = ${dy}

img = cv2.imread(input_path)
if img is None:
    raise ValueError(f"Could not load image from {input_path}")

h, w = img.shape[:2]

# Create translation matrix
M = np.float32([[1, 0, dx], [0, 1, dy]])

# Apply translation with white border fill
translated = cv2.warpAffine(img, M, (w, h), borderValue=(255, 255, 255))

cv2.imwrite(output_path, translated)
print(f"Translated image by ({dx}, {dy}) saved to {output_path}")
`;

  return new Promise((resolve, reject) => {
    const process = spawn('python3', ['-c', pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stderr = '';
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Translation script failed: ${stderr}`));
      }
    });
  });
}

/**
 * Scale and translate an image using Python/OpenCV
 */
export async function scaleAndTranslateImage(
  inputPath: string,
  outputPath: string,
  scale: number,
  dx: number,
  dy: number,
  rotation_deg: number = 0
): Promise<void> {
  const pythonScript = `
import cv2
import numpy as np

input_path = "${inputPath}"
output_path = "${outputPath}"
scale = ${scale}
dx = ${dx}
dy = ${dy}
rotation_deg = ${rotation_deg}

img = cv2.imread(input_path)
if img is None:
    raise ValueError(f"Could not load image from {input_path}")

h, w = img.shape[:2]
center_x, center_y = w // 2, h // 2

# Create combined transformation matrix
rotation_matrix = cv2.getRotationMatrix2D((center_x, center_y), rotation_deg, scale)
rotation_matrix[0, 2] += dx
rotation_matrix[1, 2] += dy

# Apply transformation
transformed = cv2.warpAffine(img, rotation_matrix, (w, h), borderValue=(255, 255, 255))

cv2.imwrite(output_path, transformed)
print(f"Transformed image (scale={scale}, dx={dx}, dy={dy}, rot={rotation_deg}) saved to {output_path}")
`;

  return new Promise((resolve, reject) => {
    const process = spawn('python3', ['-c', pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stderr = '';
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Transform script failed: ${stderr}`));
      }
    });
  });
}

/**
 * Check if Python with OpenCV is available
 */
export async function checkPythonOpenCV(): Promise<boolean> {
  const testScript = `
try:
    import cv2
    import numpy as np
    print("OpenCV version:", cv2.__version__)
    print("NumPy version:", np.__version__)
    print("OK")
except ImportError as e:
    print("ERROR:", e)
    exit(1)
`;

  return new Promise((resolve) => {
    const process = spawn('python3', ['-c', testScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    process.on('close', (code) => {
      resolve(code === 0);
    });
  });
}