import { create } from 'zustand'

interface TimeState {
  gameTime: number
  setTime: (time: number) => void
}

export const useTimeStore = create<TimeState>((set) => ({
  gameTime: 6000,
  setTime: (gameTime) => set({ gameTime })
}))
