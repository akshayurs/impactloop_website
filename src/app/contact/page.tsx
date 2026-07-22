import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Impact Loop — support for accounts, billing, and the partner program.',
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="kicker">Support</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">Contact us</h1>

      <p className="mt-8 text-muted">
        Impact Loop is an indie app studio operated by an individual (sole proprietor) based in India. We&rsquo;re happy
        to help with your account, a payment, a subscription, or the partner program.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">Email</h2>
      <p className="mt-3 text-muted">
        The fastest way to reach us is email:{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="mailto:impactloopapps@gmail.com">
          impactloopapps@gmail.com
        </a>
        . We typically reply within 2–3 business days.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        What to include
      </h2>
      <p className="mt-3 text-muted">To help us resolve your query quickly, please include where relevant:</p>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>The email address on your Impact Loop account.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>For billing questions, the payment or order reference (if you have it).</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>A short description of the issue and which app it relates to.</span>
        </li>
      </ul>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">Common topics</h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            Billing, cancellations, and refunds — see the{' '}
            <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="/refund">
              Refund &amp; Cancellation policy
            </a>
            .
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            Questions about plans and payments — see the{' '}
            <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="/faq">
              FAQ
            </a>
            .
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            How we handle your data — see the{' '}
            <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="/privacy">
              Privacy Policy
            </a>
            .
          </span>
        </li>
      </ul>
    </div>
  )
}
