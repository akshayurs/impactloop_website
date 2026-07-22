import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms' }

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="kicker">Legal</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">Terms &amp; Conditions</h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-muted">Last updated: 26 June 2026</p>

      <p className="mt-8 text-muted">
        Impact Loop is an indie app studio operated by an individual (sole proprietor) based in
        India, doing business as &ldquo;Impact Loop&rdquo; (&ldquo;Impact Loop&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;, or &ldquo;our&rdquo;). This is a plain-language agreement, not formal legal
        advice.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        1. Acceptance of terms
      </h2>
      <p className="mt-3 text-muted">
        These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the
        Impact Loop website (the &ldquo;Site&rdquo;) and our mobile applications, including CrackLoop
        (collectively, the &ldquo;Services&rdquo;). By accessing or using the Services, you agree to
        be bound by these Terms and by our Privacy Policy. If you do not agree, please do not use the
        Services.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">2. Eligibility</h2>
      <p className="mt-3 text-muted">
        You must be at least 13 years old (or the minimum age of digital consent in your country, if
        higher) to use the Services. The Services are intended for a general adult audience and are
        not directed to children under 13. By using the Services you confirm that you meet this
        requirement and that any information you provide is accurate.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">3. Use of the site</h2>
      <p className="mt-3 text-muted">
        You may use the Site for lawful, personal, and non-commercial purposes. You agree not to:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          Use the Services in any way that violates applicable laws or regulations.
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          Attempt to gain unauthorized access to, interfere with, or disrupt the Services or their
          underlying infrastructure.
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          Copy, scrape, reproduce, or redistribute content from the Services without prior written
          permission.
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          Use the Services to transmit malicious code or engage in abusive behavior.
        </li>
      </ul>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">4. Apps &amp; license</h2>
      <p className="mt-3 text-muted">
        Our applications, including CrackLoop, are provided to you under a limited, non-exclusive,
        non-transferable, revocable license for your personal use, subject to these Terms and the
        rules of the app store from which you download them (such as the Google Play Store).
        Educational content within the apps is provided for learning and interview-preparation
        purposes and does not guarantee any particular outcome, employment, or result.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        5. Purchases, billing &amp; refunds
      </h2>
      <p className="mt-3 text-muted">
        You can buy paid plans (for example, &ldquo;CrackLoop Pro&rdquo;) in two ways, each with its own billing and
        refund terms:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">On the website</strong>, payments are processed by Razorpay. Subscriptions renew
            automatically for the chosen billing period until you cancel; you can cancel any time from your account, and
            access continues until the end of the period you have already paid for. A lifetime purchase is a single,
            one-time payment with no recurring charge. Web purchases are governed by our{' '}
            <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="/refund">
              Refund &amp; Cancellation Policy
            </a>
            .
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Inside the mobile apps</strong>, purchases are processed by the relevant app
            store (such as Google Play) and are subject to that store&rsquo;s payment terms and refund policies.
          </span>
        </li>
      </ul>
      <p className="mt-3 text-muted">
        Unless required by applicable law (including Indian consumer-protection law) or stated otherwise, purchases are
        non-refundable; web refund requests are reviewed case by case as described in our Refund &amp; Cancellation
        Policy. Prices and the features included in any paid tier may change over time.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">6. Intellectual property</h2>
      <p className="mt-3 text-muted">
        The Services, including all text, graphics, diagrams, logos, software, and design, are owned
        by Impact Loop or its licensors and are protected by intellectual-property laws. The names
        &ldquo;Impact Loop&rdquo; and &ldquo;CrackLoop&rdquo;, along with related logos, are brands of
        Impact Loop. Nothing in these Terms grants you any right to use them without prior written
        consent.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        7. Third-party services &amp; privacy
      </h2>
      <p className="mt-3 text-muted">
        How we handle data is described in our Privacy Policy. The Services may rely on or link to
        third-party services, including the Google Play Store, Google AdMob (advertising), and
        content hosting providers such as GitHub. Your use of those services is governed by their
        respective terms and privacy policies. We are not responsible for the content, policies, or
        practices of any third party.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">8. Disclaimers</h2>
      <p className="mt-3 text-muted">
        The Services are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
        warranties of any kind, whether express or implied, including but not limited to fitness for
        a particular purpose, accuracy, or non-infringement. We do not warrant that the Services will
        be uninterrupted, error-free, or that educational content is complete or current.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        9. Limitation of liability
      </h2>
      <p className="mt-3 text-muted">
        To the maximum extent permitted by law, Impact Loop shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or any loss of data, revenue, or
        goodwill, arising from your use of or inability to use the Services. Nothing in these Terms
        excludes liability that cannot be excluded under applicable law.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">10. Termination</h2>
      <p className="mt-3 text-muted">
        We may suspend or terminate your access to the Services at any time, without notice, if you
        breach these Terms or use the Services unlawfully. You may stop using the Services at any
        time. Provisions that by their nature should survive termination — including intellectual
        property, disclaimers, and limitation of liability — will continue to apply.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">11. Governing law</h2>
      <p className="mt-3 text-muted">
        These Terms are governed by and construed in accordance with the laws of India, without
        regard to its conflict-of-laws principles. Subject to any mandatory rights you may have as a
        consumer, you agree that the competent courts located in India shall have exclusive
        jurisdiction over any dispute arising out of or relating to these Terms or the Services.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">12. Changes to these terms</h2>
      <p className="mt-3 text-muted">
        We may update these Terms from time to time. When we do, we will revise the &ldquo;Last
        updated&rdquo; date above. Your continued use of the Services after changes take effect
        constitutes acceptance of the revised Terms.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">13. Contact us</h2>
      <p className="mt-3 text-muted">
        Questions about these Terms? Reach us at{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="mailto:impactloopapps@gmail.com">
          impactloopapps@gmail.com
        </a>
        .
      </p>
    </div>
  )
}
