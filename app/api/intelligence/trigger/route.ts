import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678'
const N8N_API_KEY = process.env.N8N_API_KEY

interface TriggerRequest {
  workspace_id: string
  workspace_domain_id: string
  trigger_type: 'manual' | 'schedule' | 'validation' | 'backfill'
  engine?: 'research' | 'observation' | 'signal' | 'hypothesis' | 'pattern' | 'quality' | 'thesis' | 'validation' | 'capital_flow' | 'evidence_review' | 'all'
  config?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: TriggerRequest = await request.json()
    const { workspace_id, workspace_domain_id, trigger_type, engine = 'all', config = {} } = body

    if (!workspace_id || !workspace_domain_id) {
      return NextResponse.json({ error: 'workspace_id and workspace_domain_id required' }, { status: 400 })
    }

    // Verify user owns this workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspace_id)
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Create research run record
    const idempotencyKey = `${workspace_id}-${workspace_domain_id}-${trigger_type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    
    const { data: researchRun, error: runError } = await supabase
      .from('research_runs')
      .insert({
        workspace_id,
        workspace_domain_id,
        trigger_type,
        idempotency_key: idempotencyKey,
        contract_version: '1.0.0',
        config_snapshot: config,
        requested_by: user.id,
        status: 'queued',
      })
      .select()
      .single()

    if (runError) throw runError

    // Trigger n8n workflow(s)
    const workflowMap: Record<string, string> = {
      research: 'Research Engine',
      observation: 'Verified Observation Engine',
      signal: 'Verified Signal Engine',
      hypothesis: 'Verified Hypothesis Engine',
      pattern: 'Verified Pattern Engine',
      quality: 'Verified Quality Engine',
      thesis: 'Verified Thesis Engine',
      validation: 'Verified Validation Engine',
      capital_flow: 'Verified Capital Flow Engine',
      evidence_review: 'Verified Evidence Review Engine',
    }

    const enginesToRun = engine === 'all' ? Object.keys(workflowMap) : [engine]
    const results = []

    for (const eng of enginesToRun) {
      const workflowName = workflowMap[eng]
      if (!workflowName) continue

      try {
        // Call n8n webhook to trigger workflow
        const webhookUrl = `${N8N_BASE_URL}/webhook/${workflowName.toLowerCase().replace(/\s+/g, '-')}-trigger`
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(N8N_API_KEY && { 'Authorization': `Bearer ${N8N_API_KEY}` }),
          },
          body: JSON.stringify({
            workspace_id,
            workspace_domain_id,
            research_run_id: researchRun.id,
            trigger_type,
            engine: eng,
            config,
          }),
        })

        if (response.ok) {
          results.push({ engine: eng, status: 'triggered', workflow: workflowName })
        } else {
          results.push({ engine: eng, status: 'failed', error: `HTTP ${response.status}`, workflow: workflowName })
        }
      } catch (err) {
        results.push({ engine: eng, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error', workflow: workflowName })
      }
    }

    // Update research run with trigger results
    await supabase
      .from('research_runs')
      .update({
        status: results.some(r => r.status === 'triggered') ? 'discovering' : 'failed',
        metrics: { trigger_results: results },
        started_at: new Date().toISOString(),
      })
      .eq('id', researchRun.id)

    return NextResponse.json({ 
      research_run_id: researchRun.id,
      results,
      message: `Triggered ${results.filter(r => r.status === 'triggered').length} of ${enginesToRun.length} engines`
    })
  } catch (error) {
    console.error('Trigger research run error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    // Verify user owns this workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('research_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Get research runs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}