// Only accept Suttru invitation URLs; never navigate to an arbitrary inbound URL.
export function invitationPath(raw) {
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.port || url.search || url.hash) return null;
    let token;
    if (url.protocol === 'suttru:' && url.hostname === 'invite') token = url.pathname.slice(1);
    else if (url.protocol === 'https:' && ['suttru.in','www.suttru.in'].includes(url.hostname)) {
      if (!url.pathname.startsWith('/invite/')) return null;
      token = url.pathname.slice('/invite/'.length);
    } else return null;
    return /^[A-Za-z0-9-]{1,200}$/.test(token) ? `/invite/${token}` : null;
  } catch { return null; }
}
