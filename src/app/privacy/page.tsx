import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How Impact Loop handles your data across the website and mobile apps.',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="kicker">Legal</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">Privacy Policy</h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-muted">Last updated: 16 July 2026</p>

      <p className="mt-8 text-muted">
        Impact Loop is an indie app studio operated by an individual (sole proprietor) based in India
        (&ldquo;Impact Loop&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what data we handle across
        the Impact Loop website (the &ldquo;Site&rdquo;) and our mobile applications, including CrackLoop (together, the
        &ldquo;Services&rdquo;). Our mobile apps are built to keep most data on your device; the website, because it
        handles accounts and payments, necessarily processes some personal data, as described below.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">1. Overview</h2>
      <p className="mt-3 text-muted">
        You can browse the Site without signing in. To buy a subscription or lifetime unlock, or to join our partner
        program, you sign in with Google and we process the limited data needed to provide those features. We keep data
        collection to what is necessary and rely on established processors (Google, Razorpay) for the sensitive parts.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        2. Information we collect
      </h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Account data.</strong> When you sign in on the website we use Google Sign-In
            (via Firebase Authentication) and receive your name, email address, profile photo, and a Google account
            identifier. We use this to identify your account and grant access to what you buy.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Purchase &amp; subscription data.</strong> When you make a purchase we store
            records such as your plan, subscription status, entitlements, amounts, and payment/order references and
            timestamps. We do <strong className="text-fg">not</strong> receive or store your card, UPI, or bank
            details — those are handled by our payment processor (see §4).
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Partner-program data (optional).</strong> If you join our partner program, we
            store the social/profile links you provide, your promo code, your referral and commission records, and the
            UPI ID you give us so we can pay out earnings.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Email data.</strong> We use your email to send transactional messages (receipts,
            renewal reminders, partner notifications) and, if you opt in, occasional product updates. We store your
            email preferences and a log of messages sent so we can honour opt-outs and avoid duplicates.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">On-device app data.</strong> In our mobile apps, your preferences, bookmarks,
            notes, progress, and downloaded content are stored locally on your device, not on our servers. You can clear
            them in the app or by uninstalling it.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Technical data.</strong> Like any website or app, our hosting and third-party
            services process technical data such as IP address and request logs to deliver and secure the Services. Our
            apps may show ads through Google AdMob, which processes advertising identifiers and IP address (see §5).
          </span>
        </li>
      </ul>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        3. How we use your data
      </h2>
      <p className="mt-3 text-muted">
        We use the data above to: provide and secure the Services; create your account and grant the access you buy;
        process payments and manage subscriptions; run the partner program and pay out commissions; send transactional
        and (with consent) marketing emails; prevent fraud and abuse; and comply with legal obligations.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">4. Payments</h2>
      <p className="mt-3 text-muted">
        Web payments are processed by <strong className="text-fg">Razorpay</strong>. Your card, UPI, netbanking, and
        similar payment details are collected and processed by Razorpay under its own terms and privacy policy; we
        receive only a confirmation and non-sensitive references (such as payment and order IDs and the amount).
        In-app purchases in our mobile apps are processed by <strong className="text-fg">Google Play Billing</strong>.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        5. Third-party processors
      </h2>
      <p className="mt-3 text-muted">We rely on the following trusted providers, each governed by its own privacy policy:</p>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Google / Firebase</strong> — sign-in (Firebase Authentication), database (Cloud Firestore), and, in apps, advertising (AdMob).</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Razorpay</strong> — payment processing for web purchases.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Google (Gmail)</strong> — delivery of transactional and marketing email.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Vercel</strong> — website hosting and delivery.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">GitHub</strong> — hosting of study content downloaded by the apps.</span>
        </li>
      </ul>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        6. Cookies &amp; local storage
      </h2>
      <p className="mt-3 text-muted">
        We use a small number of functional cookies and local storage entries: your sign-in session, your light/dark
        theme preference, and — if you arrive through a partner link — a referral code cookie that lasts about 30 days
        so the right partner is credited. We do not use advertising cookies on the website.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        7. Data storage &amp; retention
      </h2>
      <p className="mt-3 text-muted">
        Account, purchase, and partner records are stored in Google Cloud Firestore and retained for as long as your
        account is active or as needed to provide the Services, resolve disputes, and meet legal, tax, and accounting
        obligations. On-device app data lives on your device and is removed when you clear the app&rsquo;s data or
        uninstall it.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">8. Your rights</h2>
      <p className="mt-3 text-muted">
        Depending on where you live, you may have rights to access, correct, export, or delete your personal data, or to
        object to or restrict certain processing. To exercise these rights — including deleting your account and the data
        we hold about it — email us at{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="mailto:impactloopapps@gmail.com">
          impactloopapps@gmail.com
        </a>
        . For data processed by Google for ads or billing, you can also use Google&rsquo;s own privacy controls.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">9. Children&rsquo;s privacy</h2>
      <p className="mt-3 text-muted">
        The Services are intended for a general audience and are not directed to children under 13. We do not knowingly
        collect personal information from children. If you believe a child has provided personal information, contact us
        and we will take appropriate steps.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">10. Security</h2>
      <p className="mt-3 text-muted">
        We take reasonable measures to protect the data processed through the Services, and we rely on established
        providers (Google, Razorpay, Vercel) for storage, authentication, and payments. No method of transmission or
        storage is completely secure, but we work to keep the data we hold to a minimum and protected.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">11. Changes to this policy</h2>
      <p className="mt-3 text-muted">
        We may update this Privacy Policy from time to time. When we do, we will revise the &ldquo;Last updated&rdquo;
        date above. Significant changes will be reflected here, and your continued use of the Services constitutes
        acceptance of the updated policy.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">12. Contact us</h2>
      <p className="mt-3 text-muted">
        Questions about privacy? Reach us at{' '}
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
