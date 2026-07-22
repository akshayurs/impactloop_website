import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ScreenSweep Privacy Policy',
  description:
    'How ScreenSweep handles your data. ScreenSweep is 100% on-device — your screenshots never leave your phone.',
}

const EMAIL = 'impactloopapps@gmail.com'
const DEVELOPER_URL = 'https://play.google.com/store/apps/developer?id=ImpactLoop&hl=en_IN'

export default function ScreenSweepPrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="kicker">ScreenSweep · Legal</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">ScreenSweep Privacy Policy</h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-muted">Last updated: 22 July 2026</p>

      <p className="mt-8 text-muted">
        ScreenSweep is an Android app by <strong className="text-fg">Impact Loop</strong>, an indie app studio operated
        by an individual (sole proprietor) based in India (&ldquo;Impact Loop&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
        ScreenSweep automatically deletes screenshots after a time you choose. It is built to run{' '}
        <strong className="text-fg">entirely on your device</strong>: your screenshots never leave your phone, there is no
        account, and we operate no server that receives your data.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">1. The short version</h2>
      <p className="mt-3 text-muted">
        ScreenSweep does not collect, upload, or share your screenshots or any personal data. Everything it needs — the
        list of tracked screenshots, your settings, and the recovery trash — stays in local storage on your device. The
        only data leaving your phone is what the Google AdMob advertising SDK collects to show ads (see §5), and, if you
        buy Pro, the purchase handled by Google Play Billing (see §6).
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        2. What ScreenSweep stores on your device
      </h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Folder access you grant.</strong> During setup you pick your Screenshots folder
            using Android&rsquo;s Storage Access Framework. ScreenSweep can then list and delete files{' '}
            <strong className="text-fg">only inside that one folder</strong>. It never requests broad &ldquo;All files&rdquo;
            access (<code>MANAGE_EXTERNAL_STORAGE</code>).
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">A local index.</strong> ScreenSweep keeps an on-device database of the
            screenshots it is tracking (file name, size, timestamps, chosen keep-time) and your preferences (mode, default
            keep-time, theme). This never leaves the device.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Recovery trash.</strong> Expired screenshots are first moved to a hidden trash
            folder inside your Screenshots folder and kept for a grace period so you can restore them, before being
            permanently deleted. This is a safety net; it stays on your device.
          </span>
        </li>
      </ul>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        3. Data ScreenSweep collects about you
      </h2>
      <p className="mt-3 text-muted">
        <strong className="text-fg">None.</strong> ScreenSweep&rsquo;s own code does not collect personal information,
        does not create an account, and sends nothing about you or your screenshots to Impact Loop. We have no backend
        database of users. The only third parties that process any data are Google&rsquo;s ads and billing services
        described below, which operate under Google&rsquo;s own privacy policy.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        4. Permissions and why they are used
      </h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Screenshots folder (SAF).</strong> To list, move to trash, and delete expired screenshots — only within the folder you chose.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Foreground service.</strong> A lightweight background service notices when a new screenshot appears so it can offer a keep-or-clean prompt. It watches only for the &ldquo;an image changed&rdquo; signal and then rescans your Screenshots folder; it does <strong className="text-fg">not</strong> read your photo library.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Notifications.</strong> To show the &ldquo;keep this screenshot?&rdquo; prompt and a quiet status notice.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Display over other apps (optional).</strong> Only if you turn on the overlay prompt style. You can leave it off.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Run at startup.</strong> To resume watching for screenshots after you reboot.</span>
        </li>
      </ul>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">5. Advertising (Google AdMob)</h2>
      <p className="mt-3 text-muted">
        The free version of ScreenSweep shows ads through <strong className="text-fg">Google AdMob</strong>. To serve ads,
        AdMob may process data such as your advertising identifier, IP address, and general device information, under{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Google&rsquo;s Privacy Policy
        </a>
        . In the EEA and UK we show a Google-certified consent prompt (UMP) before personalised ads. Unlocking Pro removes
        all ads.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">6. Purchases (Pro unlock)</h2>
      <p className="mt-3 text-muted">
        The one-time Pro unlock is a purchase processed by <strong className="text-fg">Google Play Billing</strong>. Your
        payment details are handled by Google, not by us — ScreenSweep only learns whether Pro is active on your account.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">7. Children</h2>
      <p className="mt-3 text-muted">
        ScreenSweep is a general-audience utility (rated Everyone) and is not directed to children under 13. We do not
        knowingly collect personal information from children.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">8. Retention &amp; deletion</h2>
      <p className="mt-3 text-muted">
        Because ScreenSweep&rsquo;s data lives on your device, you are in control: clear the app&rsquo;s data or uninstall
        it to remove everything ScreenSweep stores. Trashed screenshots are deleted automatically after the grace period,
        and you can restore or permanently clear them at any time from within the app.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">9. Security</h2>
      <p className="mt-3 text-muted">
        Keeping data on your device is our primary safeguard. For the limited ads and billing functions we rely on Google.
        No system is perfectly secure, but ScreenSweep is designed to hold as little data as possible.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">10. Changes to this policy</h2>
      <p className="mt-3 text-muted">
        We may update this policy from time to time and will revise the &ldquo;Last updated&rdquo; date above. Continued
        use of ScreenSweep after a change constitutes acceptance of the updated policy.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">11. Contact</h2>
      <p className="mt-3 text-muted">
        Questions about privacy in ScreenSweep? Email us at{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href={`mailto:${EMAIL}`}>
          {EMAIL}
        </a>
        .
      </p>

      <div className="mt-12 border-t border-line pt-8">
        <a
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-medium text-bg transition hover:opacity-90"
          href={DEVELOPER_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          More apps by Impact Loop →
        </a>
      </div>
    </div>
  )
}
