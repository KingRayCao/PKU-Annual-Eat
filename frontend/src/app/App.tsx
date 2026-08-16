import { ChangeEvent, FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { EChartsOption } from 'echarts'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileSearch,
  FilterX,
  LoaderCircle,
  ReceiptText,
  Search,
  Upload,
  Utensils,
  WalletCards,
} from 'lucide-react'
import {
  buildHeatmap,
  buildRanking,
  buildTimeBandSummary,
  buildTrend,
  filterTransactions,
  formatMoney,
  merchantDistribution,
  sortTransactions,
  summarize,
  toCsv,
  weekdayLabels,
} from '../features/transactions/analytics'
import { queryTransactions } from '../features/transactions/api'
import { GuidePage } from '../components/GuidePage'
import { parseImportedData } from '../features/transactions/localData'
import type {
  QueryResponse,
  RankingMetric,
  SortDirection,
  SortKey,
  TransactionFilters,
  TrendGranularity,
} from '../features/transactions/types'

const EChart = lazy(() =>
  import('../components/EChart').then((module) => ({ default: module.EChart })),
)

const defaultForm = {
  account: '',
  hallticket: '',
  startDate: `${new Date().getFullYear()}-01-01`,
  endDate: new Date().toISOString().slice(0, 10),
  excludedKeywords: '体育',
}

const emptyFilters: TransactionFilters = {
  search: '',
  merchant: '',
  startDate: '',
  endDate: '',
  timeBand: '',
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={value === option.value ? 'is-active' : ''}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function DashboardChart({
  option,
  ariaLabel,
  className,
}: {
  option: EChartsOption
  ariaLabel: string
  className?: string
}) {
  return (
    <Suspense fallback={<div className={`chart chart-loading ${className ?? ''}`}>正在绘制图表</div>}>
      <EChart option={option} ariaLabel={ariaLabel} className={className} />
    </Suspense>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return '时间缺失'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间异常'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function Dashboard() {
  const [form, setForm] = useState(defaultForm)
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showTicket, setShowTicket] = useState(false)
  const [filters, setFilters] = useState<TransactionFilters>(emptyFilters)
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>('week')
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>('amount')
  const [sortKey, setSortKey] = useState<SortKey>('occurredAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const abortRef = useRef<AbortController | null>(null)
  const importRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const transactions = result?.transactions ?? []
  const merchants = useMemo(
    () => [...new Set(transactions.map((item) => item.merchant))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [transactions],
  )
  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters])
  const summary = useMemo(() => summarize(filtered), [filtered])
  const trend = useMemo(
    () => buildTrend(filtered, trendGranularity),
    [filtered, trendGranularity],
  )
  const ranking = useMemo(
    () => buildRanking(filtered, rankingMetric),
    [filtered, rankingMetric],
  )
  const distribution = useMemo(() => merchantDistribution(filtered), [filtered])
  const heatmap = useMemo(() => buildHeatmap(filtered), [filtered])
  const bandContext = useMemo(
    () => filterTransactions(transactions, { ...filters, timeBand: '' }),
    [transactions, filters],
  )
  const bandSummary = useMemo(() => buildTimeBandSummary(bandContext), [bandContext])
  const sorted = useMemo(
    () => sortTransactions(filtered, sortKey, sortDirection),
    [filtered, sortKey, sortDirection],
  )
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => setPage(1), [filters, pageSize])
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const commonChart: EChartsOption = {
    animation: !reduceMotion,
    textStyle: { fontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif', color: '#4b4a48' },
    tooltip: { trigger: 'axis', backgroundColor: '#171717', borderWidth: 0, textStyle: { color: '#fff' } },
  }

  const trendOption: EChartsOption = {
    ...commonChart,
    grid: { left: 10, right: 14, top: 52, bottom: 12, containLabel: true },
    legend: { top: 2, right: 6, data: ['消费金额', '消费次数'], textStyle: { color: '#696866' } },
    xAxis: {
      type: 'category',
      data: trend.map((item) => item.key),
      axisLine: { lineStyle: { color: '#d9d7d2' } },
      axisLabel: { color: '#777572', hideOverlap: true },
    },
    yAxis: [
      { type: 'value', name: '元', nameGap: 14, splitLine: { lineStyle: { color: '#ebe9e4' } } },
      { type: 'value', name: '次', nameGap: 14, splitLine: { show: false } },
    ],
    series: [
      {
        name: '消费金额',
        type: 'line',
        data: trend.map((item) => item.amountCents / 100),
        smooth: 0.25,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 3, color: '#8c1d40' },
        itemStyle: { color: '#8c1d40' },
      },
      {
        name: '消费次数',
        type: 'bar',
        yAxisIndex: 1,
        data: trend.map((item) => item.count),
        itemStyle: { color: '#b6d3d4', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 18,
      },
    ],
  }

  const rankingLabel = rankingMetric === 'count' ? '次' : '元'
  const rankingOption: EChartsOption = {
    ...commonChart,
    grid: { left: 12, right: 24, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: `{value} ${rankingLabel}` }, splitLine: { lineStyle: { color: '#ebe9e4' } } },
    yAxis: {
      type: 'category',
      data: [...ranking].reverse().map((item) => item.merchant),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#4b4a48', width: 140, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        name: rankingMetric === 'amount' ? '消费金额' : rankingMetric === 'count' ? '消费次数' : '平均单笔',
        data: [...ranking].reverse().map((item, index) => ({
          value: item.value,
          itemStyle: { color: index === ranking.length - 1 ? '#8c1d40' : '#167d8d' },
        })),
        barMaxWidth: 18,
        itemStyle: { borderRadius: [0, 3, 3, 0] },
      },
    ],
  }

  const distributionOption: EChartsOption = {
    animation: !reduceMotion,
    color: ['#8c1d40', '#167d8d', '#e2a93b', '#3e5564', '#bf6b52', '#7a8e68', '#b9a1a9', '#6e8f98', '#5d5552'],
    tooltip: {
      trigger: 'item',
      formatter: '{b}<br/>{c} 元 · {d}%',
      backgroundColor: '#171717',
      borderWidth: 0,
      textStyle: { color: '#fff' },
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 12,
      top: 'middle',
      width: 130,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#545250', fontSize: 11 },
    },
    series: [
      {
        name: '消费去向',
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['37%', '51%'],
        minAngle: 2,
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          scaleSize: 5,
          label: { show: true, formatter: '{b}\n{d}%', fontWeight: 700, color: '#171717' },
        },
        data: distribution.map((item) => ({
          name: item.merchant,
          value: item.amountCents / 100,
        })),
      },
    ],
    media: [
      {
        query: { maxWidth: 520 },
        option: {
          legend: { orient: 'horizontal', left: 'center', right: 'auto', top: 'auto', bottom: 0, width: '90%' },
          series: [{ center: ['50%', '42%'], radius: ['42%', '64%'] }],
        },
      },
    ],
  }

  const heatmapMax = Math.max(1, ...heatmap.map((item) => item[2]))
  const heatmapOption: EChartsOption = {
    animation: !reduceMotion,
    tooltip: {
      position: 'top',
      backgroundColor: '#171717',
      borderWidth: 0,
      textStyle: { color: '#fff' },
      formatter: (parameters: unknown) => {
        const item = parameters as { value: [number, number, number, number] }
        const [hour, weekday, amount, count] = item.value
        return `${weekdayLabels[weekday]} ${String(hour).padStart(2, '0')}:00<br/>¥${amount.toFixed(2)} · ${count} 次`
      },
    },
    grid: { left: 50, right: 12, top: 8, bottom: 64 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')),
      splitArea: { show: true },
      axisLabel: { interval: 2, color: '#777572' },
      axisLine: { lineStyle: { color: '#d9d7d2' } },
    },
    yAxis: {
      type: 'category',
      data: weekdayLabels,
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      dimension: 2,
      min: 0,
      max: heatmapMax,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 92,
      text: ['高', '低'],
      inRange: { color: ['#f1f0ec', '#b6d3d4', '#167d8d', '#8c1d40'] },
    },
    series: [{ type: 'heatmap', data: heatmap, emphasis: { itemStyle: { borderColor: '#171717', borderWidth: 1 } } }],
  }

  async function handleQuery(event: FormEvent) {
    event.preventDefault()
    if (form.startDate > form.endDate) {
      setError('开始日期不能晚于结束日期。')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError('')
    try {
      const response = await queryTransactions(
        {
          account: form.account.trim(),
          hallticket: form.hallticket.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          excludedKeywords: form.excludedKeywords.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
        },
        controller.signal,
      )
      setResult(response)
      setFilters(emptyFilters)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : '查询未完成，请稍后重试。')
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    abortRef.current?.abort()
    setLoading(false)
    setError('')
    try {
      const imported = parseImportedData(await file.text(), {
        startDate: form.startDate,
        endDate: form.endDate,
        excludedKeywords: form.excludedKeywords.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
      })
      setResult(imported)
      setFilters(emptyFilters)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法读取这个 JSON 文件。')
    } finally {
      input.value = ''
    }
  }

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(nextKey)
      setSortDirection(nextKey === 'merchant' ? 'asc' : 'desc')
    }
  }

  function download(content: string, extension: 'csv' | 'json', type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `校园卡流水-${new Date().toISOString().slice(0, 10)}.${extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function downloadCsv() {
    download(`\ufeff${toCsv(sorted)}`, 'csv', 'text/csv;charset=utf-8')
  }

  function downloadJson() {
    download(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          filters,
          meta: result?.meta ?? null,
          summary,
          transactions: sorted,
        },
        null,
        2,
      ),
      'json',
      'application/json;charset=utf-8',
    )
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">燕</div>
        <div>
          <p className="brand-name">燕园今天的饭</p>
        </div>
        <div className="topbar-actions">
          <a
            className="topbar-help"
            href="#/guide"
            aria-label="打开使用说明"
            title="使用说明"
          >
            <CircleHelp size={17} aria-hidden="true" />
            <span>使用说明</span>
          </a>
        </div>
      </header>

      <main>
        <section className="query-band" aria-label="查询校园卡流水">
          <form className="query-form" onSubmit={handleQuery}>
            <label>
              <span>校园卡账号</span>
              <input
                required
                autoComplete="off"
                value={form.account}
                onChange={(event) => setForm({ ...form, account: event.target.value })}
                placeholder="输入 account"
              />
            </label>
            <label>
              <span>Hallticket</span>
              <span className="input-with-action">
                <input
                  required
                  type={showTicket ? 'text' : 'password'}
                  autoComplete="off"
                  value={form.hallticket}
                  onChange={(event) => setForm({ ...form, hallticket: event.target.value })}
                  placeholder="仅用于本次查询"
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowTicket((value) => !value)}
                  aria-label={showTicket ? '隐藏 Hallticket' : '显示 Hallticket'}
                  title={showTicket ? '隐藏 Hallticket' : '显示 Hallticket'}
                >
                  {showTicket ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            <label>
              <span>开始日期</span>
              <input type="date" required value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
            </label>
            <label>
              <span>结束日期</span>
              <input type="date" required value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
            </label>
            <label>
              <span>排除关键词</span>
              <input value={form.excludedKeywords} onChange={(event) => setForm({ ...form, excludedKeywords: event.target.value })} placeholder="以逗号分隔" />
            </label>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}
              {loading ? '正在查询' : '查询流水'}
            </button>
          </form>
          <div className="query-support">
            <p className="privacy-note">
              <CircleHelp size={14} />
              凭证不会保存在浏览器中，刷新页面后即清除。
              <a href="#/guide">打开使用说明</a>
            </p>
            <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={handleImport} />
            <button type="button" className="secondary-button import-button" onClick={() => importRef.current?.click()}>
              <Upload size={15} aria-hidden="true" />
              导入本地 JSON
            </button>
          </div>
          {error && <div className="status-message error" role="alert"><AlertCircle size={18} />{error}</div>}
        </section>

        {loading && (
          <section className="loading-state" aria-live="polite">
            <LoaderCircle className="spin" size={28} />
            <strong>正在整理校园卡流水</strong>
            <span>数据返回后会自动生成全部统计视图。</span>
          </section>
        )}

        {!result && !loading && (
          <section className="welcome-state">
            <div className="welcome-icon"><WalletCards size={28} /></div>
            <h2>看看这段时间吃了什么……</h2>
            <p>输入校园卡账号与 Hallticket，查询后可查看趋势、排行、时段与逐笔明细。</p>
          </section>
        )}

        {result && !loading && (
          <>
            <section className="filter-band" aria-label="数据筛选">
              <div className="filter-title"><Search size={16} /><strong>筛选当前视图</strong></div>
              <label className="search-field">
                <span className="sr-only">搜索商户</span>
                <Search size={16} aria-hidden="true" />
                <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="搜索商户" />
              </label>
              <label>
                <span className="sr-only">选择商户</span>
                <select value={filters.merchant} onChange={(event) => setFilters({ ...filters, merchant: event.target.value })}>
                  <option value="">全部商户</option>
                  {merchants.map((merchant) => <option key={merchant}>{merchant}</option>)}
                </select>
              </label>
              <label><span className="sr-only">筛选开始日期</span><input type="date" min={result.meta.startDate} max={result.meta.endDate} value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} /></label>
              <span className="date-separator">至</span>
              <label><span className="sr-only">筛选结束日期</span><input type="date" min={result.meta.startDate} max={result.meta.endDate} value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} /></label>
              <button type="button" className="icon-button filter-clear" disabled={!hasFilters} onClick={() => setFilters(emptyFilters)} aria-label="清除全部筛选" title="清除全部筛选"><FilterX size={18} /></button>
              <span className="filter-count">显示 {filtered.length} / {transactions.length} 笔</span>
            </section>

            {result.meta.warnings.length > 0 && (
              <div className="warning-strip" role="status"><AlertCircle size={17} /><span>{result.meta.warnings.join('；')}</span></div>
            )}

            {filtered.length === 0 ? (
              <section className="empty-state">
                <FileSearch size={30} />
                <h2>没有符合条件的流水</h2>
                <p>调整日期、商户或时段筛选后再看。</p>
                <button type="button" className="secondary-button" onClick={() => setFilters(emptyFilters)}>清除筛选</button>
              </section>
            ) : (
              <>
                <section className="overview-band" aria-labelledby="overview-title">
                  <div className="section-heading compact">
                    <div><p className="eyebrow">账本总览</p><h2 id="overview-title">{result.meta.startDate} 至 {result.meta.endDate}</h2></div>
                    <span className="meta-note">排除 {result.meta.excludedRows} 笔 · 原始 {result.meta.totalRows} 笔</span>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric metric-primary"><span>消费总额</span><strong>{formatMoney(summary.amountCents)}</strong><small>当前筛选口径</small></div>
                    <div className="metric"><ReceiptText size={18} /><span>消费次数</span><strong>{summary.count}</strong><small>平均 {formatMoney(summary.averageCents)} / 笔</small></div>
                    <div className="metric"><Utensils size={18} /><span>消费商户</span><strong>{summary.merchantCount}</strong><small>覆盖 {summary.activeDays} 个消费日</small></div>
                    <div className="metric"><CalendarDays size={18} /><span>消费日均</span><strong>{formatMoney(summary.dailyAverageCents)}</strong><small>按有流水日期计算</small></div>
                  </div>
                </section>

                <section className="analysis-grid">
                  <div className="analysis-panel trend-panel">
                    <div className="panel-heading"><div><p className="eyebrow">时间变化</p><h2>消费趋势</h2></div><SegmentedControl label="趋势统计周期" value={trendGranularity} onChange={setTrendGranularity} options={[{ value: 'day', label: '日' }, { value: 'week', label: '周' }, { value: 'month', label: '月' }]} /></div>
                    <DashboardChart option={trendOption} ariaLabel={`${trendGranularity === 'day' ? '每日' : trendGranularity === 'week' ? '每周' : '每月'}消费金额与次数趋势图`} />
                  </div>
                  <div className="analysis-panel ranking-panel">
                    <div className="panel-heading"><div><p className="eyebrow">去向分布</p><h2>商户排行</h2></div><SegmentedControl label="商户排行指标" value={rankingMetric} onChange={setRankingMetric} options={[{ value: 'amount', label: '金额' }, { value: 'count', label: '次数' }, { value: 'average', label: '客单价' }]} /></div>
                    <DashboardChart option={rankingOption} ariaLabel={`按${rankingMetric === 'amount' ? '金额' : rankingMetric === 'count' ? '次数' : '客单价'}排序的商户图`} />
                  </div>
                </section>

                <section className="distribution-band" aria-labelledby="distribution-title">
                  <div className="section-heading compact">
                    <div>
                      <p className="eyebrow">金额占比</p>
                      <h2 id="distribution-title">商户消费分布</h2>
                    </div>
                    <span className="meta-note">按当前筛选后的消费金额计算</span>
                  </div>
                  <div className="distribution-layout">
                    <div className="distribution-copy">
                      <strong>{summary.merchantCount}</strong>
                      <span>个消费商户</span>
                      <p>悬停或点按图例，可查看各商户的金额与占比。</p>
                    </div>
                    <DashboardChart option={distributionOption} ariaLabel="各商户消费金额占比环形图" className="distribution-chart" />
                  </div>
                </section>

                <section className="rhythm-band" aria-labelledby="rhythm-title">
                  <div className="section-heading compact"><div><p className="eyebrow">一天的节奏</p><h2 id="rhythm-title">24 小时消费轨道</h2></div><span className="meta-note"><Clock3 size={14} />点击时段可联动全部视图</span></div>
                  <div className="time-track" role="group" aria-label="按时段筛选">
                    {bandSummary.map((band) => (
                      <button key={band.id} type="button" className={filters.timeBand === band.id ? 'is-active' : ''} aria-pressed={filters.timeBand === band.id} onClick={() => setFilters({ ...filters, timeBand: filters.timeBand === band.id ? '' : band.id })}>
                        <span className="track-fill" style={{ height: `${band.intensity ? Math.max(4, band.intensity * 100) : 0}%` }} aria-hidden="true" />
                        <strong>{band.label}</strong><small>{band.range}</small><span>{formatMoney(band.amountCents)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="heatmap-wrap"><DashboardChart option={heatmapOption} ariaLabel="星期与小时交叉的消费金额热力图" /></div>
                </section>

                <section className="detail-band" aria-labelledby="detail-title">
                  <div className="section-heading compact">
                    <div><p className="eyebrow">逐笔核对</p><h2 id="detail-title">消费明细</h2></div>
                    <div className="export-actions" role="group" aria-label="导出当前筛选数据">
                      <button type="button" className="secondary-button" onClick={downloadCsv}><Download size={16} />导出 CSV</button>
                      <button type="button" className="secondary-button" onClick={downloadJson}><FileJson size={16} />导出 JSON</button>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr>
                        <th><button type="button" onClick={() => handleSort('occurredAt')}>交易时间 {sortKey === 'occurredAt' && (sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}</button></th>
                        <th><button type="button" onClick={() => handleSort('merchant')}>商户 {sortKey === 'merchant' && (sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}</button></th>
                        <th className="amount-cell"><button type="button" onClick={() => handleSort('amountCents')}>金额 {sortKey === 'amountCents' && (sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}</button></th>
                      </tr></thead>
                      <tbody>{pageRows.map((item) => <tr key={item.id}><td>{formatDateTime(item.occurredAt)}</td><td>{item.merchant}</td><td className="amount-cell">{formatMoney(item.amountCents)}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <label>每页<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select>笔</label>
                    <span>第 {page} / {pageCount} 页</span>
                    <div><button type="button" className="icon-button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="上一页" title="上一页"><ChevronLeft size={18} /></button><button type="button" className="icon-button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} aria-label="下一页" title="下一页"><ChevronRight size={18} /></button></div>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
      <footer><span>燕园今天的饭</span><span>数据仅在当前页面会话中处理</span></footer>
    </div>
  )
}

function App() {
  const [route, setRoute] = useState(window.location.hash)

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const isGuide = route === '#/guide'

  return (
    <>
      <div hidden={isGuide}>
        <Dashboard />
      </div>
      {isGuide && <GuidePage />}
    </>
  )
}

export default App
