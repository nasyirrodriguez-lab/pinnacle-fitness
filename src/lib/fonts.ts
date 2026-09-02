import { Archivo } from 'next/font/google'

// One family for everything. Archivo's variable width axis (62–125) gives
// the wide sporty headings and the tight body from a single download;
// the italic face is what the stat numbers use (see `font-stat`).
export const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  style: ['normal', 'italic'],
  variable: '--font-archivo',
  display: 'swap',
})
