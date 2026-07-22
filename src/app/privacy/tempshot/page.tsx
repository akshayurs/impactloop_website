import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TempShot Privacy Policy',
  description:
    'How TempShot handles your data. TempShot is 100% on-device — your photos never leave your phone.',
}

const EMAIL = 'impactloopapps@gmail.com'
const DEVELOPER_URL = 'https://play.google.com/store/apps/developer?id=ImpactLoop&hl=en_IN'

export default function TempShotPrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="kicker">TempShot · Legal</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">TempShot Privacy Policy</h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-muted">Last updated: 22 July 2026</p>

      <p className="mt-8 text-muted">
        TempShot is an Android app by <strong className="text-fg">Impact Loop</strong>, an indie app studio operated by
        an individual (sole proprietor) based in India (&ldquo;Impact Loop&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
        TempShot gives camera photos an expiry date: photos <strong className="text-fg">you explicitly mark as
        temporary</strong> are automatically deleted when their time is up, after a recovery grace period. It is built to
        run <strong className="text-fg">entirely on your device</strong>: your photos never leave your phone, there is no
        account, and we operate no server that receives your data.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">1. The short version</h2>
      <p className="mt-3 text-muted">
        TempShot does not collect, upload, or share your photos or any personal data. Everything it needs — the list of
        photos you marked temporary, your settings, and the recovery trash — stays in local storage on your device.
        TempShot only ever deletes photos you explicitly marked as temporary; photos you did not mark are never touched.
        The only data leaving your phone is, if you buy Pro, the purchase handled by Google Play Billing (see §5).
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        2. What TempShot stores on your device
      </h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Folder access you grant.</strong> During setup you pick your camera folder
            (usually DCIM/Camera) using Android&rsquo;s Storage Access Framework. TempShot can then list and delete files{' '}
            <strong className="text-fg">only inside that one folder</strong>. It never requests broad &ldquo;All
            files&rdquo; access (<code>MANAGE_EXTERNAL_STORAGE</code>) and no broad photo-library permission.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">A local index.</strong> TempShot keeps an on-device database of the photos you
            marked temporary (file name, size, timestamps, chosen expiry) and your preferences (default expiry, grace
            period, theme). This never leaves the device.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Recovery trash.</strong> Expired photos are first moved to a private trash area
            and kept for a grace period so you can restore them, before being permanently deleted. This is a safety net;
            it stays on your device.
          </span>
        </li>
      </ul>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        3. Data TempShot collects about you
      </h2>
      <p className="mt-3 text-muted">
        <strong className="text-fg">None.</strong> TempShot&rsquo;s own code does not collect personal information, does
        not create an account, and sends nothing about you or your photos to Impact Loop. We have no backend database of
        users. The only third party that processes any data is Google Play Billing for the optional Pro purchase,
        operating under Google&rsquo;s own privacy policy.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        4. Permissions and why they are used
      </h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Camera.</strong> To take temporary photos inside the app. Photos are saved to your normal camera folder; the camera is never used in the background.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Camera folder (SAF).</strong> To list photos so you can mark them temporary, and to move expired ones to trash — only within the folder you chose.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Foreground service (optional).</strong> Only if you turn on the capture prompt: a lightweight service notices when a new photo appears so it can ask &ldquo;temporary or keep?&rdquo;. It watches only for the &ldquo;an image changed&rdquo; signal and then rescans your chosen camera folder; it does <strong className="text-fg">not</strong> read your photo library. Ignoring the prompt always means the photo is kept forever.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Notifications.</strong> To show the capture prompt and a daily &ldquo;photos expiring soon&rdquo; digest.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Ignore battery optimizations (optional).</strong> Only if you enable the capture prompt, so the watcher is not killed by aggressive battery savers. You can decline and the rest of the app works normally.</span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span><strong className="text-fg">Run at startup.</strong> To resume the expiry schedule and (if enabled) the capture prompt after you reboot.</span>
        </li>
      </ul>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">5. Purchases (Pro unlock)</h2>
      <p className="mt-3 text-muted">
        The one-time Pro unlock is a purchase processed by <strong className="text-fg">Google Play Billing</strong>. Your
        payment details are handled by Google, not by us — TempShot only learns whether Pro is active on your account.
        The free version of TempShot currently shows no ads.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">6. Children</h2>
      <p className="mt-3 text-muted">
        TempShot is a general-audience utility (rated Everyone) and is not directed to children under 13. We do not
        knowingly collect personal information from children.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">7. Retention &amp; deletion</h2>
      <p className="mt-3 text-muted">
        Because TempShot&rsquo;s data lives on your device, you are in control: clear the app&rsquo;s data or uninstall it
        to remove everything TempShot stores. Trashed photos are deleted automatically after the grace period, and you can
        restore or permanently clear them at any time from within the app. Marking a photo &ldquo;keep forever&rdquo;
        removes it from TempShot&rsquo;s index entirely.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">8. Security</h2>
      <p className="mt-3 text-muted">
        Keeping data on your device is our primary safeguard. For the limited billing function we rely on Google. No
        system is perfectly secure, but TempShot is designed to hold as little data as possible.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">9. Changes to this policy</h2>
      <p className="mt-3 text-muted">
        We may update this policy from time to time and will revise the &ldquo;Last updated&rdquo; date above. Continued
        use of TempShot after a change constitutes acceptance of the updated policy.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">10. Contact</h2>
      <p className="mt-3 text-muted">
        Questions about privacy in TempShot? Email us at{' '}
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
