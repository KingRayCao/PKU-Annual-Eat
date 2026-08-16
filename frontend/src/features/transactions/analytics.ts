import type {
  RankingMetric,
  SortDirection,
  SortKey,
  Transaction,
  TransactionFilters,
  TrendGranularity,
} from './types'

export const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export const timeBands = [
  { id: 'late-night', label: '深夜', range: '00–05', start: 0, end: 5 },
  { id: 'breakfast', label: '早晨', range: '06–09', start: 6, end: 9 },
  { id: 'lunch', label: '午间', range: '10–13', start: 10, end: 13 },
  { id: 'afternoon', label: '下午', range: '14–16', start: 14, end: 16 },
  { id: 'dinner', label: '晚间', range: '17–20', start: 17, end: 20 },
  { id: 'night', label: '夜晚', range: '21–23', start: 21, end: 23 },
]

function localDateKey(value: string): string {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(value: string): string {
  const date = new Date(value)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return localDateKey(date.toISOString())
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const query = filters.search.trim().toLocaleLowerCase('zh-CN')
  const band = timeBands.find((item) => item.id === filters.timeBand)

  return transactions.filter((transaction) => {
    if (query && !transaction.merchant.toLocaleLowerCase('zh-CN').includes(query)) return false
    if (filters.merchant && transaction.merchant !== filters.merchant) return false
    if (!transaction.occurredAt) return !filters.startDate && !filters.endDate && !band
    const date = localDateKey(transaction.occurredAt)
    if (filters.startDate && date < filters.startDate) return false
    if (filters.endDate && date > filters.endDate) return false
    if (band) {
      const hour = new Date(transaction.occurredAt).getHours()
      if (hour < band.start || hour > band.end) return false
    }
    return true
  })
}

export function summarize(transactions: Transaction[]) {
  const amountCents = transactions.reduce((sum, item) => sum + item.amountCents, 0)
  const dates = transactions
    .flatMap((item) => (item.occurredAt ? [localDateKey(item.occurredAt)] : []))
    .sort()
  const activeDays = new Set(dates).size

  return {
    amountCents,
    count: transactions.length,
    merchantCount: new Set(transactions.map((item) => item.merchant)).size,
    activeDays,
    dailyAverageCents: activeDays ? Math.round(amountCents / activeDays) : 0,
    averageCents: transactions.length ? Math.round(amountCents / transactions.length) : 0,
  }
}

export function buildTrend(transactions: Transaction[], granularity: TrendGranularity) {
  const buckets = new Map<string, { amountCents: number; count: number }>()

  transactions.forEach((item) => {
    if (!item.occurredAt) return
    let key = localDateKey(item.occurredAt)
    if (granularity === 'week') key = startOfWeek(item.occurredAt)
    if (granularity === 'month') key = key.slice(0, 7)
    const current = buckets.get(key) ?? { amountCents: 0, count: 0 }
    current.amountCents += item.amountCents
    current.count += 1
    buckets.set(key, current)
  })

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, ...value }))
}

export function buildRanking(transactions: Transaction[], metric: RankingMetric) {
  const merchants = new Map<string, { amountCents: number; count: number }>()
  transactions.forEach((item) => {
    const current = merchants.get(item.merchant) ?? { amountCents: 0, count: 0 }
    current.amountCents += item.amountCents
    current.count += 1
    merchants.set(item.merchant, current)
  })

  return [...merchants.entries()]
    .map(([merchant, value]) => ({
      merchant,
      ...value,
      averageCents: Math.round(value.amountCents / value.count),
      value:
        metric === 'amount'
          ? value.amountCents / 100
          : metric === 'count'
            ? value.count
            : value.amountCents / value.count / 100,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
}

export function merchantDistribution(transactions: Transaction[]) {
  const amounts = new Map<string, number>()
  transactions.forEach((item) => {
    amounts.set(item.merchant, (amounts.get(item.merchant) ?? 0) + item.amountCents)
  })

  const merchants = [...amounts.entries()]
    .map(([merchant, amountCents]) => ({ merchant, amountCents }))
    .sort((left, right) => right.amountCents - left.amountCents)
  const topMerchants = merchants.slice(0, 8)
  const otherAmountCents = merchants
    .slice(8)
    .reduce((sum, item) => sum + item.amountCents, 0)

  return merchants.length > 8
    ? [...topMerchants, { merchant: '其他', amountCents: otherAmountCents }]
    : topMerchants
}

export function buildHeatmap(transactions: Transaction[]) {
  const cells = new Map<string, { amountCents: number; count: number }>()
  transactions.forEach((item) => {
    if (!item.occurredAt) return
    const date = new Date(item.occurredAt)
    const weekday = date.getDay()
    const hour = date.getHours()
    const key = `${weekday}-${hour}`
    const current = cells.get(key) ?? { amountCents: 0, count: 0 }
    current.amountCents += item.amountCents
    current.count += 1
    cells.set(key, current)
  })

  return Array.from({ length: 7 }, (_, weekday) =>
    Array.from({ length: 24 }, (_, hour) => {
      const value = cells.get(`${weekday}-${hour}`) ?? { amountCents: 0, count: 0 }
      return [hour, weekday, value.amountCents / 100, value.count] as [
        number,
        number,
        number,
        number,
      ]
    }),
  ).flat()
}

export function buildTimeBandSummary(transactions: Transaction[]) {
  const summaries = timeBands.map((band) => {
    const amountCents = transactions.reduce((sum, item) => {
      if (!item.occurredAt) return sum
      const hour = new Date(item.occurredAt).getHours()
      return hour >= band.start && hour <= band.end ? sum + item.amountCents : sum
    }, 0)
    return { ...band, amountCents }
  })
  const maxAmountCents = Math.max(0, ...summaries.map((item) => item.amountCents))

  return summaries.map((item) => ({
    ...item,
    intensity: maxAmountCents ? item.amountCents / maxAmountCents : 0,
  }))
}

export function sortTransactions(
  transactions: Transaction[],
  sortKey: SortKey,
  direction: SortDirection,
) {
  return [...transactions].sort((left, right) => {
    let result = 0
    if (sortKey === 'amountCents') result = left.amountCents - right.amountCents
    else result = (left[sortKey] ?? '').localeCompare(right[sortKey] ?? '', 'zh-CN')
    return direction === 'asc' ? result : -result
  })
}

export function toCsv(transactions: Transaction[]): string {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const rows = transactions.map((item) => [
    item.id,
    item.occurredAt ?? '',
    item.merchant,
    (item.amountCents / 100).toFixed(2),
  ])
  return [['流水号', '交易时间', '商户', '金额（元）'], ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\n')
}
