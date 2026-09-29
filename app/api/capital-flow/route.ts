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
    const entityId = searchParams.get('entity_id')
    const matchType = searchParams.get('match_type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    let query = supabase
      .from('capital_flow_mappings')
      .select(`
        *,
        pattern:patterns (
          id,
          pattern_type,
          title,
          statement,
          strength_score,
          persistence_score,
          confidence,
          status
        ),
        entity:entities (
          id,
          name,
          entity_type,
          attributes
        ),
        thesis:theses (
          id,
          thesis_type,
          statement,
          confidence,
          methodology
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('confidence', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (domainId) {
      query = query.eq('workspace_domain_id', domainId)
    }
    if (entityId) {
      query = query.eq('entity_id', entityId)
    }
    if (matchType) {
      query = query.eq('match_type', matchType)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data, count: data?.length || 0 })
  } catch (error) {
    console.error('Capital Flow API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}