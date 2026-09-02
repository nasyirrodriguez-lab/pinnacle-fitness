// Hand-maintained subset of the Supabase schema. Generate the full version
// later with `supabase gen types typescript --project-id jcqhmbszfpnbioayfder
//   > src/utils/supabase/types.ts` once the CLI is set up.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          company: string | null
          role: 'member' | 'coach' | 'owner' | 'staff' | 'admin'
          archived: boolean
          nexudus_id: string | null
          pincode: string | null
          address: string | null
          city: string | null
          registered_at: string | null
          last_access_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string
          email: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      plans: {
        Row: {
          id: string
          name: string
          description: string | null
          price_cents: number
          currency: string
          billing_period: 'month' | 'year'
          features: unknown
          is_active: boolean
          display_order: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['plans']['Row']> & {
          id: string
          name: string
          price_cents: number
        }
        Update: Partial<Database['public']['Tables']['plans']['Row']>
      }
      passes: {
        Row: {
          id: string
          name: string
          description: string | null
          price_cents: number
          discounted_price_cents: number | null
          currency: string
          uses_total: number
          validity_days: number
          features: unknown
          is_active: boolean
          display_order: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['passes']['Row']> & {
          id: string
          name: string
          price_cents: number
          uses_total: number
        }
        Update: Partial<Database['public']['Tables']['passes']['Row']>
      }
      resources: {
        Row: {
          id: string
          name: string
          description: string | null
          kind: 'meeting-room' | 'conference-room' | 'event-space' | 'hot-desk'
          capacity: number
          price_per_hour_cents: number | null
          price_per_day_cents: number | null
          currency: string
          open_hour: number
          close_hour: number
          slot_minutes: number
          is_bookable: boolean
          requires_contact: boolean
          display_order: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['resources']['Row']> & {
          id: string
          name: string
          kind: Database['public']['Tables']['resources']['Row']['kind']
        }
        Update: Partial<Database['public']['Tables']['resources']['Row']>
      }
      pass_purchases: {
        Row: {
          id: string
          user_id: string
          pass_id: string
          uses_total: number
          uses_remaining: number
          expires_at: string
          purchased_at: string
          created_at: string
        }
        Insert: Partial<
          Database['public']['Tables']['pass_purchases']['Row']
        > & {
          user_id: string
          pass_id: string
          uses_total: number
          uses_remaining: number
          expires_at: string
        }
        Update: Partial<Database['public']['Tables']['pass_purchases']['Row']>
      }
      payments: {
        Row: {
          id: string
          user_id: string | null
          wam_payment_id: string | null
          amount_cents: number
          currency: string
          status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'cancelled'
          kind: 'subscription' | 'pass' | 'booking' | 'one_time'
          reference_id: string | null
          metadata: Record<string, unknown>
          failure_reason: string | null
          paid_at: string | null
          refunded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['payments']['Row']> & {
          amount_cents: number
          kind: Database['public']['Tables']['payments']['Row']['kind']
        }
        Update: Partial<Database['public']['Tables']['payments']['Row']>
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          status: 'active' | 'past_due' | 'paused' | 'cancelled'
          started_at: string
          current_period_start: string
          current_period_end: string
          cancelled_at: string | null
          paused_at: string | null
          pause_until: string | null
          wam_card_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<
          Database['public']['Tables']['subscriptions']['Row']
        > & {
          user_id: string
          plan_id: string
          current_period_end: string
        }
        Update: Partial<Database['public']['Tables']['subscriptions']['Row']>
      }
      bookings: {
        Row: {
          id: string
          user_id: string | null
          guest_email: string | null
          guest_name: string | null
          resource_id: string
          during: string
          status: 'held' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          price_cents: number
          payment_id: string | null
          pass_purchase_id: string | null
          notes: string | null
          checked_in_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['bookings']['Row']> & {
          resource_id: string
          during: string
          price_cents: number
        }
        Update: Partial<Database['public']['Tables']['bookings']['Row']>
      }
      check_ins: {
        Row: {
          id: string
          user_id: string
          scanned_at: string
          scanned_by: 'self' | 'guard' | 'tablet'
          location: string | null
          member_status: string | null
          allowed: boolean
          notes: string | null
        }
        Insert: Partial<Database['public']['Tables']['check_ins']['Row']> & {
          user_id: string
          allowed: boolean
        }
        Update: Partial<Database['public']['Tables']['check_ins']['Row']>
      }
      admin_notes: {
        Row: {
          id: string
          user_id: string
          author_id: string | null
          body: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['admin_notes']['Row']> & {
          user_id: string
          body: string
        }
        Update: Partial<Database['public']['Tables']['admin_notes']['Row']>
      }
      email_log: {
        Row: {
          id: string
          user_id: string | null
          to_email: string
          template: string
          subject: string
          resend_message_id: string | null
          status: 'sent' | 'failed' | 'queued'
          error: string | null
          sent_at: string
        }
        Insert: Partial<Database['public']['Tables']['email_log']['Row']> & {
          to_email: string
          template: string
          subject: string
        }
        Update: Partial<Database['public']['Tables']['email_log']['Row']>
      }
      unsubscribes: {
        Row: {
          email: string
          scope: 'broadcast' | 'all'
          opted_out_at: string
        }
        Insert: Partial<Database['public']['Tables']['unsubscribes']['Row']> & {
          email: string
        }
        Update: Partial<Database['public']['Tables']['unsubscribes']['Row']>
      }
    }
  }
}
