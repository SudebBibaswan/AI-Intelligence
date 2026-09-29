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
    const thesisType = searchParams.get('thesis_type')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    let query = supabase
      .from('theses')
      .select(`
        *,
        thesis_evidence (
          evidence_id,
          role,
          weight,
          evidence:evidence_id (
            id,
            claim_text,
            excerpt,
            confidence,
            source:sources (
              id,
              title,
              publisher,
              canonical_url
            )
          )
        ),
        entity:entities (
          id,
          name,
          entity_type,
          attributes
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('confidence', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (domainId) {
      query = query.eq('workspace_domain_id', domainId)
    }
    if (thesisType) {
      query = query.eq('thesis_type', thesisType)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data, count: data?.length || 0 })
  } catch (error) {
    console.error('Theses API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}