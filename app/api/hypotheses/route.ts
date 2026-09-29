import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const domainId = searchParams.get('domain_id')
    const status = searchParams.get('status')
    const origin = searchParams.get('origin')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    let query = supabase
      .from('hypotheses')
      .select(`
        *,
        hypothesis_patterns (
          pattern_id,
          role,
          weight,
          pattern:patterns (
            id,
            pattern_type,
            title,
            statement,
            strength_score,
            persistence_score,
            confidence,
            status
          )
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('confidence', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (domainId) {
      query = query.eq('workspace_domain_id', domainId)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (origin) {
      query = query.eq('origin', origin)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data, count: data?.length || 0 })
  } catch (error) {
    console.error('Hypotheses API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}