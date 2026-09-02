import { Sen, Unbounded } from 'next/font/google'

export const sen = Sen({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const unbounded = Unbounded({
  weight: ['300', '400', '700', '900'],
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})
