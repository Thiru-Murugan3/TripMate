import { clearOffline, readPacks, savePack, session, OfflinePack } from '../../../../public/offline-store.js';

describe('offline travel storage', () => {
  function pack(tripId = 1): OfflinePack {
    const identity = session();
    return { ...identity, key: identity.owner + ':' + identity.epoch + ':' + tripId,
      tripId, savedAt: new Date().toISOString(), timeline: { days: [] },
      documents: [{ id: 1, name: 'ticket.pdf', blob: new Blob(['ticket'], { type: 'application/pdf' }) }], bytes: 6 };
  }
  beforeEach(async () => {
    localStorage.setItem('tripmate_user', JSON.stringify({ id: 1 }));
    localStorage.setItem('tripmate_access_token', 'test-token');
    await clearOffline();
  });
  afterEach(async () => { await clearOffline(); localStorage.clear(); });

  it('stores the actual document bytes and replaces a snapshot atomically', async () => {
    const first = pack();
    await savePack(first);
    await savePack({ ...first, savedAt: '2026-10-14T00:00:00Z' });
    const saved = await readPacks();
    expect(saved.length).toBe(1);
    expect(saved[0].savedAt).toBe('2026-10-14T00:00:00Z');
    expect(await saved[0].documents[0].blob.text()).toBe('ticket');
  });

  it('does not reveal one accounts documents to another', async () => {
    await savePack(pack());
    localStorage.setItem('tripmate_user', JSON.stringify({ id: 2 }));
    expect(await readPacks()).toEqual([]);
  });

  it('rejects in-flight saves after sign-out invalidates the session', async () => {
    const pending = pack();
    await clearOffline();
    await expectAsync(savePack(pending)).toBeRejected();
    expect(await readPacks()).toEqual([]);
  });

  it('keeps the old snapshot when the storage budget is exceeded', async () => {
    const original = pack();
    await savePack(original);
    await expectAsync(savePack({ ...original, bytes: 51 * 1024 * 1024 })).toBeRejected();
    expect((await readPacks())[0].bytes).toBe(6);
  });
});
