import { z } from 'zod'

export const inquirySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  interests: z.array(z.string()).min(1, 'Please select at least one interest'),
  message: z.string().optional(),
})

export type InquiryFormData = z.infer<typeof inquirySchema>
