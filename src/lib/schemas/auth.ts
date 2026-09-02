import { z } from 'zod'

export const requestLinkSchema = z.object({
  email: z.string().email('Enter a valid email'),
  next: z.string().optional(),
})
export type RequestLinkInput = z.infer<typeof requestLinkSchema>
