import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DayRouteMapComponent, RouteMapPoint } from './day-route-map.component';

describe('DayRouteMapComponent', () => {
  let fixture: ComponentFixture<DayRouteMapComponent>;

  const stay: RouteMapPoint = { id: 'stay', name: 'Stay', latitude: 10.2381, longitude: 77.4892 };
  // Two places share exact coordinates and a third is ~30 m away: all would hide behind one marker.
  const stops: RouteMapPoint[] = [
    stay,
    { id: 'a', name: 'Kodai Lake', latitude: 10.2340, longitude: 77.4880 },
    { id: 'b', name: 'Boat House', latitude: 10.2340, longitude: 77.4880 },
    { id: 'c', name: 'Bryant Park', latitude: 10.2342, longitude: 77.4882 },
    { ...stay, id: 'stay-return' }
  ];

  const settle = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 30)));
  const markers = () => Array.from(fixture.nativeElement.ownerDocument.querySelectorAll('.sightseeing-number')) as HTMLElement[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [DayRouteMapComponent] });
    fixture = TestBed.createComponent(DayRouteMapComponent);
    fixture.nativeElement.style.cssText = 'display:block;width:360px';
    document.body.appendChild(fixture.nativeElement);
    fixture.componentInstance.stops = stops;
    fixture.componentInstance.dayNumber = 1;
    fixture.detectChanges();
    await settle();
  });

  afterEach(() => { fixture.destroy(); fixture.nativeElement.remove(); });

  it('draws one marker for the stay and one for every place, without the return stop', () => {
    expect(markers().map(m => m.textContent?.trim())).toEqual(['H', '1', '2', '3']);
  });

  it('fans out markers at the same spot so none is hidden behind another', () => {
    const centres = markers().map(m => { const r = m.firstElementChild!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        expect(Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y)).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('keeps every marker after expanding to full screen and back', async () => {
    fixture.componentInstance.toggleFullscreen();
    await settle();
    expect(markers().length).toBe(4);
    fixture.componentInstance.toggleFullscreen();
    await settle();
    expect(markers().length).toBe(4);
  });
});
