import { TestBed } from '@angular/core/testing';
import { DestinationOverviewComponent } from './destination-overview.component';
import { destinationPhotography } from './destination-photography';

describe('DestinationOverviewComponent',()=>{
  it('keeps destination photography credited, navigable and separate from missing imagery',()=>{
    const fixture=TestBed.createComponent(DestinationOverviewComponent); const c=fixture.componentInstance;
    c.title='Ooty'; c.photos=destinationPhotography('Ooty (Udhagamandalam), Tamil Nadu'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Jaseem Hamza');
    expect(fixture.nativeElement.textContent).toContain('Not live');
    expect(fixture.nativeElement.querySelector('a[href="https://creativecommons.org/licenses/by/3.0/"]')).not.toBeNull();
    c.photos=[...c.photos,{...c.photos[0],url:'second-photo.jpg'}]; fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Next destination photograph"]').click(); fixture.detectChanges();
    expect(c.activePhoto?.url).toBe('second-photo.jpg');
    c.failed.add('second-photo.jpg'); c.failed.add(c.photos[0].url); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Ooty');
    expect(destinationPhotography('Unmapped destination')).toEqual([]);
  });
});
