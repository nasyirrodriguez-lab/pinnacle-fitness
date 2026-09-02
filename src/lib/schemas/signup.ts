import { z } from 'zod'

export const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  tel: z.string().optional(),
  age: z.string().min(1, 'Please select your age range'),
  membership: z.string().min(1, 'Please select a membership type'),
})

export type SignupFormData = z.infer<typeof signupSchema>
