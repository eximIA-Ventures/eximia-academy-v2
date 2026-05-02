"use client"

import { createContext, useContext } from "react"

interface AreaData {
  id: string
  name: string
  slug: string
}

interface AreaContextValue {
  activeArea: AreaData | null
  userAreas: AreaData[]
}

const AreaContext = createContext<AreaContextValue>({
  activeArea: null,
  userAreas: [],
})

export function AreaProvider({
  activeArea,
  userAreas,
  children,
}: {
  activeArea: AreaData | null
  userAreas: AreaData[]
  children: React.ReactNode
}) {
  return <AreaContext.Provider value={{ activeArea, userAreas }}>{children}</AreaContext.Provider>
}

export function useArea() {
  return useContext(AreaContext)
}

export type { AreaData }
