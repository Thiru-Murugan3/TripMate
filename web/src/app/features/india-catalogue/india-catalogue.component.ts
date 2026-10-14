import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CATALOGUE_ROOT, CatalogueIndex, CataloguePlace, CatalogueState, IndiaCatalogueService } from './india-catalogue.service';

@Component({
  standalone: true,
  selector: 'app-india-catalogue',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './india-catalogue.component.html',
  styleUrl: './india-catalogue.component.scss'
})
export class IndiaCatalogueComponent implements OnInit, OnChanges, OnDestroy {
  @Input() embedded = false;
  @Input() destination = '';
  matchMessage = '';
  private readonly catalogue = inject(IndiaCatalogueService);
  private indexRequest?: Subscription;
  private stateRequest?: Subscription;
  readonly root = CATALOGUE_ROOT;
  index?: CatalogueIndex;
  selectedState = '';
  district = '';
  query = '';
  photoOnly = false;
  page = 0;
  readonly pageSize = 24;
  places: CataloguePlace[] = [];
  loading = false;
  error = '';
  failedImages = new Set<string>();

  ngOnInit(): void { this.loadIndex(); }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['destination'] && this.index) this.matchDestination();
  }
  private matchDestination(): void {
    if (!this.index || !this.destination.trim()) return;
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const parts = this.destination.split(',').map(value => value.trim()).filter(Boolean);
    const state = this.index.states.find(s => parts.some(part => normalize(part) === normalize(s.name)));
    const city = parts.find(part => this.index?.destinationStates?.[normalize(part)]
      ?.some(name => !state || name === state.name));
    const candidates = city ? this.index.destinationStates?.[normalize(city)] ?? [] : [];
    const match = state?.name || (candidates.length === 1 ? candidates[0] : '');
    this.selectState(match);
    this.photoOnly = false;
    if (match) {
      this.query = city && normalize(city) !== normalize(match) ? city : '';
      this.matchMessage = `Source catalogue for ${this.query || match}. These records load independently of live providers.`;
    } else {
      this.matchMessage = `Choose a state below to browse source records for ${this.destination}. This destination could not be matched uniquely.`;
    }
  }
  ngOnDestroy(): void { this.indexRequest?.unsubscribe(); this.stateRequest?.unsubscribe(); }
  loadIndex(): void {
    this.indexRequest?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.indexRequest = this.catalogue.index().subscribe({
      next: index => { this.index = index; this.loading = false; this.matchDestination(); },
      error: () => { this.error = 'Unable to load the India catalogue. Please retry.'; this.loading = false; }
    });
  }
  selectState(name: string): void {
    this.stateRequest?.unsubscribe();
    this.selectedState = name;
    this.district = ''; this.query = ''; this.page = 0;
    this.places = []; this.failedImages.clear(); this.error = ''; this.loading = false; this.matchMessage = '';
    const state = this.index?.states.find(s => s.name === name);
    if (!state) return;
    this.loadState(state);
  }
  private loadState(state: CatalogueState): void {
    this.loading = true;
    this.stateRequest = this.catalogue.state(state).subscribe({
      next: places => { this.places = places; this.loading = false; },
      error: () => { this.error = 'Unable to load this state. Please retry when connected.'; this.loading = false; }
    });
  }
  retry(): void {
    if (!this.index) this.loadIndex();
    else {
      this.stateRequest?.unsubscribe();
      this.error = '';
      const state = this.index.states.find(s => s.name === this.selectedState);
      if (state) this.loadState(state);
    }
  }
  get districts(): string[] {
    return [...new Set(this.places.map(p => p.district).filter((d): d is string => !!d))].sort();
  }
  get filtered(): CataloguePlace[] {
    const query = this.query.trim().toLocaleLowerCase();
    return this.places.filter(p => (!this.district || (this.district === '__unknown' ? !p.district : p.district === this.district))
      && (!this.photoOnly || !!p.photo)
      && (!query || [p.name, p.district, p.tourism_destination].some(v => v?.toLocaleLowerCase().includes(query))));
  }
  get pageCount(): number { return Math.ceil(this.filtered.length / this.pageSize); }
  get visible(): CataloguePlace[] { return this.filtered.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize); }
  trackPlace(_: number, place: CataloguePlace): string { return place.place_id; }
  mapUrl(place: CataloguePlace): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${place.latitude},${place.longitude}`);
  }
}
