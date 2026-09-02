import { z } from 'zod'

export const EXPERIENCE_BRACKETS = [
  { value: 'under_6m', label: 'Under 6 months' },
  { value: '6_24m', label: '6–24 months' },
  { value: '2y_plus', label: '2+ years' },
] as const

export const applySchema = z.object({
  fullName: z.string().trim().min(2, 'Your name, please').max(120),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().min(7, 'Enter a phone number').max(40),
  experienceBracket: z.enum(['under_6m', '6_24m', '2y_plus'], {
    message: 'Pick how long you have been training',
  }),
  trainingNow: z
    .string()
    .trim()
    .min(10, 'Tell us a little about your training')
    .max(2000),
  goal: z.string().trim().min(3, 'What are you working toward?').max(1000),
  heardFrom: z.string().trim().max(200).optional(),
  referredBy: z.string().trim().max(120).optional(),
  planInterest: z.string().trim().max(60).optional(),
  codeAccepted: z.literal(true, {
    message: 'You need to agree to the Member Code',
  }),
  // Honeypot — bots fill it, people never see it.
  company: z.string().max(0).optional(),
})

export type ApplyFormData = z.infer<typeof applySchema>
