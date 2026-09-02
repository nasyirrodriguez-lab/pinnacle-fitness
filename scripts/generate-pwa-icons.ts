/**
 * Regenerates the PWA + Apple home-screen icons.
 *
 * Bakes the asterisk Worx mark from src/components/logo/icon.tsx onto a
 * sulphur-yellow background with the teal mark colour. Writes:
 *
 *   public/android-chrome-192x192.png
 *   public/android-chrome-512x512.png
 *   public/apple-touch-icon.png       (180×180)
 *   public/maskable-512x512.png       (with padding so Android's
 *                                      maskable safe-zone clips correctly)
 *
 * Run with:
 *   nvm use 22
 *   npx tsx scripts/generate-pwa-icons.ts
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const BG = '#D9E01F'
const FG = '#027B60'

// Single-path glyph copied from src/components/logo/icon.tsx. ViewBox 0 0 300 300.
const GLYPH_PATH =
  'M290 76.68 241.47 27.8l-56.43 56.07V27.79h-70.08v56.07L58.88 27.79 10 76.68 83.68 150 10 223.32l48.88 48.88 56.07-56.07v56.07h70.09v-56.07l56.43 56.07L290 223.32l-73.33-73.33L290 76.67ZM149.45 201.42l-49.61-50.35 49.61-49.61 50.35 49.61-50.35 50.35Z'

// Produce an SVG of `size`×`size` with the glyph scaled to fill `glyphPct`
// of the canvas, centered, on a solid background. Returns the SVG string.
function makeSvg(size: number, glyphPct: number): string {
  // Glyph is in a 300×300 viewBox. Scale + translate it to fit the target.
  const glyphSize = size * glyphPct
  const offset = (size - glyphSize) / 2
  const scale = glyphSize / 300
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="${GLYPH_PATH}" fill="${FG}"/>
  </g>
</svg>`
}

async function renderPng(svg: string, outPath: string): Promise<void> {
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer()
  await writeFile(outPath, buffer)
  console.log(`  wrote ${outPath}`)
}

async function main() {
  const publicDir = join(process.cwd(), 'public')

  // "any" icons — glyph fills about 70% of the canvas; OS icons get rounded
  // corners by the launcher.
  const standardGlyphPct = 0.7
  // Maskable icon — Android clips to the centered 80% safe zone, so we
  // shrink the glyph to ~60% to make sure nothing important gets cropped.
  const maskableGlyphPct = 0.58

  console.log('Generating PWA icons:')
  await renderPng(
    makeSvg(192, standardGlyphPct),
    join(publicDir, 'android-chrome-192x192.png')
  )
  await renderPng(
    makeSvg(512, standardGlyphPct),
    join(publicDir, 'android-chrome-512x512.png')
  )
  await renderPng(
    makeSvg(180, standardGlyphPct),
    join(publicDir, 'apple-touch-icon.png')
  )
  await renderPng(
    makeSvg(512, maskableGlyphPct),
    join(publicDir, 'maskable-512x512.png')
  )

  // Favicons inherit the same look. Browser tabs are small; bump the glyph
  // a bit so it stays readable.
  await renderPng(makeSvg(32, 0.78), join(publicDir, 'favicon-32x32.png'))
  await renderPng(makeSvg(16, 0.82), join(publicDir, 'favicon-16x16.png'))

  console.log('done.')
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})
