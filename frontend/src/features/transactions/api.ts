import type { QueryRequest, QueryResponse } from './types'

type ErrorBody = {
  error?: {
    message?: string
  }
  detail?: string | { msg?: string }[]
  message?: string
}

export async function queryTransactions(
  request: QueryRequest,
  signal?: AbortSignal,
): Promise<QueryResponse> {
  let response: Response
  try {
    response = await fetch('/api/v1/transactions/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new Error('无法连接查询服务。请启动后端，或导入本地 JSON 继续。')
  }

  if (!response.ok) {
    let message = `查询失败（HTTP ${response.status}）`
    try {
      const body = (await response.json()) as ErrorBody
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) {
        message = body.detail.map((item) => item.msg).filter(Boolean).join('；') || message
      } else if (body.error?.message) message = body.error.message
      else if (body.message) message = body.message
    } catch {
      // Keep the status-based message when the upstream body is not JSON.
    }
    throw new Error(message)
  }

  return (await response.json()) as QueryResponse
}
