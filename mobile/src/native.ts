import { invitationPath } from './invitation-link.mjs';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

if (Capacitor.isNativePlatform()) {
  const nativeWindow = window as Window & {
    SuttruNative?: { shareFile(blob:Blob, name:string):Promise<void>; clearTemporaryFiles():Promise<void> };
  };
  nativeWindow.SuttruNative = {
    async clearTemporaryFiles() {
      await Filesystem.rmdir({ directory:Directory.Cache, path:"suttru-share", recursive:true }).catch(() => {});
    },
    async shareFile(blob, name) {
      if (blob.size > 20 * 1024 * 1024) throw new Error('This document is too large to open on the device (20 MB maximum).');
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Unable to read this document.'));
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.readAsDataURL(blob);
      });
      const filename = (name || 'suttru-document').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
      const path = `suttru-share/${Date.now()}-${filename}`;
      const file = await Filesystem.writeFile({ directory:Directory.Cache, path, data, recursive:true });
      try {
        await Share.share({ title:name, files:[file.uri], dialogTitle:'Open or save your Suttru document' });
      } finally {
        // Android's chosen receiver may read the shared URI after the chooser closes.
        // Retain the temporary copy briefly; never copy it into public shared storage automatically.
        setTimeout(() => { void Filesystem.deleteFile({ directory:Directory.Cache, path }).catch(() => {}); }, 10 * 60 * 1000);
      }
    }
  };
  void nativeWindow.SuttruNative.clearTemporaryFiles();
  const openInvitation = (raw:string) => {
    const path = invitationPath(raw);
    if (path && window.location.pathname !== path) {
      if (!document.querySelector('app-root')) {
        window.location.assign(new URL(path, window.location.origin).href);
        return;
      }
      (window as any).SuttruPendingInvitationPath = path;
      window.dispatchEvent(new Event('suttru:invitation-link'));
    }
  };
  void App.addListener('appUrlOpen', ({url}) => {
    void Browser.close().catch(() => {});
    openInvitation(url);
  });
  void App.getLaunchUrl().then(result => { if(result?.url) openInvitation(result.url); });

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back(); else void App.exitApp();
  });
  document.addEventListener('click', event => {
    const anchor = (event.target as Element | null)?.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const url = new URL(anchor.href, location.href);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.origin !== location.origin) {
      event.preventDefault();
      void Browser.open({ url:url.href }).catch(() => { window.alert('Unable to open this link. Please try again.'); });
    }
  });
  // Offline packs remain in IndexedDB and the offline viewer is included in the APK.
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then(all => Promise.all(all.map(reg => reg.unregister()))).catch(() => {});
  }
}
