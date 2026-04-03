import { createNoise2D } from 'simplex-noise'
import { BlockType, CHUNK_SIZE, CHUNK_HEIGHT } from '../world/VoxelConfig'

const ctx: Worker = self as any
const noise2D = createNoise2D()

function getTerrainHeight(x: number, z: number) {
  const scale = 0.02
  const noise = (noise2D(x * scale, z * scale) + 1) / 2
  return Math.floor(noise * 15) + 5
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
  [BlockType.BRICK]: 18, [BlockType.ROOF]: 19, [BlockType.FLOWER_RED]: 20, [BlockType.FLOWER_YELLOW]: 21
}

function solveCollision(lx: number, ly: number, lz: number) {
  return lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && ly >= 0 && ly < CHUNK_HEIGHT
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
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const idx = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT
          if (y === 0) data[idx] = BlockType.BEDROCK
          else if (y < h - 1) data[idx] = h < waterLevel + 1 ? BlockType.SAND : BlockType.STONE
          else if (y === h - 1) data[idx] = h < waterLevel + 1 ? BlockType.SAND : BlockType.GRASS
          else if (y < waterLevel) data[idx] = BlockType.WATER
        }
        const s = Math.sin(wx * 12.9 + wz * 78.2) * 43758
        const seed = s - Math.floor(s)
        if (h >= waterLevel + 1) {
          if (seed > 0.99) {
             for (let ty = 0; ty < 5; ty++) if(solveCollision(x, h+ty, z)) data[x + (h+ty) * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT] = BlockType.OAK_LOG
             for (let lx=-2; lx<=2; lx++) for(let lz=-2; lz<=2; lz++) for(let ly=3; ly<=5; ly++)
               if (solveCollision(x+lx, h+ly, z+lz) && Math.abs(lx)+Math.abs(lz) < 3) data[(x+lx) + (h+ly) * CHUNK_SIZE + (z+lz) * CHUNK_SIZE * CHUNK_HEIGHT] = BlockType.OAK_LEAVES
          } else if (seed > 0.982) {
             for (let hx=0; hx<4; hx++) for(let hz=0; hz<4; hz++) for(let hy=0; hy<3; hy++)
               if (solveCollision(x+hx, h+hy, z+hz)) data[(x+hx) + (h+hy) * CHUNK_SIZE + (z+hz) * CHUNK_SIZE * CHUNK_HEIGHT] = BlockType.BRICK
          }
        }
      }
    }
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
        const type = data[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT]
        if (type === BlockType.AIR) continue
        const wx = xOffset * CHUNK_SIZE + x, wz = zOffset * CHUNK_SIZE + z
        for (const side of SIDES) {
          const nx = wx + side.dir[0], ny = y + side.dir[1], nz = wz + side.dir[2]
          const nType = getBlock(nx, ny, nz)
          let render = false
          if (type === BlockType.WATER) render = nType !== BlockType.WATER
          else if (type === BlockType.GLASS || type === BlockType.OAK_LEAVES) render = nType !== type
          else render = (nType === BlockType.AIR || nType === BlockType.WATER || nType === BlockType.GLASS || nType === BlockType.OAK_LEAVES)
          
          if (render) {
            let m = materialIndices[type] ?? 0
            if (type === BlockType.GRASS && side.name === 'top') m = 1
            if (type === BlockType.OAK_LOG && (side.name === 'top' || side.name === 'bottom')) m = 6
            if (!materialBatches[m]) materialBatches[m] = { pos: [], norm: [], uv: [], col: [], ind: [] }
            const b = materialBatches[m], si = b.pos.length / 3, h = (type === BlockType.WATER) ? 0.9 : 1.0
            for (let i = 0; i < 4; i++) {
              const c = side.corners[i]
              b.pos.push(x + c[0], y + (c[1] === 1 ? h : 0), z + c[2])
              b.norm.push(...side.dir)
              b.uv.push(...[[0, 0], [1, 0], [1, 1], [0, 1]][i])
              const nAO = side.aoNeighbors[i]
              const s1 = isSolid(getBlock(wx + nAO[0][0], y + nAO[0][1], wz + nAO[0][2]))
              const s2 = isSolid(getBlock(wx + nAO[1][0], y + nAO[1][1], wz + nAO[1][2]))
              const s3 = isSolid(getBlock(wx + nAO[2][0], y + nAO[2][1], wz + nAO[2][2]))
              // RADIANT AO: Lightened from previous [1.0, 0.8, 0.6, 0.45] to [1.0, 0.9, 0.75, 0.6]
              const ao = [1.0, 0.9, 0.75, 0.65][(s1 && s2) ? 3 : (Number(s1) + Number(s2) + Number(s3))]
              const lV = sunlight[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT] / 15.0
              // BRIGHTER SHADE: Increased base from 0.4 to 0.6
              const shade = ao * (0.6 + 0.4 * lV); b.col.push(shade, shade, shade)
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
