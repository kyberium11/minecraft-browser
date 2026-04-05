import { BlockType, CHUNK_SIZE, CHUNK_HEIGHT } from './VoxelConfig'

export interface StructureStamp {
  size: [number, number, number] // width(x), height(y), depth(z)
  data: number[][][] // 3D array of BlockType (or 0 for AIR/skip)
  origin: [number, number, number] // The anchor point in local space (e.g. tree trunk base)
}

// Helper to quickly build a Tree Stamp
function buildTreeStamp(): StructureStamp {
  const size: [number, number, number] = [5, 7, 5]
  const data: number[][][] = Array(5).fill(0).map(() => Array(7).fill(0).map(() => Array(5).fill(0)))
  
  // Trunk
  for (let y = 0; y < 5; y++) {
    data[2][y][2] = BlockType.OAK_LOG
  }
  
  // Leaves
  for (let x = 0; x < 5; x++) {
    for (let z = 0; z < 5; z++) {
      for (let y = 3; y < 7; y++) {
        // Simple spherical/diamond shape check
        const dx = Math.abs(x - 2)
        const dy = Math.abs(y - 4)
        const dz = Math.abs(z - 2)
        if (dx + dy + dz < 4 && data[x][y][z] === 0) {
          data[x][y][z] = BlockType.OAK_LEAVES
        }
      }
    }
  }
  
  return {
    size,
    data,
    origin: [2, 0, 2] // The trunk base is at x=2, y=0, z=2
  }
}

// Pre-defined stamps
export const Stamps: Record<string, StructureStamp> = {
  Tree: buildTreeStamp()
}

// Pseudo-random generator for procedural deterministic scattering
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/**
 * Applies procedural structures to a chunk's data array by evaluating
 * the current chunk AND its 8 neighbors to see if any of their structures
 * overflow into the current chunk.
 */
export function applyStructures(
  chunkX: number, 
  chunkZ: number, 
  data: Uint8Array, 
  getSurfaceHeight: (wx: number, wz: number) => number,
  getSurfaceBiome: (wx: number, wz: number) => string
) {
  
  // Loop through current chunk and its 8 neighbors (3x3 area)
  for (let cx = chunkX - 1; cx <= chunkX + 1; cx++) {
    for (let cz = chunkZ - 1; cz <= chunkZ + 1; cz++) {
      
      // Predictable seed based on chunk coordinate combination
      // We use a high prime multiplier to avoid grid patterns
      const chunkSeed = (cx * 73856093) ^ (cz * 19349663)
      
      // Determine how many structures to spawn in this chunk (e.g., 3 to 5)
      const numStructures = 3 + Math.floor(seededRandom(chunkSeed) * 3)
      
      for (let i = 0; i < numStructures; i++) {
        const r1 = seededRandom(chunkSeed + i * 10)
        const r2 = seededRandom(chunkSeed + i * 10 + 1)
        
        // Local coordinates within the neighbor chunk
        const localX = Math.floor(r1 * CHUNK_SIZE)
        const localZ = Math.floor(r2 * CHUNK_SIZE)
        
        // Convert to absolute world coordinates
        const wx = cx * CHUNK_SIZE + localX
        const wz = cz * CHUNK_SIZE + localZ
        
        const biome = getSurfaceBiome(wx, wz)
        const surfaceHeight = getSurfaceHeight(wx, wz)
        
        // Only spawn trees in Forests or Tundras above water
        if ((biome === 'Forest' || biome === 'Tundra') && surfaceHeight > 13) {
          pasteStamp(Stamps.Tree, wx, surfaceHeight, wz, chunkX, chunkZ, data)
        }
      }
    }
  }
}

/**
 * Pastes a StructureStamp into the current chunk's data array.
 * Automatically handles bounds checking and culling data that falls outside the current chunk.
 */
function pasteStamp(
  stamp: StructureStamp, 
  worldX: number, 
  worldY: number, 
  worldZ: number, 
  targetChunkX: number, 
  targetChunkZ: number, 
  targetData: Uint8Array
) {
  const [sx, sy, sz] = stamp.size
  const [ox, oy, oz] = stamp.origin
  
  for (let dx = 0; dx < sx; dx++) {
    for (let dy = 0; dy < sy; dy++) {
      for (let dz = 0; dz < sz; dz++) {
        
        const block = stamp.data[dx][dy][dz]
        if (block === 0) continue // Air/empty stamp space
        
        const targetWx = worldX - ox + dx
        const targetWy = worldY - oy + dy
        const targetWz = worldZ - oz + dz
        
        // Check if this specific block falls within the TARGET chunk's boundaries
        const localCx = Math.floor(targetWx / CHUNK_SIZE)
        const localCz = Math.floor(targetWz / CHUNK_SIZE)
        
        if (localCx === targetChunkX && localCz === targetChunkZ) {
          if (targetWy >= 0 && targetWy < CHUNK_HEIGHT) {
            
            // Map absolute world coordinates to target chunk local coordinates
            const targetLx = ((targetWx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const targetLz = ((targetWz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            
            const idx = targetLx + targetWy * CHUNK_SIZE + targetLz * CHUNK_SIZE * CHUNK_HEIGHT
            targetData[idx] = block
          }
        }
      }
    }
  }
}
