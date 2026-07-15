import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy' }

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-bold text-fg">Privacy Policy</h1>
      <p className="mt-3 text-muted">Last updated: 26 June 2026</p>

      <p className="mt-8 text-muted">
        Impact Loop is an indie app studio operated by an individual (sole proprietor) based in India
        (&ldquo;Impact Loop&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). We build privacy-respecting
        apps. We do not require you to create an account, and we do not collect personal information
        to identify you. This policy explains what limited data the Services involve.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">1. Overview</h2>
      <p className="mt-3 text-muted">
        This Privacy Policy describes how data is handled across the Impact Loop website (the
        &ldquo;Site&rdquo;) and our mobile applications, including CrackLoop (collectively, the
        &ldquo;Services&rdquo;). The Services work without any sign-in or account. We ourselves do not
        collect your name, email, phone number, or location. Some limited data is processed by
        trusted third parties (such as Google) to deliver ads, process purchases, and serve content,
        as described below.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">2. Information we collect</h2>
      <p className="mt-3 text-muted">We keep data collection to a minimum:</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
        <li>
          <strong className="text-fg">No account data.</strong> We do not ask you to register, and we
          do not store your identity on our servers.
        </li>
        <li>
          <strong className="text-fg">On-device data.</strong> Your preferences, bookmarks, notes,
          reading progress, and downloaded content are stored locally on your device, not on our
          servers. You can clear them from within the app or by uninstalling it.
        </li>
        <li>
          <strong className="text-fg">Technical data via third parties.</strong> When the app shows
          ads, processes a purchase, or downloads content, the relevant third-party service (e.g.
          Google) may process technical data such as device and advertising identifiers and IP
          address, as covered in their own privacy policies.
        </li>
      </ul>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">3. Advertising</h2>
      <p className="mt-3 text-muted">
        Our apps may display ads through <strong className="text-fg">Google AdMob</strong>. To serve
        and measure ads, Google may collect and use data such as your device&rsquo;s advertising
        identifier and IP address, and may serve personalized or non-personalized ads in accordance
        with its policies. Learn more in{' '}
        <a
          className="underline hover:no-underline"
          href="https://policies.google.com/technologies/ads"
          target="_blank"
          rel="noopener"
        >
          Google&rsquo;s advertising policy
        </a>
        . You can reset or limit ad personalization in your device settings (Android: Settings →
        Google → Ads). Where required, we request consent for personalized ads.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">4. Purchases</h2>
      <p className="mt-3 text-muted">
        Optional paid features (such as &ldquo;CrackLoop Pro&rdquo;) are sold through{' '}
        <strong className="text-fg">Google Play Billing</strong>. Payments are handled entirely by
        Google — we do not receive or store your card or payment details. Google processes purchase
        data under its{' '}
        <a
          className="underline hover:no-underline"
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener"
        >
          privacy policy
        </a>
        .
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">5. Content delivery</h2>
      <p className="mt-3 text-muted">
        Study content is downloaded from our content repository hosted on{' '}
        <strong className="text-fg">GitHub</strong> (including GitHub Releases and raw file hosting).
        As with any network request, GitHub may process your IP address to deliver the files. We do
        not attach any identifier of yours to these requests. Once downloaded, content is cached on
        your device so the app works offline.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">
        6. Data storage &amp; retention
      </h2>
      <p className="mt-3 text-muted">
        Because the data the app creates (preferences, bookmarks, notes, cached content) lives on
        your device, you remain in control of it. Clearing the app&rsquo;s data or uninstalling the
        app removes it. Data processed by Google for ads and billing is retained according to
        Google&rsquo;s own policies.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">7. Children&rsquo;s privacy</h2>
      <p className="mt-3 text-muted">
        The Services are intended for a general audience and are not directed to children under 13.
        We do not knowingly collect personal information from children. If you believe a child has
        provided personal information, contact us and we will take appropriate steps.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">8. Your rights</h2>
      <p className="mt-3 text-muted">
        Depending on where you live, you may have rights to access, correct, or delete personal data,
        or to object to certain processing. Since we do not hold an account or personal profile for
        you, most data can be managed directly on your device. For requests relating to data
        processed by Google (ads/billing), use Google&rsquo;s privacy controls. You can also contact
        us using the details below.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">9. Security</h2>
      <p className="mt-3 text-muted">
        We design the Services to minimize the data involved, which is itself a strong privacy
        safeguard. No method of transmission or storage is completely secure, but we and our
        third-party providers take reasonable measures to protect the data processed through the
        Services.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">10. Changes to this policy</h2>
      <p className="mt-3 text-muted">
        We may update this Privacy Policy from time to time. When we do, we will revise the
        &ldquo;Last updated&rdquo; date above. Significant changes will be reflected here, and your
        continued use of the Services constitutes acceptance of the updated policy.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-fg">11. Contact us</h2>
      <p className="mt-3 text-muted">
        Questions about privacy? Reach us at{' '}
        <a className="underline hover:no-underline" href="mailto:impactloopapps@gmail.com">
          impactloopapps@gmail.com
        </a>
        .
      </p>
    </div>
  )
}
