import { z } from 'zod'

export const bookingHoldSchema = z.object({
  slotId: z.string().min(1),
  name: z.string().min(1, 'Your name is required').max(120),
  email: z.string().email('Enter a valid email'),
})

export type BookingHoldInput = z.infer<typeof bookingHoldSchema>
