import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { AiFillCheckCircle } from 'react-icons/ai'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { signupSchema, type SignupFormData } from '@/lib/schemas/signup'

type State = 'idle' | 'submitting' | 'error' | 'success'

export default function SignUpForm() {
  const [state, setState] = useState<State>('idle')

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      tel: '',
      age: '',
      membership: '',
    },
  })

  const onSubmit = async (data: SignupFormData) => {
    try {
      setState('submitting')
      await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        referrerPolicy: 'same-origin',
        body: JSON.stringify(data),
      })
      setState('success')
    } catch (error) {
      console.log(error)
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-4">
        <AiFillCheckCircle className="block w-20 h-20 text-blue-500" />
        <h3 className="text-xl">Success!</h3>
        <p className="text-center">
          Welcome to Pinnacle Fitness! We&apos;re excited to have you on board.
          Look out for an email from us soon containing details to get you up
          and running at Pinnacle.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-xl mb-4">Sign Up</h3>
      <p className="mb-8 text-lg">
        Fill in the form below and we&apos;ll be in touch to get you up and
        running at Pinnacle.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your first name"
                      disabled={state === 'submitting'}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your last name"
                      disabled={state === 'submitting'}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="xl:col-span-2">
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Please type your email address"
                      disabled={state === 'submitting'}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tel"
              render={({ field }) => (
                <FormItem className="xl:col-span-2">
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="Enter your telephone number"
                      disabled={state === 'submitting'}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem className="xl:col-span-2">
                  <FormLabel>Age</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={state === 'submitting'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your age range" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="18 - 24">18 - 24</SelectItem>
                      <SelectItem value="25 - 35">25 - 35</SelectItem>
                      <SelectItem value="36 - 49">36 - 49</SelectItem>
                      <SelectItem value="50+">50+</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="membership"
              render={({ field }) => (
                <FormItem className="xl:col-span-2">
                  <FormLabel>Membership Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={state === 'submitting'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Which type of membership are you interested in?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Hot Desk">
                        Hot Desk (Flexible desk usage @ TTD 1,000 per month)
                      </SelectItem>
                      <SelectItem value="Fixed Desk">
                        Fixed Desk (Your own dedicated desk @ TTD 1,500 per
                        month)
                      </SelectItem>
                      <SelectItem value="Private Office">
                        Private Office (4-person office @ TTD 7,500 per month)
                      </SelectItem>
                      <SelectItem value="Large Private Office">
                        Large Private Office (6-person office @ TTD 12,500 per
                        month)
                      </SelectItem>
                      <SelectItem value="Flexible Daily Rates">
                        Flexible Daily Rates (as low as TTD 50 per day, up to
                        TTD 100 per day)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <Button type="submit" disabled={state === 'submitting'}>
                {state === 'submitting' ? 'Submitting…' : 'Join The Waitlist'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
      {state === 'error' && (
        <Alert variant="destructive" className="mt-8">
          <AlertDescription>
            Uh oh… there was an error signing up. Please try again. If the error
            persists, please contact{' '}
            <a href="mailto:support@pinnaclefitness.app" className="underline">
              support@pinnaclefitness.app
            </a>
            .
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
