import type { QueryMeta, QueryResponse, Transaction } from './types'

type ImportDefaults = {
  startDate: string
  endDate: string
  excludedKeywords: string[]
}

type UnknownRecord = Record<string, unknown>

const idFields = ['JNUM', 'ID', 'id', 'SERIALNO', 'SYSNO', 'TRANSNO']

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const candidate = value.trim().replaceAll('/', '-').replace(' ', 'T')
  return Number.isNaN(new Date(candidate).getTime()) ? null : candidate
}

function normalizeMeta(value: unknown, count: number, defaults: ImportDefaults): QueryMeta {
  const meta = isRecord(value) ? value : {}
  return {
    startDate: typeof meta.startDate === 'string' ? meta.startDate : defaults.startDate,
    endDate: typeof meta.endDate === 'string' ? meta.endDate : defaults.endDate,
    totalRows: numberOr(meta.totalRows, count),
    includedRows: numberOr(meta.includedRows, count),
    excludedRows: numberOr(meta.excludedRows, 0),
    warnings: Array.isArray(meta.warnings)
      ? meta.warnings.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

function parseTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) throw new Error('JSON 中缺少 transactions 数组。')

  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 条流水格式无效。`)
    if (typeof item.merchant !== 'string' || !item.merchant.trim()) {
      throw new Error(`第 ${index + 1} 条流水缺少商户名称。`)
    }
    if (typeof item.amountCents !== 'number' || !Number.isFinite(item.amountCents)) {
      throw new Error(`第 ${index + 1} 条流水金额无效。`)
    }
    if (item.occurredAt !== null && typeof item.occurredAt !== 'string') {
      throw new Error(`第 ${index + 1} 条流水时间无效。`)
    }

    return {
      id: typeof item.id === 'string' && item.id ? item.id : `local-${index + 1}`,
      occurredAt: item.occurredAt,
      merchant: item.merchant.trim(),
      amountCents: Math.round(item.amountCents),
    }
  })
}

function parseRawRows(rows: unknown[], defaults: ImportDefaults): QueryResponse {
  const warnings: string[] = []
  let invalidRows = 0
  const seenIds = new Set<string>()
  const transactions: Transaction[] = []

  rows.forEach((value, index) => {
    if (!isRecord(value)) {
      invalidRows += 1
      return
    }
    const amount = Number(value.TRANAMT)
    if (!Number.isFinite(amount)) {
      invalidRows += 1
      return
    }
    if (amount >= 0) return
    const merchant = typeof value.MERCNAME === 'string' ? value.MERCNAME.trim() : ''
    if (!merchant || defaults.excludedKeywords.some((keyword) => merchant.includes(keyword))) return

    const upstreamId = idFields
      .map((field) => value[field])
      .find((item) => item !== null && item !== undefined && String(item).trim())
    let id = upstreamId === undefined ? '' : String(upstreamId).trim()
    if (!id || seenIds.has(id)) id = `local-${index + 1}`
    seenIds.add(id)

    transactions.push({
      id,
      occurredAt: normalizeTime(value.OCCTIME),
      merchant,
      amountCents: Math.round(Math.abs(amount) * 100),
    })
  })

  if (invalidRows) warnings.push(`${invalidRows} 条记录格式无效，已跳过`)
  return {
    meta: {
      startDate: defaults.startDate,
      endDate: defaults.endDate,
      totalRows: rows.length,
      includedRows: transactions.length,
      excludedRows: rows.length - transactions.length,
      warnings,
    },
    transactions,
  }
}

export function parseImportedData(content: string, defaults: ImportDefaults): QueryResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('文件不是有效的 JSON。')
  }
  if (!isRecord(parsed)) throw new Error('JSON 顶层必须是对象。')

  if (Array.isArray(parsed.transactions)) {
    const transactions = parseTransactions(parsed.transactions)
    return { meta: normalizeMeta(parsed.meta, transactions.length, defaults), transactions }
  }
  if (Array.isArray(parsed.rows)) return parseRawRows(parsed.rows, defaults)
  throw new Error('未找到 transactions 或校园卡 rows 数据。')
}
