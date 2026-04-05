import * as THREE from 'three'
import { Chunk, BlockType } from './Chunk'
import { CHUNK_SIZE, CHUNK_HEIGHT } from './VoxelConfig'
import ChunkWorker from './ChunkWorker?worker'
import { DroppedItem } from './DroppedItem'
import { useInventoryStore } from '../core/InventoryStore'

type FluidUpdate = { x: number; y: number; z: number; type: number; dist: number }

export class World extends THREE.Group {
  private chunks: Map<string, Chunk> = new Map()
  private droppedItems: Set<DroppedItem> = new Set()
  private worker = new ChunkWorker()
  private renderDistance = 3
  
  // Fluid Simulation
  private fluidQueue: FluidUpdate[] = []
  private lastFluidTick = 0
  private fluidTickRate = 100 // ms

  constructor() {
    super()
    this.worker.onmessage = (e: MessageEvent) => {
      const { xOffset, zOffset } = e.data
      const key = `${xOffset},${zOffset}`
      const chunk = this.chunks.get(key)
      if (chunk) {
        chunk.applyMeshData(e.data)
      }
    }
  }

  private getNeighborData(xOffset: number, zOffset: number) {
    const neighborData: Record<string, Uint8Array> = {}
    for (let x = xOffset - 1; x <= xOffset + 1; x++) {
      for (let z = zOffset - 1; z <= zOffset + 1; z++) {
        const key = `${x},${z}`
        const chunk = this.chunks.get(key)
        if (chunk) {
          neighborData[key] = new Uint8Array(chunk.getRawData())
        }
      }
    }
    return neighborData
  }

  public update(playerPosition: THREE.Vector3, delta: number) {
    const time = performance.now()
    
    // 1. Update Chunks
    const pCX = Math.floor(playerPosition.x / CHUNK_SIZE)
    const pCZ = Math.floor(playerPosition.z / CHUNK_SIZE)

    const activeChunks = new Set<string>()
    for (let x = pCX - this.renderDistance; x <= pCX + this.renderDistance; x++) {
      for (let z = pCZ - this.renderDistance; z <= pCZ + this.renderDistance; z++) {
        const key = `${x},${z}`
        activeChunks.add(key)

        if (!this.chunks.has(key)) {
          const chunk = new Chunk(x, z)
          this.chunks.set(key, chunk)
          this.add(chunk)
          this.worker.postMessage({ 
            xOffset: x, 
            zOffset: z,
            neighborData: this.getNeighborData(x, z)
          })
        }
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!activeChunks.has(key)) {
        this.remove(chunk)
        chunk.dispose()
        this.chunks.delete(key)
      }
    }

    // 2. Fluid Simulation (Ticks)
    if (time - this.lastFluidTick > this.fluidTickRate) {
      this.processFluids()
      this.lastFluidTick = time
    }

    // 3. Update Dropped Items
    for (const item of this.droppedItems) {
      item.update(playerPosition, delta, () => {
        useInventoryStore.getState().addItem(item.blockType)
        this.remove(item)
        this.droppedItems.delete(item)
      })
    }
  }

  private processFluids() {
    if (this.fluidQueue.length === 0) return
    
    const updatesPerTick = 20
    const currentBatch = this.fluidQueue.splice(0, updatesPerTick)
    const affectedChunks = new Set<string>()

    for (const update of currentBatch) {
      const { x, y, z, dist } = update
      if (dist >= 8) continue // Flow limit (7 blocks from source)
      if (y <= 1) continue // Bedrock floor

      const neighbors = [
        { dx: 0, dy: -1, dz: 0, d: 0 }, // Down consumes no dist
        { dx: 1, dy: 0, dz: 0, d: 1 },
        { dx: -1, dy: 0, dz: 0, d: 1 },
        { dx: 0, dy: 0, dz: 1, d: 1 },
        { dx: 0, dy: 0, dz: -1, d: 1 }
      ]

      for (const n of neighbors) {
        const nx = x + n.dx, ny = y + n.dy, nz = z + n.dz
        if (ny < 0 || ny >= CHUNK_HEIGHT) continue
        
        if (this.getBlockAt(nx, ny, nz) === BlockType.AIR) {
          const chunk = this.getChunkAt(nx, nz)
          if (chunk) {
            const lx = ((Math.floor(nx) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const lz = ((Math.floor(nz) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            
            // Flow logic: Only spread horizontally if the block below is solid.
            // If the block below is AIR, we drop straight down.
            if (n.dy === 0) {
                // Horizontal spread 
                const blockBelow = this.getBlockAt(nx, ny - 1, nz)
                if (blockBelow === BlockType.AIR) {
                   // If block below is air, we shouldn't spread horizontally here unless we also fall
                   // Actually, if block below is air, standard physics says water goes straight down instead of spreading wide.
                   // To keep it simple: we skip horizontal spread if there's air below, because the down-flow handles it.
                   continue
                }
            }

            const nextDist = dist + n.d
            chunk.setBlockInternal(lx, ny, lz, (BlockType.WATER | (nextDist << 5)) as BlockType)
            affectedChunks.add(`${chunk.xOffset},${chunk.zOffset}`)
            
            // Queue next flow step
            this.fluidQueue.push({ x: nx, y: ny, z: nz, type: BlockType.WATER, dist: nextDist })
          }
        }
      }
    }

    // Update meshes for all chunks that changed
    for (const key of affectedChunks) {
      const chunk = this.chunks.get(key)
      if (chunk) {
        this.worker.postMessage({
          xOffset: chunk.xOffset,
          zOffset: chunk.zOffset,
          data: new Uint8Array(chunk.getRawData())
        })
      }
    }
  }

  public getChunkAt(worldX: number, worldZ: number): Chunk | undefined {
    const cx = Math.floor(worldX / CHUNK_SIZE)
    const cz = Math.floor(worldZ / CHUNK_SIZE)
    return this.chunks.get(`${cx},${cz}`)
  }

  public getBlockAt(x: number, y: number, z: number): BlockType {
    const chunk = this.getChunkAt(x, z)
    if (!chunk) return BlockType.AIR
    const lx = ((Math.floor(x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((Math.floor(z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    return (chunk.getBlock(lx, Math.floor(y), lz) & 0x1F) as BlockType
  }

  public setBlockAt(x: number, y: number, z: number, type: BlockType) {
    const chunk = this.getChunkAt(x, z)
    if (chunk) {
      const lx = ((Math.floor(x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
      const lz = ((Math.floor(z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
      const ly = Math.floor(y)

      const oldRaw = chunk.getBlock(lx, ly, lz)
      const oldType = oldRaw & 0x1F
      chunk.setBlockInternal(lx, ly, lz, type)
      
      // Fluid Trigger
      if (type === BlockType.AIR) {
        const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,0,1],[0,0,-1]]
        for (const n of neighbors) {
          if (this.getBlockAt(x+n[0], ly+n[1], z+n[2]) === BlockType.WATER) {
            this.fluidQueue.push({ x: x+n[0], y: ly+n[1], z: z+n[2], type: BlockType.WATER, dist: 0 })
          }
        }
      }

      if (type === BlockType.AIR && oldType !== BlockType.AIR) {
        const item = new DroppedItem(oldType, Math.floor(x), ly, Math.floor(z))
        this.droppedItems.add(item)
        this.add(item)
      }

      this.worker.postMessage({
        xOffset: chunk.xOffset,
        zOffset: chunk.zOffset,
        neighborData: this.getNeighborData(chunk.xOffset, chunk.zOffset)
      })

      // Update neighbors if on the edge
      if (lx === 0) this.updateChunkMesh(chunk.xOffset - 1, chunk.zOffset)
      if (lx === CHUNK_SIZE - 1) this.updateChunkMesh(chunk.xOffset + 1, chunk.zOffset)
      if (lz === 0) this.updateChunkMesh(chunk.xOffset, chunk.zOffset - 1)
      if (lz === CHUNK_SIZE - 1) this.updateChunkMesh(chunk.xOffset, chunk.zOffset + 1)
    }
  }

  private updateChunkMesh(x: number, z: number) {
    const chunk = this.chunks.get(`${x},${z}`)
    if (chunk) {
      this.worker.postMessage({
        xOffset: x,
        zOffset: z,
        neighborData: this.getNeighborData(x, z)
      })
    }
  }
}
