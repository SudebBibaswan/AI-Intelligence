import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workflow, workspace_id, payload } = body

    if (!workflow || !workspace_id) {
      return NextResponse.json({ error: 'workflow and workspace_id required' }, { status: 400 })
    }

    // Map workflow name to n8n webhook URL
    const webhookMap: Record<string, string> = {
      'research-engine-v2': process.env.N8N_WEBHOOK_RESEARCH_ENGINE || '',
      'signal-engine': process.env.N8N_WEBHOOK_SIGNAL || '',
      'observation-engine': process.env.N8N_WEBHOOK_OBSERVATION || '',
      'pattern-engine': process.env.N8N_WEBHOOK_PATTERN || '',
      'thesis-engine': process.env.N8N_WEBHOOK_THESIS || '',
      'capital-flow-engine': process.env.N8N_WEBHOOK_CAPITAL || '',
      'hypothesis-engine': process.env.N8N_WEBHOOK_HYPOTHESIS || '',
      'validation-engine': process.env.N8N_WEBHOOK_VALIDATION || '',
      'quality-engine': process.env.N8N_WEBHOOK_QUALITY || '',
      'evidence-review-engine': process.env.N8N_WEBHOOK_EVIDENCE_REVIEW || '',
    }

    const webhookUrl = webhookMap[workflow]
    if (!webhookUrl) {
      return NextResponse.json({ error: `Unknown workflow: ${workflow}` }, { status: 400 })
    }

    // Create a research run record first
    const runId = crypto.randomUUID()
    const requestId = crypto.randomUUID()
    
    const { error: runError } = await supabase
      .from('research_runs')
      .insert({
        id: runId,
        workspace_id: workspace_id,
        workspace_domain_id: payload?.workspace_domain_id,
        trigger_type: 'manual',
        status: 'queued',
        request_id: requestId,
        metrics: { triggered_by: user.id, payload },
        created_at: new Date().toISOString()
      })

    if (runError) throw runError

    // Trigger n8n webhook
    const webhookPayload = {
      run_id: runId,
      request_id: requestId,
      workspace_id: workspace_id,
      workspace_domain_id: payload?.workspace_domain_id,
      trigger_type: 'manual',
      ...payload
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.N8N_WEBHOOK_SECRET}`
      },
      body: JSON.stringify(webhookPayload)
    })

    if (!response.ok) {
      // Update run status to failed
      await supabase
        .from('research_runs')
        .update({ status: 'failed', error_summary: { webhook_error: response.statusText } })
        .eq('id', runId)
      
      return NextResponse.json({ error: 'Failed to trigger n8n workflow' }, { status: 500 })
    }

    return NextResponse.json({ 
      run_id: runId, 
      request_id: requestId, 
      status: 'triggered',
      workflow 
    })
  } catch (error) {
    console.error('n8n trigger error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}