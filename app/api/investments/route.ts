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
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    let query = supabase
      .from('investments')
      .select(`
        *,
        company:companies (
          id,
          name,
          ai_domain
        ),
        investors:investment_investors (
          investor:investors (
            id,
            name,
            investor_type
          )
        ),
        evidence:investment_evidence (
          evidence:evidence (
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
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('announced_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (domainId) {
      query = query.eq('companies.ai_domain', domainId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data, count: data?.length || 0 })
  } catch (error) {
    console.error('Investments API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}