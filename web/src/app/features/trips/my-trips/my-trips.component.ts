import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Trip, TripStatus, TripType } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';

type StatusFilter = 'ALL' | TripStatus;
type TypeFilter = 'ALL' | TripType;

@Component({
  selector: 'app-my-trips',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-trips.component.html',
  styleUrl: './my-trips.component.scss'
})
export class MyTripsComponent implements OnInit {
  private readonly tripService = inject(TripService);
  private readonly router = inject(Router);

  readonly trips = signal<Trip[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  searchTerm = signal('');
  statusFilter = signal<StatusFilter>('ALL');
  typeFilter = signal<TypeFilter>('ALL');

  readonly statusOptions: StatusFilter[] = [
    'ALL',
    'PLANNED',
    'UPCOMING',
    'CONFIRMED',
    'ONGOING',
    'COMPLETED',
    'CANCELLED'
  ];

  readonly typeOptions: TypeFilter[] = [
    'ALL',
    'ADVENTURE',
    'FAMILY',
    'COUPLE',
    'FRIENDS',
    'SOLO'
  ];

  readonly filteredTrips = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const type = this.typeFilter();

    return this.trips().filter((trip) => {
      const matchesSearch =
        !search ||
        trip.name.toLowerCase().includes(search) ||
        trip.destination.toLowerCase().includes(search);

      const matchesStatus = status === 'ALL' || trip.status === status;
      const matchesType = type === 'ALL' || trip.tripType === type;

      return matchesSearch && matchesStatus && matchesType;
    });
  });

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.tripService.getMyTrips().subscribe({
      next: (trips) => {
        this.trips.set(trips ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load your trips. Please try again.');
        this.loading.set(false);
      }
    });
  }

  updateSearch(value: string): void {
    this.searchTerm.set(value);
  }

  updateStatus(value: string): void {
    this.statusFilter.set(value as StatusFilter);
  }

  updateType(value: string): void {
    this.typeFilter.set(value as TypeFilter);
  }

  createTrip(): void {
    void this.router.navigate(['/dashboard'], {
      queryParams: { createTrip: 1 }
    });
  }

  openTrip(trip: Trip): void {
    void this.router.navigate(['/trips', trip.id]);
  }

  deleteTrip(trip: Trip, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    if (!confirm(`Are you sure you want to delete "${trip.name}"? This action cannot be undone.`)) {
      return;
    }

    this.loading.set(true);
    this.tripService.deleteTrip(trip.id).subscribe({
      next: () => {
        this.trips.update((items) => items.filter((item) => item.id !== trip.id));
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to delete trip. Only trip owners can delete a trip.');
        this.loading.set(false);
      }
    });
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('ALL');
    this.typeFilter.set('ALL');
  }

  getTripImage(trip: Trip): string {
    if (trip.coverImageUrl) {
      return trip.coverImageUrl;
    }

    const destination = trip.destination.toLowerCase();

    if (destination.includes('goa')) return 'assets/images/goa.jpg';
    if (destination.includes('coorg')) return 'assets/images/coorg.jpg';
    if (destination.includes('munnar')) return 'assets/images/munnar.jpg';

    return 'assets/images/kodaikanal.jpg';
  }

  formatStatus(status: TripStatus): string {
    if (status === 'PLANNED') return 'Planning';
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  formatTripType(type: TripType): string {
    return type.charAt(0) + type.slice(1).toLowerCase();
  }

  formatBudget(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  }

  tripDuration(trip: Trip): string {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const milliseconds = end.getTime() - start.getTime();
    const days = Math.max(1, Math.floor(milliseconds / 86400000) + 1);
    return `${days} day${days === 1 ? '' : 's'}`;
  }
}
