import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DiscoveryAdminComponent } from './discovery-admin.component';
import { DiscoveryAdminService } from '../../core/services/discovery-admin.service';
import { AdminDiscoveryItem } from '../../core/models/discovery-admin.model';

describe('DiscoveryAdminComponent', () => {
  it('preserves all fees and gallery credits when editing a listing', () => {
    const service = jasmine.createSpyObj<DiscoveryAdminService>('DiscoveryAdminService', ['list', 'update']);
    service.list.and.returnValue(of([]));
    service.update.and.returnValue(of({} as AdminDiscoveryItem));
    TestBed.configureTestingModule({ imports: [DiscoveryAdminComponent], providers: [{ provide: DiscoveryAdminService, useValue: service }] });
    const fixture = TestBed.createComponent(DiscoveryAdminComponent);
    const price = { label: 'Adult', amount: 50, currency: 'INR', priceType: 'PER_PERSON' as const,
      status: 'VERIFIED' as const, sourceUrl: 'https://tourism.example/fees' };
    const image = { url: 'https://images.example/primary.jpg', sourcePage: 'https://commons.example/file',
      sourceName: 'Wikimedia Commons', author: 'Photographer', attribution: 'Photographer', license: 'CC BY 4.0', exact: true, primary: true };
    fixture.componentInstance.edit({ id: 42, enabled: true, listing: {
      externalId: 'curated:fort', name: 'Fort', category: 'HISTORICAL', saveCategory: 'ATTRACTION',
      latitude: 13, longitude: 80, distanceKm: 0, suggestedVisitMinutes: 60,
      priceStatus: 'VERIFIED', estimatedCostPerPerson: 50,
      priceOptions: [price, { ...price, label: 'Child', amount: 20 }],
      imageGallery: [image, { ...image, url: 'https://images.example/second.jpg', primary: false }]
    } } as AdminDiscoveryItem);
    fixture.componentInstance.draft.name = 'Updated Fort';
    fixture.componentInstance.save();
    const payload = service.update.calls.mostRecent().args[1];
    expect(payload.priceOptions.map(p => p.priceStatus)).toEqual(['VERIFIED', 'VERIFIED']);
    expect(payload.priceOptions.map(p => p.amount)).toEqual([50, 20]);
    expect(payload.images.length).toBe(2);
    expect(payload.images[0].author).toBe('Photographer');
    expect(payload.images[1].imageUrl).toBe('https://images.example/second.jpg');
    TestBed.resetTestingModule();
  });
});
