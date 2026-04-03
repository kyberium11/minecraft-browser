// Procedural Minecraft Skin Generator for "Ragged Knight"
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const targetPath = path.join(__dirname, '../public/assets/textures/knight_skin.png')

// We will use a basic BMP generator since it has no external dependencies
function writeBMP(width, height, pixelData, outputPath) {
  const rowSize = Math.floor((width * 24 + 31) / 32) * 4
  const pixelArraySize = rowSize * height
  const fileSize = 54 + pixelArraySize
  const buffer = Buffer.alloc(fileSize)

  // BMP Header
  buffer.write('BM', 0)
  buffer.writeUInt32LE(fileSize, 2)
  buffer.writeUInt32LE(0, 6)
  buffer.writeUInt32LE(54, 10)

  // DIB Header
  buffer.writeUInt32LE(40, 14)
  buffer.writeInt32LE(width, 18)
  buffer.writeInt32LE(-height, 22) // Top-down
  buffer.writeUInt16LE(1, 26)
  buffer.writeUInt16LE(24, 28) // 24-bit RGB
  buffer.writeUInt32LE(0, 30)
  buffer.writeUInt32LE(pixelArraySize, 34)
  buffer.writeInt32LE(2835, 38)
  buffer.writeInt32LE(2835, 42)
  buffer.writeUInt32LE(0, 46)
  buffer.writeUInt32LE(0, 50)

  // Pixel Data
  let offset = 54
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = pixelData[idx]
      const g = pixelData[idx + 1]
      const b = pixelData[idx + 2]
      buffer[offset++] = b
      buffer[offset++] = g
      buffer[offset++] = r
    }
    // Padding
    while (offset % 4 !== 0) {
      buffer[offset++] = 0
    }
  }

  // Ensure directories exist
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Since Three.js expects a PNG usually, we can load a BMP just fine if we name it carefully,
  // but to avoid loader issues we'll write it as knight_skin.bmp and update the loader.
  // Actually, three's texture loader loads BMPs perfectly via browser Image API.
  fs.writeFileSync(outputPath.replace('.png', '.bmp'), buffer)
  console.log(`Generated texture at ${outputPath.replace('.png', '.bmp')}`)
}

const pixels = new Uint8Array(64 * 64 * 4) // RGBA array

// Helper
function drawRect(x, y, w, h, [r, g, b]) {
  for (let iy = y; iy < y + h; iy++) {
    for (let ix = x; ix < x + w; ix++) {
      const i = (iy * 64 + ix) * 4
      // add noise
      const noise = Math.random() * 20 - 10
      pixels[i] = Math.max(0, Math.min(255, r + noise))
      pixels[i + 1] = Math.max(0, Math.min(255, g + noise))
      pixels[i + 2] = Math.max(0, Math.min(255, b + noise))
      pixels[i + 3] = 255
    }
  }
}

// Background
drawRect(0, 0, 64, 64, [0, 0, 0])

// Head (Silver armor) -> Box is 8x8 right on top, left side
drawRect(0, 0, 32, 16, [140, 140, 150]) // Silver armor helmet
// Visor (dark gap)
drawRect(8, 10, 8, 2, [30, 30, 30])
// Glowing blue eyes inside visor
pixels[(10 * 64 + 10) * 4] = 0; pixels[(10 * 64 + 10) * 4 + 1] = 200; pixels[(10 * 64 + 10) * 4 + 2] = 255;
pixels[(10 * 64 + 13) * 4] = 0; pixels[(10 * 64 + 13) * 4 + 1] = 200; pixels[(10 * 64 + 13) * 4 + 2] = 255;

// Torso (Chainmail + Cape)
drawRect(16, 16, 24, 16, [100, 100, 110]) // silver breastplate
drawRect(32, 16, 8, 12, [180, 30, 30]) // tattered red cape on back

// Arms (Silver pauldron + chainmail)
drawRect(40, 16, 16, 16, [120, 120, 130]) // left arm area
drawRect(32, 48, 16, 16, [120, 120, 130]) // right arm area

// Legs (dark rusted metal)
drawRect(0, 16, 16, 16, [80, 85, 90]) // right leg
drawRect(16, 48, 16, 16, [80, 85, 90]) // left leg

writeBMP(64, 64, pixels, targetPath)
