import { create } from 'zustand'
import { BlockType } from '../world/VoxelConfig'

export interface InventorySlot {
  type: BlockType | null
  count: number
}

interface InventoryState {
  slots: InventorySlot[]
  selectedSlotIndex: number
  addItem: (type: BlockType) => void
  removeItem: (type: BlockType) => boolean
  selectSlot: (index: number) => void
  setSlot: (index: number, type: BlockType | null, count: number) => void
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  slots: Array(9).fill(null).map(() => ({ type: null, count: 0 })),
  selectedSlotIndex: 0,
  
  setSlot: (index, type, count) => {
    const slots = [...get().slots]
    slots[index] = { type, count }
    set({ slots })
  },

  addItem: (type: BlockType) => {
    const slots = [...get().slots]
    
    // 1. Try to find existing stack
    const existingSlot = slots.find(s => s.type === type && s.count < 64)
    if (existingSlot) {
      existingSlot.count++
      set({ slots })
      return
    }

    // 2. Find empty slot
    const emptySlot = slots.find(s => s.type === null)
    if (emptySlot) {
      emptySlot.type = type
      emptySlot.count = 1
      set({ slots })
      return
    }
  },

  removeItem: (type: BlockType) => {
    const slots = [...get().slots]
    const slot = slots.find(s => s.type === type && s.count > 0)
    if (slot) {
      slot.count--
      if (slot.count <= 0) {
        slot.type = null
      }
      set({ slots })
      return true
    }
    return false
  },

  selectSlot: (index: number) => {
    if (index >= 0 && index < 9) {
      set({ selectedSlotIndex: index })
    }
  }
}))
