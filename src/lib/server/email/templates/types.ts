import type { OptOutCategory } from '../prefs'
import type { EmailCta, RenderedEmail } from './base'

export type Unsubscribe = { url: string; category: OptOutCategory }

export type AppEmailTemplates = {
  welcome: (input: { name: string | null; planLabel: string; unsubscribe?: Unsubscribe }) => RenderedEmail
  expiryReminder: (input: {
    name: string | null
    planLabel: string
    expiryDate: string
    autoRenewing: boolean
    unsubscribe?: Unsubscribe
  }) => RenderedEmail
  announcement: (input: { subject: string; message: string; cta?: EmailCta | null; unsubscribe?: Unsubscribe }) => RenderedEmail
}
