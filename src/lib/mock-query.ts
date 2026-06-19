// ─── Supabase-style query builder ─────────────────────────────
// Chainable builder that packages a query into a QueryDescriptor and
// hands it to an injected executor (server: direct fs; browser: fetch).

import type { QueryDescriptor } from './local-engine'

export type Executor = (d: QueryDescriptor) => Promise<{ data: any; count?: number; error: any }>

export class MockQuery {
  private d: QueryDescriptor
  private executor: Executor

  constructor(table: string, executor: Executor) {
    this.executor = executor
    this.d = { table, filters: [], orders: [], op: null, data: null }
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count === 'exact') this.d.count = true
    if (opts?.head === true) this.d.head = true
    return this
  }

  eq(col: string, val: any)  { this.d.filters.push({ col, val, op: 'eq' }); return this }
  neq(col: string, val: any) { this.d.filters.push({ col, val, op: 'neq' }); return this }
  not(col: string, op: string, val: any) { this.d.filters.push({ col, val, op: 'not_' + op }); return this }
  in(col: string, vals: any[]) { this.d.filters.push({ col, val: vals, op: 'in' }); return this }

  order(col: string, opts?: { ascending?: boolean }) {
    this.d.orders.push({ col, asc: opts?.ascending !== false })
    return this
  }

  limit(n: number) { this.d.limit = n; return this }
  single() { this.d.single = true; return this }

  insert(data: any) { this.d.op = 'insert'; this.d.data = data; return this }
  update(data: any) { this.d.op = 'update'; this.d.data = data; return this }
  upsert(data: any, opts?: { onConflict?: string | string[] }) {
    this.d.op = 'upsert'
    this.d.data = data
    const oc = opts?.onConflict
    this.d.conflict = Array.isArray(oc)
      ? oc.map(s => s.trim())
      : oc ? oc.split(',').map(s => s.trim()) : []
    return this
  }
  delete() { this.d.op = 'delete'; return this }

  then(resolve: any, reject?: any) {
    return this.executor(this.d).then(resolve, reject)
  }
}
