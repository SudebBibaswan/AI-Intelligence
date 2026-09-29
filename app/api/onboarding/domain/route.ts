import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { domain_key } = await request.json()
    
    if (!domain_key) {
      return NextResponse.json({ error: 'domain_key required' }, { status: 400 })
    }

    // Get the domain ID from the key
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select('id')
      .eq('key', domain_key)
      .single()

    if (domainError || !domain) {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
    }

    // Get user's workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Create or update workspace_domain
    const { data: workspaceDomain, error: wdError } = await supabase
      .from('workspace_domains')
      .upsert({
        workspace_id: workspaceMember.workspace_id,
        domain_id: domain.id,
        name: domain_key,
        status: 'active',
        created_by: user.id,
      }, {
        onConflict: 'workspace_id,domain_id'
      })
      .select()
      .single()

    if (wdError) throw wdError

    // Update profile onboarding_state
    await supabase
      .from('profiles')
      .update({ onboarding_state: 'in_progress' })
      .eq('user_id', user.id)

    return NextResponse.json({ 
      workspace_domain_id: workspaceDomain.id,
      workspace_id: workspaceMember.workspace_id 
    })
  } catch (error) {
    console.error('Onboarding domain error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}