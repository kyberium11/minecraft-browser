import * as THREE from 'three'
import { textureLoader } from '../core/TextureLoader'
import { BlockType, CHUNK_SIZE, CHUNK_HEIGHT } from './VoxelConfig'

export { BlockType, CHUNK_SIZE, CHUNK_HEIGHT }

// Global uniforms for synchronized animations
export const globalUniforms = {
  uTime: { value: 0 }
}

const waterVertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vColor = color;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    
    vec3 newPos = position;
    if (normal.y > 0.5) {
      float wave = sin(uTime * 2.0 + worldPos.x * 0.8 + worldPos.z * 0.8) * 0.1;
      newPos.y += wave;
    }
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`

const waterFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vColor;

  void main() {
    float pulse = sin(uTime * 1.5 + vWorldPos.x * 0.4 + vWorldPos.z * 0.4) * 0.1 + 0.9;
    vec3 baseColor = vec3(0.1, 0.5, 0.95);
    float ripple = sin(uTime * 2.0 + vWorldPos.x * 3.0 + vWorldPos.z * 3.0) * 0.05;
    
    // Mix with vertex color (AO/Light)
    gl_FragColor = vec4((baseColor * pulse + ripple) * vColor, 0.7);
  }
`

export class Chunk extends THREE.Group {
  private data: Uint8Array
  private geometry: THREE.BufferGeometry
  private mesh: THREE.Mesh | null = null
  public xOffset: number
  public zOffset: number
  public isReady = false

  constructor(x: number, z: number) {
    super()
    this.xOffset = x
    this.zOffset = z
    this.position.set(x * CHUNK_SIZE, 0, z * CHUNK_SIZE)
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    this.geometry = new THREE.BufferGeometry()
  }

  public applyMeshData(messageData: any) {
    const { positions, normals, uvs, colors, indices, groups, data } = messageData
    this.data = data
    
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    
    this.geometry.clearGroups()
    groups.forEach((g: any) => this.geometry.addGroup(g.start, g.count, g.materialIndex))

    const materials = [
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/grass_side.png'), vertexColors: true }), // 0
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/grass_top.png'), vertexColors: true }),  // 1
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/dirt.png'), vertexColors: true }),       // 2
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/stone.png'), vertexColors: true }),      // 3
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/cobblestone.png'), vertexColors: true }), // 4
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/oak_log_side.png'), vertexColors: true }), // 5
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/oak_log_top.png'), vertexColors: true }), // 6
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/oak_leaves.png'), transparent: true, side: THREE.DoubleSide, vertexColors: true }), // 7
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/oak_planks.png'), vertexColors: true }), // 8
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/sand.png'), vertexColors: true }), // 9
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/glass.png'), transparent: true, vertexColors: true }), // 10
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/bedrock.png'), vertexColors: true }), // 11
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/ore_coal.png'), vertexColors: true }), // 12
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/ore_iron.png'), vertexColors: true }), // 13
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/ore_gold.png'), vertexColors: true }), // 14
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/ore_diamond.png'), vertexColors: true }), // 15
      new THREE.ShaderMaterial({ 
        uniforms: globalUniforms,
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        vertexColors: true
      }), // 16: WATER (Dynamic Waves)
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, vertexColors: true }), // 17: CLOUDS
      new THREE.MeshBasicMaterial({ color: 0xcc4444, map: textureLoader.load('/assets/textures/cobblestone.png'), vertexColors: true }), // 18: BRICK (Tinted Masonry)
      new THREE.MeshBasicMaterial({ color: 0x333333, map: textureLoader.load('/assets/textures/stone.png'), vertexColors: true }),       // 19: ROOF (Dark Shingle Look)
      new THREE.MeshBasicMaterial({ color: 0xff0000, vertexColors: true }), // 20: FLOWER_RED
      new THREE.MeshBasicMaterial({ color: 0xffff00, vertexColors: true }), // 21: FLOWER_YELLOW
      new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }), // 22: SNOW
      new THREE.MeshBasicMaterial({ map: textureLoader.load('/wheat.png'), transparent: true, side: THREE.DoubleSide, vertexColors: true }), 
      new THREE.MeshBasicMaterial({ color: 0xffa500, transparent: true, vertexColors: true })
    ]

    if (!this.mesh) {
      this.mesh = new THREE.Mesh(this.geometry, materials)
      this.add(this.mesh)
    }
    this.isReady = true
  }

  public getIndex(x: number, y: number, z: number): number {
    return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT
  }

  public getBlock(lx: number, ly: number, lz: number): BlockType {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return BlockType.AIR
    return this.data[this.getIndex(lx, ly, lz)] as BlockType
  }
  
  public setBlockInternal(x: number, y: number, z: number, type: BlockType) {
    this.data[this.getIndex(x, y, z)] = type
  }

  public getRawData(): Uint8Array { return this.data }

  public dispose() {
    this.geometry.dispose()
    if (this.mesh) {
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose())
      } else {
        this.mesh.material.dispose()
      }
    }
  }
}
