export type PlanType = 'basic' | 'premium' | 'elite'

export interface Member {
  id: string
  user_id: string
  name: string
  email: string
  plan_type: PlanType
  join_date: string
  member_id: string
  role: 'member' | 'admin'
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
