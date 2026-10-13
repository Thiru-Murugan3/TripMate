# Offline travel packs

Open a trip's Timeline, choose essential documents, then select **Save for offline** while connected. A pack contains the current daily timeline and the actual bytes of checked documents. Open **Saved trips** before travelling to verify the copy. Bookmark /offline.html or use the mobile browser's Add to Home Screen option where available.

Saving replaces that trip's previous copy, including its document selection. Downloads finish before replacement. A failed download or storage transaction retains the old snapshot. Each save allows up to ten documents and 25 MB; the offline store has a 50 MB budget. Remove packs from the reader to free space.

The viewer is responsive, read-only, uses no remote fonts or JavaScript dependencies, and shows the saved timestamp. It includes dates, times, locations, booking references, notes and conflicts. Documents download from local blobs, never stored expiring cloud links. Device PDF/image viewing support varies; check essential files before departure.

## Scope and privacy

This is an explicit local snapshot, not offline editing or background synchronization. No booking mutations are queued. Server updates, cancellations, membership removal and document deletion do not alter an already downloaded copy; reconnect and save again. Browsers can evict site storage, and private browsing may restrict it.

The service worker caches only the standalone reader and its static dependencies. It does not cache API traffic, auth tokens, Angular pages or signed document URLs. When navigation fails, it opens the saved-trips reader. The full app shell and online features are not cached.

Packs are scoped to the locally signed-in user and a session epoch. Sign-out or account switch rotates the epoch immediately and clears IndexedDB. In-flight writes from the old session cannot become accessible. The viewer responds to cross-tab session changes and revokes blob URLs. This is device-local access control, not additional encryption: anyone with access to the signed-in browser can read the files. Downloaded files outside browser storage are not removed on logout. Use a trusted, locked device.

## Maintenance and verification

Static assets live in web/public/offline*, with the Angular save component under features/trips/offline-trip. No backend schema or dependencies change. HTTPS is required outside localhost.

Bump the shell cache version when changing offline assets so updates install a complete compatible viewer. Never introduce broad API caching rules.

npm run test:offline runs worker routing/cache tests and real-browser IndexedDB tests for snapshot replacement, account isolation, logout invalidation and failed-write preservation. Web CI runs it before existing tests and production/development builds.

Manual release check: save a timeline and PDF, open the reader, enable airplane mode, reload a trip URL and check the fallback reader, download the PDF, then reconnect and sign out. The reader must no longer display the pack. Repeat with blocked storage and a failed document download; do not report success or lose a previous snapshot.
