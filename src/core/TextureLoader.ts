import * as THREE from 'three'

export class TextureLoader {
  private loader: THREE.TextureLoader

  private cache: Map<string, THREE.Texture> = new Map()

  constructor() {
    this.loader = new THREE.TextureLoader()
  }

  /**
   * Loads a texture and sets it up for pixel art (NearestFilter).
   * @param path The path to the texture file.
   * @returns The loaded texture.
   */
  public load(path: string): THREE.Texture {
    if (this.cache.has(path)) {
      return this.cache.get(path)!
    }

    const texture = this.loader.load(path)
    
    // Set filters for sharp pixel art look
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    
    // Ensure textures are tileable (standard for Minecraft style)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    
    this.cache.set(path, texture)
    return texture
  }

  /**
   * Example: Load all common textures at once
   */
  public loadCommonTextures() {
    return {
      grassTop: this.load('/assets/textures/grass_top.png'),
      grassSide: this.load('/assets/textures/grass_side.png'),
      dirt: this.load('/assets/textures/dirt.png'),
      stone: this.load('/assets/textures/stone.png'),
      cobblestone: this.load('/assets/textures/cobblestone.png')
    }
  }
}

export const textureLoader = new TextureLoader()
