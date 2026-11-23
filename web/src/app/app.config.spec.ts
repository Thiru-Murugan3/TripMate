import { ActivatedRouteSnapshot, Route, ViewTransitionInfo } from '@angular/router';
import { skipSameScreenTransition } from './app.config';

function snapshot(routeConfig: Route, params: Record<string, string> = {}): ActivatedRouteSnapshot {
  const child = { routeConfig, params, firstChild: null } as unknown as ActivatedRouteSnapshot;
  return { routeConfig: null, params: {}, firstChild: child } as unknown as ActivatedRouteSnapshot;
}

describe('page transitions', () => {
  const trips: Route = { path: 'trips' }, trip: Route = { path: 'trips/:id' };
  const info = (from: ActivatedRouteSnapshot, to: ActivatedRouteSnapshot) => {
    const transition = jasmine.createSpyObj('ViewTransition', ['skipTransition']);
    skipSameScreenTransition({ transition, from, to } as unknown as ViewTransitionInfo);
    return transition.skipTransition as jasmine.Spy;
  };

  it('keeps the page still when only query params change (trip tabs, filters)', () => {
    expect(info(snapshot(trip, { id: '10' }), snapshot(trip, { id: '10' }))).toHaveBeenCalled();
  });

  it('animates moving to a different screen or a different trip', () => {
    expect(info(snapshot(trips), snapshot(trip, { id: '10' }))).not.toHaveBeenCalled();
    expect(info(snapshot(trip, { id: '10' }), snapshot(trip, { id: '11' }))).not.toHaveBeenCalled();
  });
});
