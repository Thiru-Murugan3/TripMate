import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const root = new URL('../public/india-catalogue/2026-10-14/', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
test('catalogue references, trust labels, fee variants and licensed thumbnails remain intact', async () => {
  const index = await json('index.json');
  assert.equal(index.states.length, 36);
  const ids = new Set(); let total=0, photos=0, fees=0;
  for (const state of index.states) {
    assert.match(state.file, /^[a-z-]+\.json$/);
    const rows = await json(state.file); assert.equal(rows.length,state.count);
    for (const p of rows) {
      total++; assert.equal(p.state_ut,state.name); assert(!ids.has(p.place_id)); ids.add(p.place_id);
      assert.equal(p.publication_status,'REVIEW_REQUIRED'); assert.match(p.source_url,/^https:\/\//);
      assert(!('fee_amount_inr' in p));
      for (const f of p.fees) {
        fees++; assert.equal(f.place_id,p.place_id); assert(f.amount_inr>=0);
        assert(f.visitor_category && f.scope && f.source_checked_at);
        assert.match(f.source_url,/^https:\/\//);
      }
      if (p.photo) {
        photos++; assert.equal(p.photo.place_id,p.place_id); assert.equal(p.photo.is_live,false);
        assert(p.photo.creator && p.photo.license && p.photo.attribution_text);
        assert.match(p.photo.source_page,/^https:\/\/commons.wikimedia.org\//);
        assert.match(p.photo.local_thumbnail,/^thumbnails\/in-[a-f0-9]+\.jpg$/);
        await access(new URL(p.photo.local_thumbnail,root));
      }
    }
  }
  assert.equal(total,index.total); assert.equal(total,2089); assert.equal(photos,108); assert.equal(fees,35);
});
