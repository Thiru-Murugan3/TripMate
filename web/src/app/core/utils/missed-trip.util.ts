import { Trip } from '../models/trip.model';

export function findMissedTrip(trips: Trip[]): Trip | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return trips
    .filter((trip) => trip.userRole !== 'VIEWER' && trip.status !== 'CANCELLED')
    .filter((trip) => {
      const startDate = new Date(`${trip.startDate}T00:00:00`);
      return !Number.isNaN(startDate.getTime()) && startDate < today;
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
}
