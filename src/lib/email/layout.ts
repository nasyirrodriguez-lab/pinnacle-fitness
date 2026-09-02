// Shared visual shell for transactional + broadcast emails. One place to
// keep the brand consistent: ground-black header with the Pinnacle
// wordmark, bronze card body, turf accents, ice type.
//
// Email clients are stricter than browsers: most strip <style> tags,
// ignore custom fonts, and constrain CSS. Everything is inlined; the
// Archivo stack falls back to Arial Black / Arial.

import { LOCATION, CONTACT, HOURS } from '@/config/location'

export const BRAND = {
  ground: '#0B0E0C',
  card: '#2B2925',
  raised: '#54504B',
  line: '#3D3A35',
  ice: '#E5E8E6',
  iceDim: '#B3B7B3',
  iceMute: '#8A8D89',
  turf: '#4EC95C',
  turfInk: '#06120A',
  turfDeep: '#1F6B2E',
  warn: '#E0A24A',
  bad: '#E2624F',
  // Legacy keys kept so older templates keep compiling.
  ink: '#E5E8E6',
  body: '#B3B7B3',
  paper: '#2B2925',
  bgSoft: '#0B0E0C',
  border: '#3D3A35',
  muted: '#8A8D89',
  navy: '#4EC95C',
  navyLight: '#B3B7B3',
  sulphur: '#4EC95C',
  cornbird: '#54504B',
  coral: '#E0A24A',
} as const

export const ADDRESS_LINE_1 = `${LOCATION.venue}, ${LOCATION.streetLine1}`
export const ADDRESS_LINE_2 = `${LOCATION.city}, Trinidad and Tobago`
export const SUPPORT_EMAIL = CONTACT.email

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? CONTACT.siteUrl

const FONT_DISPLAY = `'Archivo','Arial Black',Arial,Helvetica,sans-serif`
const FONT_BODY = `'Archivo',Helvetica,Arial,sans-serif`

const HEAD_STYLES = `
  body { margin:0; padding:0; background:${BRAND.ground}; -webkit-font-smoothing:antialiased; }
  table { border-collapse:collapse; }
  img { border:0; display:block; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { color:${BRAND.turf}; }
  .preheader { display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; mso-hide:all; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .px-pad { padding-left:24px !important; padding-right:24px !important; }
    .h-display { font-size:34px !important; line-height:1.02 !important; }
    .cta-btn { display:block !important; width:100% !important; box-sizing:border-box; }
    .stack-col { display:block !important; width:100% !important; }
    .stack-col + .stack-col { margin-top:16px; }
  }
`.trim()

const WORDMARK = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tbody><tr>
  <td valign="middle" style="padding-right:10px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 64 64" style="display:block;"><path fill="${BRAND.turf}" d="M32 14 6 56h52L32 14Zm0 12.5L47 50H17l15-23.5Z"/><path fill="${BRAND.turf}" d="M31 4h2v14h-2z"/><path fill="${BRAND.turf}" d="M33 5h13l-4 4 4 4H33z"/></svg>
  </td>
  <td valign="middle">
    <span style="font-family:${FONT_DISPLAY};font-weight:900;font-size:22px;letter-spacing:-0.02em;text-transform:uppercase;color:${BRAND.ice};line-height:1;">Pinnacle</span>
    <span style="font-family:${FONT_BODY};font-weight:600;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.iceDim};line-height:1;padding-left:6px;">Fitness</span>
  </td>
</tr></tbody></table>`

const MASTHEAD = `<tr>
  <td style="background:${BRAND.ground};padding:28px 40px 24px;" class="px-pad">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tbody><tr>
        <td align="left" valign="middle">${WORDMARK}</td>
        <td align="right" valign="middle">
          <span style="font-family:${FONT_BODY};font-weight:600;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${BRAND.iceMute};">
            THE&nbsp;PLAYGROUND&nbsp;·&nbsp;PORT&nbsp;OF&nbsp;SPAIN
          </span>
        </td>
      </tr></tbody>
    </table>
  </td>
</tr>
<tr><td style="height:4px;background:${BRAND.turf};line-height:4px;font-size:0;">&nbsp;</td></tr>`

const hoursHtml = HOURS.map(
  (h) => `${h.days}: ${h.open ? `${h.open}–${h.close}` : 'Closed'}`
).join('<br>')

const phonesHtml = CONTACT.phones
  .map(
    (p) =>
      `${p.name} <a href="tel:${p.tel}" style="color:${BRAND.ice};text-decoration:none;">${p.display}</a>`
  )
  .join('<br>')

const FOOTER = `<tr>
  <td style="background:${BRAND.ground};padding:32px 40px;border-top:1px solid ${BRAND.line};" class="px-pad">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tbody><tr>
        <td valign="top" class="stack-col" style="width:50%;">
          <p style="margin:0 0 8px;font-family:${FONT_BODY};font-weight:700;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.turf};line-height:1;">
            FIND&nbsp;US
          </p>
          <p style="margin:0 0 12px;font-family:${FONT_BODY};font-weight:600;font-size:14px;color:${BRAND.ice};line-height:1.45;">
            ${ADDRESS_LINE_1},<br>${ADDRESS_LINE_2}
          </p>
          <p style="margin:0;font-family:${FONT_BODY};font-size:12px;line-height:1.7;color:${BRAND.iceDim};">
            <a href="${SITE_URL}" style="color:${BRAND.ice};text-decoration:underline;text-underline-offset:3px;">${CONTACT.domain}</a><br>
            <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.ice};text-decoration:underline;text-underline-offset:3px;">${SUPPORT_EMAIL}</a>
          </p>
        </td>
        <td valign="top" class="stack-col" style="width:50%;" align="right">
          <p style="margin:0 0 8px;font-family:${FONT_BODY};font-weight:700;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.turf};line-height:1;">
            HOURS&nbsp;&amp;&nbsp;COACHES
          </p>
          <p style="margin:0 0 10px;font-family:${FONT_BODY};font-size:12px;line-height:1.7;color:${BRAND.iceDim};">${hoursHtml}</p>
          <p style="margin:0;font-family:${FONT_BODY};font-size:12px;line-height:1.7;color:${BRAND.iceDim};">${phonesHtml}</p>
        </td>
      </tr></tbody>
    </table>
  </td>
</tr>`

interface LayoutArgs {
  preheader?: string
  body: string
  unsubscribeFooter?: string
}

export function emailLayout({
  preheader,
  body,
  unsubscribeFooter,
}: LayoutArgs): string {
  const preheaderBlock = preheader
    ? `<div class="preheader">${escapeHtml(preheader)}</div>`
    : ''
  const unsubBlock = unsubscribeFooter
    ? `<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tbody><tr>
          <td style="padding:24px 40px 32px;text-align:center;" class="px-pad" align="center">
            ${unsubscribeFooter}
          </td>
        </tr></tbody>
      </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark light">
<title>Pinnacle Fitness</title>
<!--[if mso]>
<style>
  body, table, td, p, a, h1, h2, h3 { font-family: Arial, Helvetica, sans-serif !important; }
</style>
<![endif]-->
<style>${HEAD_STYLES}</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.ground};font-family:${FONT_BODY};color:${BRAND.ice};">
${preheaderBlock}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.ground};">
  <tbody><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${BRAND.card};border-radius:22px;overflow:hidden;">
      <tbody>
        ${MASTHEAD}
        <tr><td style="padding:44px 40px 8px;background:${BRAND.card};" class="px-pad">${body}</td></tr>
        <tr><td style="height:36px;line-height:36px;font-size:0;background:${BRAND.card};">&nbsp;</td></tr>
        ${FOOTER}
      </tbody>
    </table>
    ${unsubBlock}
  </td></tr></tbody>
</table>
</body></html>`
}

// =========================================================================
// Body building blocks
// =========================================================================

export function eyebrow(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-weight:700;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.turf};line-height:1;">
    ${escapeHtml(text)}
  </p>`
}

export function display(text: string): string {
  return `<h1 class="h-display" style="margin:0 0 22px;font-family:${FONT_DISPLAY};font-weight:900;font-size:40px;line-height:0.98;letter-spacing:-0.02em;text-transform:uppercase;color:${BRAND.ice};">
    ${text}
  </h1>`
}

export function heading(text: string): string {
  return `<h2 style="margin:0 0 14px;font-family:${FONT_DISPLAY};font-weight:800;font-size:22px;line-height:1.15;letter-spacing:-0.015em;color:${BRAND.ice};">
    ${escapeHtml(text)}
  </h2>`
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 18px;font-family:${FONT_BODY};font-size:16px;line-height:1.55;color:${BRAND.iceDim};">
    ${html}
  </p>`
}

// Big stat line — sessions left, amount due — in the Nike-style heavy italic.
export function stat(value: string, label: string): string {
  return `<p style="margin:0 0 18px;font-family:${FONT_DISPLAY};color:${BRAND.ice};">
    <span style="font-style:italic;font-weight:900;font-size:44px;line-height:1;letter-spacing:-0.03em;color:${BRAND.turf};">${escapeHtml(value)}</span>
    <span style="font-family:${FONT_BODY};font-weight:500;font-size:14px;color:${BRAND.iceDim};padding-left:8px;">${escapeHtml(label)}</span>
  </p>`
}

export function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 12px;">
    <tbody><tr><td>
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:54px;v-text-anchor:middle;width:260px;" arcsize="50%" strokecolor="${BRAND.turf}" strokeweight="1px" fillcolor="${BRAND.turf}">
        <w:anchorlock/>
        <center style="color:${BRAND.turfInk};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${escapeHtml(label)}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${href}" target="_blank" class="cta-btn" style="display:inline-block;background:${BRAND.turf};color:${BRAND.turfInk};font-family:${FONT_BODY};font-weight:700;font-size:15px;text-decoration:none;padding:17px 32px;border-radius:999px;line-height:1;">
        ${escapeHtml(label)}&nbsp;→
      </a>
      <!--<![endif]-->
    </td></tr></tbody>
  </table>`
}

// A coloured info block — used to highlight a key detail.
export function infoBlock(args: {
  eyebrow?: string
  title: string
  body?: string
  background?: 'cornbird' | 'sulphur' | 'navy' | 'turf' | 'bronze'
}): string {
  const palette = (() => {
    switch (args.background) {
      case 'sulphur':
      case 'navy':
      case 'turf':
        return { bg: BRAND.turf, fg: BRAND.turfInk, accent: BRAND.turfDeep }
      case 'cornbird':
      case 'bronze':
      default:
        return { bg: BRAND.raised, fg: BRAND.ice, accent: BRAND.turf }
    }
  })()

  const eyebrowHtml = args.eyebrow
    ? `<p style="margin:0 0 12px;font-family:${FONT_BODY};font-weight:700;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${palette.accent};line-height:1;">${escapeHtml(args.eyebrow)}</p>`
    : ''
  const bodyHtml = args.body
    ? `<p style="margin:8px 0 0;font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${palette.fg};opacity:0.9;">${args.body}</p>`
    : ''

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;background:${palette.bg};border-radius:18px;">
    <tbody><tr>
      <td style="padding:22px 26px;">
        ${eyebrowHtml}
        <p style="margin:0;font-family:${FONT_DISPLAY};font-weight:800;font-size:22px;line-height:1.15;letter-spacing:-0.01em;color:${palette.fg};">
          ${args.title}
        </p>
        ${bodyHtml}
      </td>
    </tr></tbody>
  </table>`
}

export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tbody><tr><td style="border-top:1px solid ${BRAND.line};line-height:1px;font-size:0;">&nbsp;</td></tr></tbody></table>`
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
