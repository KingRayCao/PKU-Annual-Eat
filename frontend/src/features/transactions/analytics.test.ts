import { describe, expect, it } from 'vitest'
import {
  buildHeatmap,
  buildRanking,
  buildTimeBandSummary,
  buildTrend,
  filterTransactions,
  merchantDistribution,
  sortTransactions,
  summarize,
  toCsv,
} from './analytics'
import type { Transaction, TransactionFilters } from './types'

const transactions: Transaction[] = [
  { id: '1', occurredAt: '2025-01-06T08:00:00+08:00', merchant: '农园', amountCents: 1000 },
  { id: '2', occurredAt: '2025-01-06T12:00:00+08:00', merchant: '农园', amountCents: 1500 },
  { id: '3', occurredAt: '2025-01-08T18:00:00+08:00', merchant: '燕南', amountCents: 2000 },
  { id: '4', occurredAt: null, merchant: '历史流水', amountCents: 500 },
]

const filters: TransactionFilters = {
  search: '',
  merchant: '',
  startDate: '',
  endDate: '',
  timeBand: '',
}

describe('analytics', () => {
  it('calculates summary from the current transaction set', () => {
    expect(summarize(transactions)).toEqual({
      amountCents: 5000,
      count: 4,
      merchantCount: 3,
      activeDays: 2,
      dailyAverageCents: 2500,
      averageCents: 1250,
    })
  })

  it('filters by merchant, date, and meal band', () => {
    expect(filterTransactions(transactions, { ...filters, merchant: '农园' })).toHaveLength(2)
    expect(filterTransactions(transactions, { ...filters, startDate: '2025-01-07' }).map((item) => item.id)).toEqual(['3'])
    expect(filterTransactions(transactions, { ...filters, timeBand: 'dinner' }).map((item) => item.id)).toEqual(['3'])
  })

  it('groups trends without including missing timestamps', () => {
    expect(buildTrend(transactions, 'day')).toEqual([
      { key: '2025-01-06', amountCents: 2500, count: 2 },
      { key: '2025-01-08', amountCents: 2000, count: 1 },
    ])
    expect(buildTrend(transactions, 'week')).toEqual([
      { key: '2025-01-06', amountCents: 4500, count: 3 },
    ])
  })

  it('ranks merchants by amount, count, and average', () => {
    expect(buildRanking(transactions, 'amount')[0].merchant).toBe('农园')
    expect(buildRanking(transactions, 'count')[0].count).toBe(2)
    expect(buildRanking(transactions, 'average')[0].merchant).toBe('燕南')
  })

  it('sorts merchant distribution by aggregated spending', () => {
    expect(
      merchantDistribution([
        { id: '1', occurredAt: null, merchant: '商户 B', amountCents: 300 },
        { id: '2', occurredAt: null, merchant: '商户 A', amountCents: 200 },
        { id: '3', occurredAt: null, merchant: '商户 A', amountCents: 200 },
      ]),
    ).toEqual([
      { merchant: '商户 A', amountCents: 400 },
      { merchant: '商户 B', amountCents: 300 },
    ])
  })

  it('merges merchant distribution after the top eight into other', () => {
    const manyMerchants: Transaction[] = Array.from({ length: 10 }, (_, index) => ({
      id: String(index + 1),
      occurredAt: null,
      merchant: `商户 ${index + 1}`,
      amountCents: (10 - index) * 100,
    }))

    expect(merchantDistribution(manyMerchants)).toEqual([
      { merchant: '商户 1', amountCents: 1000 },
      { merchant: '商户 2', amountCents: 900 },
      { merchant: '商户 3', amountCents: 800 },
      { merchant: '商户 4', amountCents: 700 },
      { merchant: '商户 5', amountCents: 600 },
      { merchant: '商户 6', amountCents: 500 },
      { merchant: '商户 7', amountCents: 400 },
      { merchant: '商户 8', amountCents: 300 },
      { merchant: '其他', amountCents: 300 },
    ])
  })

  it('keeps all merchant distribution entries when there are fewer than eight', () => {
    expect(merchantDistribution(transactions)).toEqual([
      { merchant: '农园', amountCents: 2500 },
      { merchant: '燕南', amountCents: 2000 },
      { merchant: '历史流水', amountCents: 500 },
    ])
  })

  it('returns an empty merchant distribution for empty input', () => {
    expect(merchantDistribution([])).toEqual([])
  })

  it('returns a complete seven by twenty-four heatmap', () => {
    const heatmap = buildHeatmap(transactions)
    expect(heatmap).toHaveLength(168)
    expect(heatmap.find(([hour, weekday]) => hour === 8 && weekday === 1)).toEqual([8, 1, 10, 1])
    expect(heatmap.find(([hour, weekday]) => hour === 12 && weekday === 1)).toEqual([12, 1, 15, 1])
    expect(heatmap.reduce((sum, cell) => sum + cell[3], 0)).toBe(3)
  })

  it('scales time bands against the largest band amount', () => {
    const bands = buildTimeBandSummary(transactions)
    expect(bands.find((item) => item.id === 'dinner')?.intensity).toBe(1)
    expect(bands.find((item) => item.id === 'breakfast')?.intensity).toBe(0.5)
    expect(buildTimeBandSummary([]).every((item) => item.intensity === 0)).toBe(true)
  })

  it('sorts and exports safely quoted CSV values', () => {
    expect(sortTransactions(transactions, 'amountCents', 'desc')[0].id).toBe('3')
    const csv = toCsv([{ ...transactions[0], merchant: '食堂,一层' }])
    expect(csv).toContain('"食堂,一层"')
    expect(csv).toContain('"10.00"')
  })
})
