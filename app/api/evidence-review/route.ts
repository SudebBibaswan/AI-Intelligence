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
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    let query = supabase
      .from('v_evidence_review_queue')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (domainId) {
      query = query.eq('workspace_domain_id', domainId)
    }
    if (status) {
      query = query.eq('verification_status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data, count: data?.length || 0 })
  } catch (error) {
    console.error('Evidence Review API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { evidence_id, decision, reason, request_id } = body

    if (!evidence_id || !decision || !request_id) {
      return NextResponse.json({ error: 'evidence_id, decision, request_id required' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('review_research_evidence', {
      p_evidence_id: evidence_id,
      p_decision: decision,
      p_reason: reason || null,
      p_request_id: request_id
    })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Evidence Review POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}