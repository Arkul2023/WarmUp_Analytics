import React, { createContext, useContext, useState } from 'react'

export interface FilterContextType {
  customer: string
  setCustomer: (customer: string) => void
  autoRefresh: boolean
  setAutoRefresh: React.Dispatch<React.SetStateAction<boolean>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0)

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <FilterContext.Provider
      value={{
        customer,
        setCustomer,
        autoRefresh,
        setAutoRefresh,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const context = useContext(FilterContext)
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider')
  }
  return context
}
