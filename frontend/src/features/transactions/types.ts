export type Transaction = {
  id: string
  occurredAt: string | null
  merchant: string
  amountCents: number
}

export type QueryMeta = {
  startDate: string
  endDate: string
  totalRows: number
  includedRows: number
  excludedRows: number
  warnings: string[]
}

export type QueryResponse = {
  meta: QueryMeta
  transactions: Transaction[]
}

export type QueryRequest = {
  account: string
  hallticket: string
  startDate: string
  endDate: string
  excludedKeywords: string[]
}

export type TrendGranularity = 'day' | 'week' | 'month'
export type RankingMetric = 'amount' | 'count' | 'average'
export type SortKey = 'occurredAt' | 'merchant' | 'amountCents'
export type SortDirection = 'asc' | 'desc'

export type TransactionFilters = {
  search: string
  merchant: string
  startDate: string
  endDate: string
  timeBand: string
}
