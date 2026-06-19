import { NextResponse, type NextRequest } from 'next/server'
import { executeQuery } from '@/lib/local-store.server'
import type { QueryDescriptor } from '@/lib/local-engine'

const LOCAL_MODE = process.env.NEXT_PUBLIC_LOCAL_MODE === 'true'

export async function POST(req: NextRequest) {
  if (!LOCAL_MODE) {
    return NextResponse.json({ data: null, error: { message: 'Local mode disabled' } }, { status: 403 })
  }
  try {
    const descriptor = (await req.json()) as QueryDescriptor
    const result = executeQuery(descriptor)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ data: null, error: { message: e?.message ?? 'Query failed' } }, { status: 500 })
  }
}
