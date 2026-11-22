import { PlacePhotoGalleryComponent } from '../../shared/components/place-photo-gallery/place-photo-gallery.component';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CATALOGUE_ROOT, CatalogueIndex, CataloguePlace, CatalogueState, IndiaCatalogueService } from './india-catalogue.service';
import { catalogueKey } from './catalogue-selection';
import { DestinationOverviewComponent, DestinationPhoto } from '../discovery/destination-overview.component';
import { destinationPhotography } from '../discovery/destination-photography';
import { DiscoveryCategory } from '../../core/models/discovery.model';

@Component({
  standalone: true,
  selector: 'app-india-catalogue',
  imports: [CommonModule, FormsModule, RouterLink, DestinationOverviewComponent, PlacePhotoGalleryComponent],
  templateUrl: './india-catalogue.component.html',
  styleUrl: './india-catalogue.component.scss'
})
export class IndiaCatalogueComponent implements OnInit, OnChanges, OnDestroy {
  @Input() embedded = false;
  @Input() destination = '';
  @Input() discoveryCategory: DiscoveryCategory = 'ALL';
  @Input() selectable = false;
  @Input() saving = false;
  @Input() selectedIds: ReadonlySet<string> = new Set();
  @Input() dayNumbers: number[] = [];
  @Input() dayAssignments: Record<string, number> = {};
  @Output() selectionChange = new EventEmitter<{place: CataloguePlace; selected: boolean}>();
  @Output() dayChange = new EventEmitter<{place: CataloguePlace; day: number}>();
  @Output() scopeChange = new EventEmitter<string>();
  readonly selectionKey = catalogueKey;
  togglePlace(place: CataloguePlace): void {
    if (!this.selectable || this.saving) return;
    this.selectionChange.emit({place, selected: !this.selectedIds.has(catalogueKey(place))});
  }
  matchMessage = '';
  private readonly catalogue = inject(IndiaCatalogueService);
  private indexRequest?: Subscription;
  private stateRequest?: Subscription;
  readonly root = CATALOGUE_ROOT;
  index?: CatalogueIndex;
  selectedState = '';
  district = '';
  category = '';
  sourceKind = '';
  interest = 'all';
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
    if (changes['discoveryCategory']) this.page=0;
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
    if (name !== this.selectedState) this.scopeChange.emit(name);
    this.stateRequest?.unsubscribe();
    this.selectedState = name;
    this.district = ''; this.query = ''; this.page = 0;
    this.places = []; this.failedImages.clear(); this.error = ''; this.loading = false; this.matchMessage = '';
    this.category = ''; this.sourceKind = '';
    this.interest = 'all';
    const state = this.states.find(s => s.name === name);
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
      const state = this.states.find(s => s.name === this.selectedState);
      if (state) this.loadState(state);
    }
  }
  get districts(): string[] {
    return [...new Set(this.places.map(p => p.district).filter((d): d is string => !!d))].sort();
  }
  get states(): CatalogueState[] {
    return this.index ? [...this.index.states, ...(this.index.unassigned ? [this.index.unassigned] : [])] : [];
  }
  get categories(): string[] {
    return [...new Set(this.places.flatMap(p => p.categories ?? []))].sort();
  }
  categoryLabel(value: string): string { return value.replace(/-/g, ' '); }
  get guideTitle(): string { return this.destination.split(',')[0].trim() || this.selectedState || 'India'; }
  get guidePhotos(): DestinationPhoto[] {
    return [...destinationPhotography(this.guideTitle), ...this.filtered.filter(place=>place.photo).slice(0,8).map(place=>({
      url:this.root+place.photo!.local_thumbnail,name:place.name,attribution:place.photo!.attribution_text,
      license:place.photo!.license,licenseUrl:place.photo!.license_url,sourcePage:place.photo!.source_page
    }))];
  }
  readonly interests=[{value:'all',label:'Essentials'},{value:'nature',label:'Outdoors'},{value:'culture',label:'History & culture'},{value:'museum',label:'Museums'}];
  chooseInterest(value:string): void { this.interest=value; this.page=0; }
  private groupFor(place:CataloguePlace): string {
    const categories=place.categories ?? [];
    if(categories.includes('museum')) return 'museum';
    if(categories.some(c=>['temple','church','mosque','monument','protected-heritage-site','fort','archaeological-site','statue','world-heritage'].includes(c))) return 'culture';
    if(categories.some(c=>['lake','park','reservoir','dam','waterfall','garden','cave','wildlife-refuge','beach','national-park','hill-station','viewpoint','zoo'].includes(c))) return 'nature';
    return 'other';
  }
  private matchesDiscoveryCategory(place:CataloguePlace): boolean {
    if(this.discoveryCategory === 'ALL' || this.discoveryCategory === 'ATTRACTION') return true;
    const categories=place.categories ?? [];
    if(this.discoveryCategory === 'NATURE') return this.groupFor(place) === 'nature';
    if(this.discoveryCategory === 'HISTORICAL' || this.discoveryCategory === 'CULTURAL') return this.groupFor(place) === 'culture';
    if(this.discoveryCategory === 'WILDLIFE') return categories.some(c=>['wildlife-refuge','national-park','zoo'].includes(c));
    return categories.includes(this.discoveryCategory.toLowerCase().replace(/_/g,'-'));
  }
  get catalogueSections(): Array<{key:string;title:string;places:CataloguePlace[]}> {
    const groups=[{key:'other',title:'Things to do',places:[] as CataloguePlace[]},{key:'nature',title:'Outdoors & nature',places:[] as CataloguePlace[]},
      {key:'culture',title:'History & culture',places:[] as CataloguePlace[]},{key:'museum',title:'Museums to explore',places:[] as CataloguePlace[]}];
    for(const place of this.visible) groups.find(g=>g.key===this.groupFor(place))!.places.push(place);
    return groups.filter(g=>g.places.length);
  }
  trackSection(_:number, section:{key:string}): string { return section.key; }
  sourceLabel(place: CataloguePlace): string {
    if (place.source_kind === 'COMMUNITY_STRUCTURED_DATA') return 'Community candidate';
    if (place.source_kind === 'GOVERNMENT_HERITAGE_REGISTRY') return 'Heritage register';
    return 'Tourism source';
  }
  get filtered(): CataloguePlace[] {
    const query = this.query.trim().toLocaleLowerCase();
    return this.places.filter(p => (!this.district || (this.district === '__unknown' ? !p.district : p.district === this.district))
      && (!this.photoOnly || !!p.photo)
      && (!this.category || p.categories?.includes(this.category))
      && (!this.sourceKind || p.source_kind === this.sourceKind)
      && (this.interest === 'all' || this.groupFor(p) === this.interest)
      && this.matchesDiscoveryCategory(p)
      && (!query || [p.name, p.district, p.tourism_destination, ...(p.name_variants ?? [])].some(v => v?.toLocaleLowerCase().includes(query))));
  }
  get pageCount(): number { return Math.ceil(this.filtered.length / this.pageSize); }
  get visible(): CataloguePlace[] { return this.filtered.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize); }
  trackPlace(_: number, place: CataloguePlace): string { return place.place_id; }
  mapUrl(place: CataloguePlace): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${place.latitude},${place.longitude}`);
  }
}
