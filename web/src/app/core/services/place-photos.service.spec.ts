import { photoSourceId } from './place-photos.service';
describe('Exact photo identity',()=>{
 it('accepts linked Wikidata and OSM IDs without guessing from names',()=>{
  expect(photoSourceId('wd-Q123')).toBe('wikidata:Q123');
  expect(photoSourceId('wikidata:Q123')).toBe('wikidata:Q123');
  expect(photoSourceId('other','https://www.openstreetmap.org/way/123')).toBe('osm:way:123');
  for(const url of ['https://www.wikidata.org.evil.test/wiki/Q123','https://user@www.wikidata.org/wiki/Q123','https://tourism.example/place'])expect(photoSourceId('unknown',url)).toBeNull();
 });
});
