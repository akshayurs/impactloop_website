import { SITE_URL } from '@/config/site'
import { CATEGORY_LABELS, type OptOutCategory } from '../prefs'

export type RenderedEmail = { subject: string; html: string }

export type EmailCta = { label: string; url: string }

const ACCENT = '#e8500a'
const ACCENT_STRONG = '#c74208'
const BG = '#f6f2ea'
const CARD = '#fcfaf5'
const FG = '#17140f'
const MUTED = '#6e675c'
const LINE = '#e0d8c9'

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${FG};">${esc(p.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

export function bulletList(items: string[]): string {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="width:22px;vertical-align:top;padding:6px 0;">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${ACCENT};"></span>
        </td>
        <td style="padding:2px 0;font-size:15px;line-height:1.6;color:${FG};">${item}</td>
      </tr>`,
    )
    .join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${rows}</table>`
}

export function statBox(rows: Array<{ label: string; value: string }>): string {
  const cells = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 16px;border-top:1px solid ${LINE};font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">${esc(r.label)}</td>
        <td align="right" style="padding:10px 16px;border-top:1px solid ${LINE};font-size:15px;font-weight:700;color:${FG};">${esc(r.value)}</td>
      </tr>`,
    )
    .join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="margin:8px 0 20px;background:${BG};border:1px solid ${LINE};border-radius:12px;border-collapse:separate;overflow:hidden;">
      <tr><td colspan="2" style="height:0;padding:0;border:0;"></td></tr>
      ${cells}
    </table>`
}

export function ctaButton(cta: EmailCta): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
      <tr>
        <td style="border-radius:999px;background:${ACCENT};">
          <a href="${esc(cta.url)}" target="_blank"
            style="display:inline-block;padding:13px 32px;border-radius:999px;background:${ACCENT};color:#fffdf8;font-size:15px;font-weight:600;text-decoration:none;">
            ${esc(cta.label)} &rarr;
          </a>
        </td>
      </tr>
    </table>`
}

export type BaseEmailInput = {
  subject: string
  /** Hidden inbox preview line. */
  preheader: string
  /** Small uppercase mono label above the heading, e.g. 'CRACKLOOP · WELCOME'. */
  kicker: string
  heading: string
  /** Pre-rendered inner HTML (use paragraphs/bulletList/statBox/ctaButton helpers). */
  bodyHtml: string
  /** When set, footer includes a one-click unsubscribe link for this category. */
  unsubscribe?: { url: string; category: OptOutCategory }
}

export function renderBaseEmail(input: BaseEmailInput): RenderedEmail {
  const year = new Date().getFullYear()
  const unsubBlock = input.unsubscribe
    ? `You receive this because you have an Impact Loop account. Don&#39;t want emails about ${esc(CATEGORY_LABELS[input.unsubscribe.category])}?
       <a href="${esc(input.unsubscribe.url)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.`
    : `You receive this because you have an Impact Loop account. This is a service email about your account.`
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>${esc(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(input.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Masthead -->
          <tr>
            <td style="padding:0 8px 18px;">
              <a href="${esc(SITE_URL)}" target="_blank" style="text-decoration:none;">
                <span style="font-size:19px;font-weight:800;letter-spacing:-0.02em;color:${FG};">Impact&nbsp;Loop</span>
                <span style="display:inline-block;width:9px;height:9px;margin-left:5px;border-radius:50%;background:${ACCENT};"></span>
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${CARD};border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="height:5px;background:linear-gradient(90deg,${ACCENT},${ACCENT_STRONG});font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:32px 36px 28px;">
                    <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${ACCENT};font-weight:700;">${esc(input.kicker)}</p>
                    <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;letter-spacing:-0.02em;color:${FG};">${esc(input.heading)}</h1>
                    ${input.bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 8px 0;">
              <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${MUTED};">${unsubBlock}</p>
              <p style="margin:0;font-size:12px;color:${MUTED};">&copy; ${year} Impact Loop &middot; <a href="${esc(SITE_URL)}" style="color:${MUTED};text-decoration:underline;">${esc(SITE_URL.replace(/^https?:\/\//, ''))}</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  return { subject: input.subject, html }
}
