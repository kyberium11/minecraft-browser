import { createNoise2D, createNoise3D } from 'simplex-noise'
import { BlockType, CHUNK_SIZE, CHUNK_HEIGHT } from '../world/VoxelConfig'
import { applyStructures } from './StructureManager'

const ctx: Worker = self as any
const noise2D = createNoise2D()
const caveNoise3D = createNoise3D()
const oreNoise3D = createNoise3D()

function getTerrainHeight(x: number, z: number) {
  const scale = 0.02
  const noise = (noise2D(x * scale, z * scale) + 1) / 2
  return Math.floor(noise * 15) + 5
}

function getTerrainMoisture(x: number, z: number) {
  const scale = 0.015
  return (noise2D(x * scale + 12345, z * scale + 54321) + 1) / 2
}

function getBiome(e: number, m: number) {
  if (e <= 13) return 'Ocean'
  if (m < 0.4) {
    if (e >= 16) return 'Tundra'
    return 'Desert'
  }
  return 'Forest'
}

const SIDES = [
  { name: 'top',    dir: [ 0,  1,  0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], aoNeighbors: [[[-1,0,0],[0,0,1],[-1,0,1]], [[1,0,0],[0,0,1],[1,0,1]], [[1,0,0],[0,0,-1],[1,0,-1]], [[-1,0,0],[0,0,-1],[-1,0,-1]]] },
  { name: 'bottom', dir: [ 0, -1,  0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], aoNeighbors: [[[-1,0,0],[0,0,-1],[-1,0,-1]], [[1,0,0],[0,0,-1],[1,0,-1]], [[1,0,0],[0,0,1],[1,0,1]], [[-1,0,0],[0,0,1],[-1,0,1]]] },
  { name: 'left',   dir: [-1,  0,  0], corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], aoNeighbors: [[[0,-1,0],[0,0,-1],[0,-1,-1]], [[0,-1,0],[0,0,1],[0,-1,1]], [[0,1,0],[0,0,1],[0,1,1]], [[0,1,0],[0,0,-1],[0,1,-1]]] },
  { name: 'right',  dir: [ 1,  0,  0], corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], aoNeighbors: [[[0,-1,0],[0,0,1],[0,-1,1]], [[0,-1,0],[0,0,-1],[0,-1,-1]], [[0,1,0],[0,0,-1],[0,1,-1]], [[0,1,0],[0,0,1],[0,1,1]]] },
  { name: 'front',  dir: [ 0,  0,  1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], aoNeighbors: [[[-1,0,0],[0,-1,0],[-1,-1,0]], [[1,0,0],[0,-1,0],[1,-1,0]], [[1,0,0],[0,1,0],[1,1,0]], [[-1,0,0],[0,1,0],[-1,1,0]]] },
  { name: 'back',   dir: [ 0,  0, -1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], aoNeighbors: [[[1,0,0],[0,-1,0],[1,-1,0]], [[-1,0,0],[0,-1,0],[-1,-1,0]], [[-1,0,0],[0,1,0],[-1,1,0]], [[1,0,0],[0,1,0],[1,1,0]]] }
]

const materialIndices: Record<number, number> = {
  [BlockType.GRASS]: 0, [BlockType.DIRT]: 2, [BlockType.STONE]: 3, [BlockType.COBBLESTONE]: 4,
  [BlockType.OAK_LOG]: 5, [BlockType.OAK_LEAVES]: 7, [BlockType.OAK_PLANKS]: 8, [BlockType.SAND]: 9,
  [BlockType.GLASS]: 10, [BlockType.BEDROCK]: 11, [BlockType.ORE_COAL]: 12, [BlockType.ORE_IRON]: 13,
  [BlockType.ORE_GOLD]: 14, [BlockType.ORE_DIAMOND]: 15, [BlockType.WATER]: 16, [BlockType.CLOUDS]: 17,
  [BlockType.BRICK]: 18, [BlockType.ROOF]: 19, [BlockType.FLOWER_RED]: 20, [BlockType.FLOWER_YELLOW]: 21, [BlockType.SNOW]: 22,
  [BlockType.WHEAT]: 23, [BlockType.CARROT]: 24
}

ctx.onmessage = (e: MessageEvent) => {
  const { xOffset, zOffset, neighborData = {}, data: inputData } = e.data
  const key = `${xOffset},${zOffset}`
  let data = inputData || neighborData[key] || new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)

  const getBlock = (wx: number, wy: number, wz: number) => {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.BEDROCK
    const cx = Math.floor(wx / CHUNK_SIZE)
    const cz = Math.floor(wz / CHUNK_SIZE)
    const d = neighborData[`${cx},${cz}`]
    if (!d) return BlockType.AIR
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    return d[lx + wy * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_HEIGHT]
  }

  const isSolid = (type: BlockType) => type !== BlockType.AIR && type !== BlockType.WATER && type !== BlockType.GLASS && type !== BlockType.OAK_LEAVES

  const isEmpty = data.every((b: number) => b === 0)
  if (isEmpty) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = xOffset * CHUNK_SIZE + x, wz = zOffset * CHUNK_SIZE + z
        const h = getTerrainHeight(wx, wz), waterLevel = 13
        const m = getTerrainMoisture(wx, wz)
        const biome = getBiome(h, m)
        
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const idx = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT
          if (y === 0) data[idx] = BlockType.BEDROCK
          else if (y < h - 4) data[idx] = BlockType.STONE
          else if (y < h - 1) data[idx] = (biome === 'Desert' || biome === 'Ocean') ? BlockType.SAND : BlockType.DIRT
          else if (y === h - 1) {
            if (biome === 'Desert' || biome === 'Ocean') data[idx] = BlockType.SAND
            else if (biome === 'Tundra') data[idx] = BlockType.SNOW
            else data[idx] = BlockType.GRASS
          }
          else if (y < waterLevel) data[idx] = BlockType.WATER

          // 3D Features (Caves & Ores)
          if (y > 0 && y < h && data[idx] !== BlockType.WATER) {
            // Cave Worms
            const caveVal = (caveNoise3D(wx * 0.05, y * 0.05, wz * 0.05) + 1) / 2
            if (caveVal > 0.48 && caveVal < 0.52) {
              data[idx] = BlockType.AIR
            } 
            // Ore Veins (Only in Stone)
            else if (data[idx] === BlockType.STONE) {
              const oreVal = (oreNoise3D(wx * 0.15, y * 0.15, wz * 0.15) + 1) / 2
              if (oreVal > 0.82) { // Rarity threshold
                // Lower Y values yield better ores
                if (y < 12 && oreVal > 0.92) {
                  data[idx] = BlockType.ORE_DIAMOND
                } else if (y < 24 && oreVal > 0.88) {
                  data[idx] = BlockType.ORE_GOLD
                } else if (y < 35 && oreVal > 0.85) {
                  data[idx] = BlockType.ORE_IRON
                } else {
                  data[idx] = BlockType.ORE_COAL
                }
              }
            }
          }
        }
      }
    }
    
    // Apply Scattering (Trees/Stamps) after the initial geometry passes
    applyStructures(
      xOffset, 
      zOffset, 
      data, 
      (wx, wz) => getTerrainHeight(wx, wz),
      (wx, wz) => getBiome(getTerrainHeight(wx, wz), getTerrainMoisture(wx, wz))
    )
  }

  const sunlight = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      let l = 15
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const t = data[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT]
        if (isSolid(t)) l = 0
        else if (t === BlockType.WATER || t === BlockType.OAK_LEAVES) l = Math.max(0, l - 3)
        sunlight[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT] = l
      }
    }
  }

  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = []
  const groups: { start: number, count: number, materialIndex: number }[] = []
  const materialBatches: Record<number, { pos: number[], norm: number[], uv: number[], col: number[], ind: number[] }> = {}

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const rawType = data[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT]
        const type = rawType & 0x1F
        const waterDist = rawType >> 5
        
        if (type === BlockType.AIR) continue
        const wx = xOffset * CHUNK_SIZE + x, wz = zOffset * CHUNK_SIZE + z
        
        const hTop = getTerrainHeight(wx, wz)
        const mVal = getTerrainMoisture(wx, wz)
        const biome = getBiome(hTop, mVal)

        for (const side of SIDES) {
          const nx = wx + side.dir[0], ny = y + side.dir[1], nz = wz + side.dir[2]
          const nType = getBlock(nx, ny, nz) & 0x1F
          
          let render = false
          if (type === BlockType.WATER) render = nType !== BlockType.WATER
          else if (type === BlockType.GLASS || type === BlockType.OAK_LEAVES) render = nType !== type
          else if (type === BlockType.WHEAT || type === BlockType.CARROT) {
            // Vegetation uses a custom 'X' shape, not standard faces.
            // We'll skip the standard loop and handle it immediately if it's the 'top' side call
            if (side.name !== 'top') continue; 
            
            let m = materialIndices[type] ?? 0
            if (!materialBatches[m]) materialBatches[m] = { pos: [], norm: [], uv: [], col: [], ind: [] }
            const b = materialBatches[m]
            
            const lV = sunlight[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT] / 15.0
            const shade = 0.6 + 0.4 * lV
            
            // --- True Spheroid (Cylinder-like Sphere) Geometry ---
            const segments = 8;
            const radius = 0.5;
            for (let s = 0; s < segments; s++) {
              const si = b.pos.length / 3;
              const angle1 = (s / segments) * Math.PI * 2;
              const angle2 = ((s + 1) / segments) * Math.PI * 2;
              
              const x1 = 0.5 + Math.cos(angle1) * radius;
              const z1 = 0.5 + Math.sin(angle1) * radius;
              const x2 = 0.5 + Math.cos(angle2) * radius;
              const z2 = 0.5 + Math.sin(angle2) * radius;

              // Vertical Quads
              b.pos.push(x + x1, y, z + z1);
              b.pos.push(x + x2, y, z + z2);
              b.pos.push(x + x2, y + 1, z + z2);
              b.pos.push(x + x1, y + 1, z + z1);

              b.norm.push(Math.cos(angle1), 0, Math.sin(angle1));
              b.norm.push(Math.cos(angle2), 0, Math.sin(angle2));
              b.norm.push(Math.cos(angle2), 0, Math.sin(angle2));
              b.norm.push(Math.cos(angle1), 0, Math.sin(angle1));

              const u1 = s / segments;
              const u2 = (s + 1) / segments;
              b.uv.push(u1, 0, u2, 0, u2, 1, u1, 1);
              
              for(let i=0; i<4; i++) b.col.push(shade, shade, shade);
              b.ind.push(si, si + 1, si + 2, si, si + 2, si + 3);
              b.ind.push(si + 2, si + 1, si, si + 3, si + 2, si);
            }
            continue 
          }
          else render = (nType === BlockType.AIR || nType === BlockType.WATER || nType === BlockType.GLASS || nType === BlockType.OAK_LEAVES || nType === BlockType.WHEAT || nType === BlockType.CARROT)
          
          if (render) {
            let m = materialIndices[type] ?? 0
            if (type === BlockType.GRASS && side.name === 'top') m = 1
            if (type === BlockType.OAK_LOG && (side.name === 'top' || side.name === 'bottom')) m = 6
            if (!materialBatches[m]) materialBatches[m] = { pos: [], norm: [], uv: [], col: [], ind: [] }
            
            const b = materialBatches[m], si = b.pos.length / 3
            
            // Calculate stepped slope logic for water blocks
            let cornerY = 1.0
            if (type === BlockType.WATER) {
               cornerY = waterDist === 0 ? 0.9 : Math.max(0.1, 0.9 - (waterDist * 0.12))
               // Ensure bottom corners remain fully stretched to ground
            }

            for (let i = 0; i < 4; i++) {
              const c = side.corners[i]
              const displayY = (c[1] === 1) ? cornerY : 0
              b.pos.push(x + c[0], y + displayY, z + c[2])
              b.norm.push(...side.dir)
              b.uv.push(...[[0, 0], [1, 0], [1, 1], [0, 1]][i])
              const nAO = side.aoNeighbors[i]
              const s1 = isSolid(getBlock(wx + nAO[0][0], y + nAO[0][1], wz + nAO[0][2]))
              const s2 = isSolid(getBlock(wx + nAO[1][0], y + nAO[1][1], wz + nAO[1][2]))
              const s3 = isSolid(getBlock(wx + nAO[2][0], y + nAO[2][1], wz + nAO[2][2]))
              const ao = [1.0, 0.9, 0.75, 0.65][(s1 && s2) ? 3 : (Number(s1) + Number(s2) + Number(s3))]
              const lV = sunlight[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT] / 15.0
              const shade = ao * (0.6 + 0.4 * lV)
              
              let r = shade, g = shade, bl = shade
              if (type === BlockType.GRASS) {
                if (biome === 'Forest') { r *= 0.5; g *= 0.9; bl *= 0.3; }
                else if (biome === 'Tundra') { r *= 0.7; g *= 0.8; bl *= 0.8; }
              } else if (type === BlockType.OAK_LEAVES) {
                if (biome === 'Forest') { r *= 0.4; g *= 0.8; bl *= 0.2; }
                else if (biome === 'Tundra') { r *= 0.6; g *= 0.7; bl *= 0.7; }
              } else if (type === BlockType.SNOW) {
                r *= 0.95; g *= 0.98; bl *= 1.0;
              }
              
              b.col.push(r, g, bl)
            }
            b.ind.push(si, si + 1, si + 2, si, si + 2, si + 3)
          }
        }
      }
    }
  }

  let offset = 0
  for (const [m, b] of Object.entries(materialBatches)) {
    groups.push({ start: offset, count: b.ind.length, materialIndex: parseInt(m) })
    const ci = positions.length / 3
    positions.push(...b.pos); normals.push(...b.norm); uvs.push(...b.uv); colors.push(...b.col)
    for (const id of b.ind) indices.push(id + ci)
    offset += b.ind.length
  }

  ctx.postMessage({
    xOffset, zOffset,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    groups, data
  })
}
