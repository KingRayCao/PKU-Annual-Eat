import { describe, expect, it } from 'vitest'
import { parseImportedData } from './localData'

const defaults = {
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  excludedKeywords: ['体育'],
}

describe('local data import', () => {
  it('reads an exported query response', () => {
    const result = parseImportedData(
      JSON.stringify({
        meta: { startDate: '2025-02-01', endDate: '2025-02-28', warnings: [] },
        transactions: [
          { id: '1', occurredAt: '2025-02-02T08:00:00', merchant: '农园', amountCents: 1250 },
        ],
      }),
      defaults,
    )

    expect(result.meta.startDate).toBe('2025-02-01')
    expect(result.meta.includedRows).toBe(1)
    expect(result.transactions[0].amountCents).toBe(1250)
  })

  it('normalizes a raw campus card response in the browser', () => {
    const result = parseImportedData(
      JSON.stringify({
        rows: [
          { JNUM: '1', OCCTIME: '2025/03/01 08:30:00', MERCNAME: '学一食堂', TRANAMT: -12.34 },
          { JNUM: '2', OCCTIME: '2025/03/01 10:00:00', MERCNAME: '体育馆', TRANAMT: -20 },
          { JNUM: '3', MERCNAME: '充值', TRANAMT: 100 },
          { MERCNAME: '异常', TRANAMT: 'not-a-number' },
        ],
      }),
      defaults,
    )

    expect(result.transactions).toEqual([
      { id: '1', occurredAt: '2025-03-01T08:30:00', merchant: '学一食堂', amountCents: 1234 },
    ])
    expect(result.meta).toMatchObject({ totalRows: 4, includedRows: 1, excludedRows: 3 })
    expect(result.meta.warnings).toEqual(['1 条记录格式无效，已跳过'])
  })

  it('rejects unrelated JSON', () => {
    expect(() => parseImportedData('{"items":[]}', defaults)).toThrow('未找到 transactions 或校园卡 rows 数据。')
  })
})
