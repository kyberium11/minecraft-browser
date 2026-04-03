import React, { useEffect } from 'react'
import { useInventoryStore } from '../core/InventoryStore'
import { BlockType } from '../world/VoxelConfig'

const getTexturePath = (type: BlockType | null) => {
  if (type === null) return ''
  switch (type) {
    case BlockType.GRASS: return '/assets/textures/grass_side.png'
    case BlockType.DIRT: return '/assets/textures/dirt.png'
    case BlockType.STONE: return '/assets/textures/stone.png'
    case BlockType.COBBLESTONE: return '/assets/textures/cobblestone.png'
    case BlockType.OAK_LOG: return '/assets/textures/oak_log_side.png'
    case BlockType.OAK_LEAVES: return '/assets/textures/oak_leaves.png'
    case BlockType.OAK_PLANKS: return '/assets/textures/oak_planks.png'
    case BlockType.SAND: return '/assets/textures/sand.png'
    case BlockType.GLASS: return '/assets/textures/glass.png'
    case BlockType.BEDROCK: return '/assets/textures/bedrock.png'
    case BlockType.ORE_COAL: return '/assets/textures/ore_coal.png'
    case BlockType.ORE_IRON: return '/assets/textures/ore_iron.png'
    case BlockType.ORE_GOLD: return '/assets/textures/ore_gold.png'
    case BlockType.ORE_DIAMOND: return '/assets/textures/ore_diamond.png'
    default: return '' // Will use placeholder color below
  }
}

const getPlaceholderColor = (type: BlockType | null) => {
  switch (type) {
    case BlockType.WATER: return 'linear-gradient(135deg, #0077ff, #00bbff)'
    case BlockType.CLOUDS: return 'linear-gradient(135deg, #ffffff, #eeeeee)'
    case BlockType.BRICK: return 'linear-gradient(135deg, #cc4444, #aa3333)'
    case BlockType.ROOF: return 'linear-gradient(135deg, #333333, #111111)'
    case BlockType.FLOWER_RED: return 'linear-gradient(135deg, #ff0000, #ff4444)'
    case BlockType.FLOWER_YELLOW: return 'linear-gradient(135deg, #ffff00, #ffd700)'
    default: return 'transparent'
  }
}

export const Hotbar: React.FC = () => {
  const { slots, selectedSlotIndex, selectSlot } = useInventoryStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') {
        selectSlot(parseInt(e.key) - 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectSlot])

  return (
    <div className="hotbar-wrapper">
      {slots.map((slot, index) => {
        const tex = getTexturePath(slot.type)
        const isSelected = index === selectedSlotIndex
        
        return (
          <div
            key={index}
            className={`hotbar-slot ${isSelected ? 'hotbar-slot-selected' : ''}`}
            onClick={() => selectSlot(index)}
          >
            <span className="slot-index">{index + 1}</span>
            
            {slot.type !== null && (
              <>
                {tex ? (
                  <img
                    src={tex}
                    alt={slot.type.toString()}
                    className="hotbar-image"
                    width={36}
                    height={36}
                  />
                ) : (
                  <div 
                    className="bg-placeholder" 
                    style={{ background: getPlaceholderColor(slot.type) }} 
                  />
                )}
                
                {slot.count > 0 && (
                  <div className="slot-count">
                    {slot.count}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
