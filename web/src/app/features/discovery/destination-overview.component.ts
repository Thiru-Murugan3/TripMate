import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface DestinationPhoto {
  url: string; name: string; attribution: string; license: string;
  sourcePage: string; licenseUrl?: string;
}

@Component({
  selector: 'app-destination-overview', standalone: true, imports: [CommonModule],
  template: `
    <section class="destination-overview" aria-label="Destination overview">
      <figure *ngIf="activePhoto as photo" class="destination-photo">
        <img [src]="photo.url" [alt]="photo.name" (error)="failed.add(photo.url)" fetchpriority="high" />
        <figcaption><span>Source photograph · Not live</span>
          <a [href]="photo.sourcePage" target="_blank" rel="noopener noreferrer">{{ photo.attribution }}</a>
          <a *ngIf="photo.licenseUrl; else licenseText" [href]="photo.licenseUrl" target="_blank" rel="noopener noreferrer">{{ photo.license }}</a>
          <ng-template #licenseText><span>{{ photo.license }}</span></ng-template>
        </figcaption>
        <div *ngIf="availablePhotos.length > 1" class="photo-navigation">
          <button type="button" (click)="move(-1)" aria-label="Previous destination photograph">‹</button>
          <span>{{ photoIndex % availablePhotos.length + 1 }} / {{ availablePhotos.length }}</span>
          <button type="button" (click)="move(1)" aria-label="Next destination photograph">›</button>
        </div>
      </figure>
      <div class="destination-intro" [class.without-photo]="!activePhoto">
        <p class="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>{{ title || 'Explore India' }}</h1>
        <p class="intro-copy">{{ description }}</p>
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; min-width:0; color:#163b2c; }
    .destination-photo { position:relative; margin:0; height:clamp(230px,34vw,430px); border-radius:16px; overflow:hidden; background:#f1f3ef; }
    img { display:block; width:100%; height:100%; object-fit:cover; }
    figcaption { position:absolute; bottom:0; left:0; right:0; display:flex; flex-wrap:wrap; gap:4px 12px; padding:30px 20px 14px; color:white; background:linear-gradient(transparent,rgba(0,0,0,.8)); font-size:11px; line-height:1.5; padding-right:130px; }
    figcaption a { color:inherit; text-decoration:underline; overflow-wrap:anywhere; }
    .photo-navigation { position:absolute; bottom:16px; right:16px; display:flex; align-items:center; gap:8px; color:white; font-size:12px; }
    button { width:32px; height:32px; border:1px solid #ffffffa8; border-radius:50%; background:#ffffffed; color:#163b2c; cursor:pointer; font-size:23px; line-height:1; }
    button:focus-visible { outline:3px solid #34a27a; outline-offset:3px; }
    .destination-intro { margin:28px 0 34px; max-width:950px; }
    .without-photo { padding:30px; border-radius:14px; background:#f4f5ee; max-width:none; }
    .eyebrow { font-size:11px; font-weight:750; letter-spacing:.14em; margin:0 0 9px; color:#527464; }
    h1 { margin:0 0 15px; font-size:clamp(32px,4.3vw,56px); line-height:1.08; font-weight:850; letter-spacing:-.045em; overflow-wrap:anywhere; }
    .intro-copy { color:#536157; font-size:15px; line-height:1.75; margin:0; max-width:780px; }
    @media(max-width:600px) { .destination-photo { border-radius:10px; } .destination-intro { margin:22px 0 26px; } .without-photo { padding:23px; } figcaption { padding:30px 12px 12px; padding-right:105px; font-size:10px; } .photo-navigation { right:10px; gap:4px; } }
  `]
})
export class DestinationOverviewComponent {
  @Input() title = '';
  @Input() description = 'Find things to do, discover places to stay and make room for local experiences. Choose your favourites and build a trip that feels like yours.';
  @Input() photos: DestinationPhoto[] = [];
  readonly failed = new Set<string>();
  photoIndex = 0;
  get availablePhotos(): DestinationPhoto[] { return this.photos.filter(photo => !this.failed.has(photo.url)); }
  get activePhoto(): DestinationPhoto | undefined { return this.availablePhotos[this.photoIndex % this.availablePhotos.length]; }
  move(direction: number): void {
    const length=this.availablePhotos.length;
    this.photoIndex=length ? (this.photoIndex+direction+length)%length : 0;
  }
}
