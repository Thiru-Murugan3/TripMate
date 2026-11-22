import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { TripTimelineComponent } from './trip-timeline.component';
import { TimelineService } from '../../../core/services/timeline.service';
import { TripTimeline } from '../../../core/models/timeline.model';

describe('TripTimelineComponent', () => {
  function timeline(id: number): TripTimeline {
    return { tripId: id, tripName: 'Trip', destination: 'Chennai',
      startDate: '2026-10-15', endDate: '2026-10-15', totalEvents: 0,
      transportCount: 0, stayCount: 0, activityCount: 0, mealCount: 0,
      conflictCount: 0, days: [{ dayNumber: 1, date: '2026-10-15',
        formattedDate: 'Thu, 15 Oct 2026', title: 'Chennai', hasConflict: false, items: [] }] };
  }

  it('keeps empty trip days visible and explains how to fill them', () => {
    const response = new Subject<TripTimeline>();
    TestBed.configureTestingModule({ imports: [TripTimelineComponent],
      providers: [{ provide: TimelineService, useValue: { getTimeline: () => response } }] });
    const fixture = TestBed.createComponent(TripTimelineComponent);
    fixture.componentRef.setInput('tripId', 1);
    fixture.detectChanges();
    response.next(timeline(1));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('DAY 1');
    expect(fixture.nativeElement.textContent).toContain('Nothing planned yet');
  });

  it('cancels stale requests when the trip changes', () => {
    const first = new Subject<TripTimeline>(), second = new Subject<TripTimeline>();
    const service = { getTimeline: jasmine.createSpy().and.returnValues(first, second) };
    TestBed.configureTestingModule({ imports: [TripTimelineComponent],
      providers: [{ provide: TimelineService, useValue: service }] });
    const fixture = TestBed.createComponent(TripTimelineComponent);
    fixture.componentRef.setInput('tripId', 1);
    fixture.detectChanges();
    fixture.componentRef.setInput('tripId', 2);
    fixture.detectChanges();
    second.next(timeline(2));
    first.next(timeline(1));
    expect(fixture.componentInstance.timeline?.tripId).toBe(2);
    fixture.destroy();
    expect(second.observed).toBeFalse();
  });
});
