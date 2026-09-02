import { z } from 'zod'

export const referralSchema = z.object({
  friendName: z.string().min(1, 'Their name is required').max(120),
  friendEmail: z.string().email('Enter a valid email'),
  note: z.string().max(1000).optional(),
})

export type ReferralInput = z.infer<typeof referralSchema>
