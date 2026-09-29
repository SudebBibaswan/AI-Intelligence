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
    const { signal_id, decision, request_id } = body

    if (!signal_id || !decision || !request_id) {
      return NextResponse.json({ error: 'signal_id, decision, request_id required' }, { status: 400 })
    }

    if (!['accepted', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be accepted or rejected' }, { status: 400 })
    }

    // Get signal
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select('*')
      .eq('id', signal_id)
      .single()

    if (signalError || !signal) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
    }

    // Check workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', signal.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin', 'member'].includes(membership.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Check if already reviewed
    const { data: existingReview } = await supabase
      .from('signal_reviews')
      .select('id')
      .eq('request_id', request_id)
      .single()

    if (existingReview) {
      return NextResponse.json({ 
        review_id: existingReview.id, 
        signal_id, 
        status: signal.status, 
        replayed: true 
      })
    }

    // Update signal status
    const newStatus = decision === 'accepted' ? 'accepted' : 'rejected'
    
    const { error: updateError } = await supabase
      .from('signals')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', signal_id)

    if (updateError) throw updateError

    // Create review record
    const { data: review, error: reviewError } = await supabase
      .from('signal_reviews')
      .insert({
        workspace_id: signal.workspace_id,
        signal_id,
        reviewer_id: user.id,
        decision: newStatus,
        previous_status: signal.status,
        reason: null,
        request_id
      })
      .select()
      .single()

    if (reviewError) throw reviewError

    // If accepted, auto-trigger observation engine check (optional)
    if (decision === 'accepted') {
      // Could trigger observation engine via n8n webhook here
      // For now, just log
      console.log(`Signal ${signal_id} accepted, observation engine will pick up on next cron`)
    }

    // Audit log
    await supabase
      .from('audit_log')
      .insert({
        workspace_id: signal.workspace_id,
        actor_type: 'user',
        actor_id: user.id,
        action: 'signal.reviewed',
        target_type: 'signal',
        target_id: signal_id,
        request_id,
        metadata: {
          previous_status: signal.status,
          decision: newStatus
        }
      })

    return NextResponse.json({
      review_id: review.id,
      signal_id,
      status: newStatus,
      replayed: false
    })
  } catch (error) {
    console.error('Signal review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}