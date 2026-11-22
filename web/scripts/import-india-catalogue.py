#!/usr/bin/env python3
"""Build compact, versioned browser assets from a Suttru research ZIP (stdlib only)."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'india-catalogue'
FIELDS = '''place_id name state_ut district tourism_destination record_type latitude longitude
coordinate_source coordinate_status source_provider source_url source_checked_at
possible_duplicate_group publication_status source_kind categories name_variants
district_status district_as_published district_source_url tourist_relevance_status
visitor_access_status name_as_published source_section registry_source_record'''.split()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--snapshot', default='2026-10-15')
    args = parser.parse_args()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', args.snapshot):
        parser.error('snapshot must be YYYY-MM-DD')
    target = ROOT / args.snapshot
    if target.exists():
        parser.error(f'{target} exists; use a new snapshot or remove this generated directory explicitly')
    with zipfile.ZipFile(args.archive) as archive:
        prefix = 'Suttru-India-Tourism/'
        read = lambda name: json.loads(archive.read(prefix + name))
        places, fees, photos = read('places.json'), read('entry-fees.json'), read('reviewed-commons-photos.json')
        summary = read('quality-summary.json')
        ids = {p['place_id'] for p in places}
        assert len(ids) == len(places) == summary['catalogue_records'], 'Invalid record count or duplicate IDs'
        fee_map, photo_map = defaultdict(list), {}
        for fee in fees:
            assert fee['place_id'] in ids and fee['amount_inr'] >= 0
            assert fee['source_url'].startswith('https://')
            fee_map[fee['place_id']].append(fee)
        thumbnails = {}
        for photo in photos:
            assert photo['place_id'] in ids and photo['place_id'] not in photo_map
            assert photo['is_live'] is False and photo['attribution_text'] and photo['license']
            thumbnail = photo['local_thumbnail']
            assert re.fullmatch(r'thumbnails/in-[a-f0-9]+\.jpg', thumbnail)
            thumbnails[thumbnail] = archive.read(prefix + thumbnail)
            photo_map[photo['place_id']] = photo
        groups, destinations = defaultdict(list), defaultdict(set)
        for place in places:
            assert place['source_url'].startswith('https://')
            assert place['publication_status'] in ('REVIEW_REQUIRED', 'CANDIDATE_REVIEW_REQUIRED')
            row = {key: place[key] for key in FIELDS if key in place}
            row['fees'], row['photo'] = fee_map[place['place_id']], photo_map.get(place['place_id'])
            groups[place['state_ut']].append(row)
            if place['state_ut']:
                for name in [place['name'], place.get('district'), place.get('tourism_destination'), *place.get('name_variants', [])]:
                    if name:
                        key = re.sub(r'[^a-z0-9]', '', name.lower())
                        if key:
                            destinations[key].add(place['state_ut'])
        assert len([s for s in groups if s]) == 36
        # Preserve all previous IDs and the exact reviewed fee/photo evidence.
        previous = ROOT / '2026-10-14'
        if previous.exists():
            old_index = json.loads((previous / 'index.json').read_text())
            by_id = {p['place_id']: p for rows in groups.values() for p in rows}
            for state in old_index['states']:
                for old in json.loads((previous / state['file']).read_text()):
                    assert old['place_id'] in by_id, 'Previous record missing'
                    current = by_id[old['place_id']]
                    assert current['fees'] == old['fees'] and current['photo'] == old['photo'], 'Existing evidence changed'
        def write(name, value):
            path = target / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')
        states, unassigned = [], None
        for state, rows in sorted(groups.items(), key=lambda item: item[0] or ''):
            slug = re.sub(r'[^a-z0-9]+', '-', state.lower()).strip('-') if state else 'state-unassigned'
            filename = slug + '.json'
            write(filename, rows)
            entry = {'name': state or 'State not assigned', 'file': filename, 'count': len(rows)}
            if state:
                states.append(entry)
            else:
                unassigned = entry
        write('index.json', {'snapshot': args.snapshot, 'total': len(places), 'states': states,
                            'unassigned': unassigned, 'allIndiaExhaustive': False,
                            'destinationStates': {k: sorted(v) for k, v in sorted(destinations.items())}})
        write('provenance.json', {'archiveSha256': hashlib.sha256(args.archive.read_bytes()).hexdigest(),
                                 'summary': summary, 'sourceCounts': dict(Counter(p['source_kind'] for p in places)),
                                 'fees': len(fees), 'photos': len(photos)})
        for name, data in thumbnails.items():
            (target / name).parent.mkdir(parents=True, exist_ok=True)
            (target / name).write_bytes(data)
        (target / 'README.md').write_bytes(archive.read(prefix + 'README.md'))
    print(f'Imported {len(places)} source records, {len(fees)} fee options and {len(photos)} photos to {target}')


if __name__ == '__main__':
    main()
