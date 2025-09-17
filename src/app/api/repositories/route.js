import { NextResponse } from 'next/server'
import { listLocalRepositories } from '@/lib/repos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const repositories = await listLocalRepositories()
    return NextResponse.json({ repositories })
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? 'Unknown error' }, { status: 500 })
  }
}
