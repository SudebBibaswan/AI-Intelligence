import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Try to find entity by name (slug) or ID
    const { data: entity, error } = await supabase
      .from('entities')
      .select(`
        *,
        relationships!relationships_from_entity_id_fkey (
          id,
          relationship_type,
          direction,
          confidence,
          valid_from,
          valid_to,
          to_entity:to_entity_id (id, name, entity_type, canonical_url)
        ),
        relationships!relationships_to_entity_id_fkey (
          id,
          relationship_type,
          direction,
          confidence,
          valid_from,
          valid_to,
          from_entity:from_entity_id (id, name, entity_type, canonical_url)
        ),
        capital_directory:capital_directory_entries!capital_directory_entries_entity_id_fkey (*)
      `)
      .eq('workspace_id', workspaceMember.workspace_id)
      .or(`id.eq.${id},normalized_name.ilike.%${id}%`)
      .single()

    if (error || !entity) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Get funding rounds (from capital_flow or evidence)
    const { data: capitalFlows } = await supabase
      .from('capital_flow_mappings')
      .select(`
        *,
        pattern:patterns (*),
        thesis:theses (*)
      `)
      .eq('workspace_id', workspaceMember.workspace_id)
      .eq('entity_id', entity.id)
      .order('created_at', { ascending: false })

    // Get evidence for this entity
    const { data: evidence } = await supabase
      .from('evidence_entities')
      .select(`
        evidence:evidence_id (
          id,
          claim_text,
          excerpt,
          confidence,
          verification_status,
          source:sources (id, title, publisher, canonical_url, published_at)
        )
      `)
      .eq('workspace_id', workspaceMember.workspace_id)
      .eq('entity_id', entity.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ entity, capitalFlows, evidence })
  } catch (error) {
    console.error('Get company error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}