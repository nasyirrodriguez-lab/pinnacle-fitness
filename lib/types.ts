export type PlanType = 'basic' | 'premium' | 'elite'
export type MemberStatus = 'active' | 'suspended'
export type CheckInMethod = 'qr' | 'manual' | 'app'
export type PaymentStatus = 'paid' | 'failed' | 'refunded'

export interface Member {
  id: string
  user_id: string
  name: string
  email: string
  plan_type: PlanType
  join_date: string
  member_code: string
  role: 'member' | 'admin'
  status: MemberStatus
  stripe_customer_id: string | null
  current_period_end: string | null   // ISO date — when the current billing period ends
  created_at: string
}

export interface CheckIn {
  id: string
  member_id: string          // FK → members.id (uuid)
  member_code: string        // the PF-XXXXX code (denormalised for speed)
  member_name: string
  checked_in_at: string
  method: CheckInMethod
}

export interface Payment {
  id: string
  member_id: string          // FK → members.id (uuid)
  member_name: string
  plan_type: PlanType
  amount: number             // in dollars (e.g. 29.00)
  paid_at: string
  status: PaymentStatus
  payment_intent_id: string | null
  stripe_invoice_id: string | null
  invoice_url: string | null
}

export interface Plan {
  id: string
  name: string
  slug: PlanType
  price: number
  duration: string
  features: string[]
  highlight: boolean
}

export interface Coach {
  id: string
  name: string
  photo_url: string
  specialties: string[]
  bio: string
  order: number
}

// ---- admin dashboard aggregates ----
export interface OverviewStats {
  totalMembers: number
  activeMembers: number
  suspendedMembers: number
  revenueThisMonth: number
  checkInsToday: number
  planBreakdown: Record<PlanType, number>
}

export interface GymClass {
  id: string
  name: string
  coach_name: string
  day_of_week: string   // "Monday", "Tuesday", etc.
  start_time: string    // "HH:MM:SS"
  duration_min: number
  location: string
  max_spots: number
  created_at: string
}

export interface Booking {
  id: string
  class_id: string
  member_id: string
  booked_at: string
  status: 'confirmed' | 'cancelled'
}

export interface MonthlyRevenue {
  month: string   // "Jan 2025"
  revenue: number
  count: number
}
