import { NextResponse } from 'next/server'
import { repositoriesChangeToken } from '@/lib/repos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const token = await repositoriesChangeToken()
  return NextResponse.json({ token })
}
