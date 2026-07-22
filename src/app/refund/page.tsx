import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Refund & Cancellation',
  description: 'How subscription cancellations and refunds work for Impact Loop web purchases.',
}

export default function RefundPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="kicker">Legal</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">Refund &amp; Cancellation Policy</h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-muted">Last updated: 16 July 2026</p>

      <p className="mt-8 text-muted">
        This policy applies to purchases made on the Impact Loop website (the &ldquo;Site&rdquo;) through our payment
        processor, Razorpay — subscriptions and one-time (lifetime) unlocks for apps such as CrackLoop. Purchases made
        inside our mobile apps through Google Play are governed by Google Play&rsquo;s own refund policy, not this one.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">1. Overview</h2>
      <p className="mt-3 text-muted">
        Our products are digital services delivered instantly. Because access is granted immediately on payment, web
        purchases are generally non-refundable. That said, we review every refund request individually and in good
        faith — see &ldquo;Requesting a refund&rdquo; below. Nothing in this policy limits any rights you have under
        applicable Indian consumer-protection law.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        2. Cancelling a subscription
      </h2>
      <p className="mt-3 text-muted">
        You can cancel a recurring subscription at any time from your{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="/account">
          account page
        </a>
        . When you cancel, your plan stays active until the end of the period you have already paid for, and it will not
        renew or bill you again. We do not provide pro-rated refunds for the unused part of a billing period unless
        required by law.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        3. Lifetime purchases
      </h2>
      <p className="mt-3 text-muted">
        A lifetime unlock is a single, one-time payment — there is no recurring charge and nothing to cancel. If you
        believe a lifetime purchase was made in error, contact us and we will look into it case by case.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        4. Requesting a refund
      </h2>
      <p className="mt-3 text-muted">
        Refunds are handled on a case-by-case basis over email. Write to us at{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="mailto:impactloopapps@gmail.com">
          impactloopapps@gmail.com
        </a>{' '}
        with the account email you purchased with and, if you have it, the payment or order reference. Please reach out
        within a reasonable time of the charge. We aim to respond within 2–3 business days.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        5. Failed or duplicate payments
      </h2>
      <p className="mt-3 text-muted">
        If you were charged but did not receive access, or you were charged more than once for the same purchase,
        contact us with the details and we will reconcile it and issue a full refund for the erroneous charge.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        6. How approved refunds are issued
      </h2>
      <p className="mt-3 text-muted">
        Approved refunds are returned to your original payment method through Razorpay. Depending on your bank or card
        issuer, it can take up to 5–10 business days for the amount to appear on your statement after we process it.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">7. Contact</h2>
      <p className="mt-3 text-muted">
        Questions about a charge or a refund? Reach us any time at{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="mailto:impactloopapps@gmail.com">
          impactloopapps@gmail.com
        </a>{' '}
        or via our{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="/contact">
          contact page
        </a>
        .
      </p>
    </div>
  )
}
