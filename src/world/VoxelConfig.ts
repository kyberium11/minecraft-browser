export const BlockType = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  OAK_LOG: 5,
  OAK_LEAVES: 6,
  OAK_PLANKS: 7,
  SAND: 8,
  GLASS: 9,
  BEDROCK: 10,
  ORE_COAL: 11,
  ORE_IRON: 12,
  ORE_GOLD: 13,
  ORE_DIAMOND: 14,
  WATER: 15,
  CLOUDS: 16,
  BRICK: 17,
  ROOF: 18,
  FLOWER_RED: 19,
  FLOWER_YELLOW: 20
} as const

export type BlockType = typeof BlockType[keyof typeof BlockType]

export const CHUNK_SIZE = 16
export const CHUNK_HEIGHT = 48
