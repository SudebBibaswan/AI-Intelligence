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
    const status = searchParams.get('status') || 'accepted'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    // Fetch signals first
    let signalsQuery = supabase
      .from('signals')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', status)
      .order('importance_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (domainId) {
      signalsQuery = signalsQuery.eq('workspace_domain_id', domainId)
    }

    const { data: signals, error: signalsError } = await signalsQuery

    if (signalsError) throw signalsError
    if (!signals || signals.length === 0) {
      return NextResponse.json({ data: [], count: 0 })
    }

    const signalIds = signals.map(s => s.id)

    // Fetch signal_evidence with evidence and sources in separate queries
    const { data: signalEvidenceLinks, error: seError } = await supabase
      .from('signal_evidence')
      .select('signal_id, evidence_id, role, weight')
      .in('signal_id', signalIds)
      .eq('workspace_id', workspaceId)

    if (seError) throw seError

    // Fetch evidence for these signals
    const evidenceIds = [...new Set(signalEvidenceLinks?.map(se => se.evidence_id) || [])]
    let evidenceMap = new Map()
    
    if (evidenceIds.length > 0) {
      const { data: evidenceData, error: evError } = await supabase
        .from('evidence')
        .select(`
          id,
          source_id,
          claim_text,
          excerpt,
          confidence,
          verification_status,
          evidence_type,
          source:sources (id, title, publisher, canonical_url)
        `)
        .in('id', evidenceIds)
        .eq('workspace_id', workspaceId)

      if (evError) throw evError
      evidenceMap = new Map(evidenceData?.map(e => [e.id, e]) || [])
    }

    // Fetch signal_entities
    const { data: signalEntities, error: sentError } = await supabase
      .from('signal_entities')
      // Wikidata IDs are stored inside entities.external_ids, not as a column.
      // Selecting the nonexistent column causes Supabase to reject the entire
      // signals request, so only request fields present in the base table.
      .select('signal_id, entity_id, role, entity:entities (id, name, entity_type, canonical_url, attributes, resolution_status, external_ids)')
      .in('signal_id', signalIds)
      .eq('workspace_id', workspaceId)

    if (sentError) throw sentError

    // Combine data
    const signalsWithRelations = signals.map(signal => {
      const evidenceLinks = signalEvidenceLinks?.filter(se => se.signal_id === signal.id) || []
      const entities = signalEntities?.filter(se => se.signal_id === signal.id) || []
      
      return {
        ...signal,
        signal_evidence: evidenceLinks.map(link => ({
          evidence_id: link.evidence_id,
          role: link.role,
          weight: link.weight,
          evidence: evidenceMap.get(link.evidence_id) || null
        })).filter(se => se.evidence !== null),
        signal_entities: entities
      }
    })

    return NextResponse.json({ data: signalsWithRelations, count: signalsWithRelations.length })
  } catch (error) {
    console.error('Signals API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
