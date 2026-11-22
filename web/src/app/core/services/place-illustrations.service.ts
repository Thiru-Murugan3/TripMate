import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, Subject, Subscriber, catchError, finalize, map, mergeMap, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

/** A labelled AI artwork shown only when a place has no real photograph. */
export interface PlaceIllustration { imageUrl: string; label: string; notice: string; }

const API_PREFIX = '/api/v1';

@Injectable({ providedIn: 'root' })
export class PlaceIllustrationsService {
  private http = inject(HttpClient);
  private enabled$?: Observable<boolean>;
  private jobs = new Subject<{ externalId: string; subscriber: Subscriber<PlaceIllustration> }>();

  constructor() {
    // Generation is slow and paid: one request at a time; cancelled cards do no work.
    this.jobs.pipe(mergeMap(job => job.subscriber.closed ? EMPTY :
      this.http.post<PlaceIllustration>(`${environment.apiUrl}/discovery/place-illustrations`, { externalId: job.externalId }).pipe(
        tap(result => job.subscriber.next({ ...result, imageUrl: this.absolute(result.imageUrl) })),
        catchError(error => { job.subscriber.error(error); return EMPTY; }),
        finalize(() => job.subscriber.complete())
      ), 1)).subscribe();
  }

  /** Whether the backend has AI illustrations switched on (checked once per session). */
  enabled(): Observable<boolean> {
    this.enabled$ ??= this.http.get<{ enabled: boolean }>(`${environment.apiUrl}/discovery/place-illustrations/status`).pipe(
      map(status => !!status?.enabled),
      catchError(() => of(false)),
      shareReplay(1)
    );
    return this.enabled$;
  }

  get(externalId: string): Observable<PlaceIllustration> {
    return new Observable(subscriber => this.jobs.next({ externalId, subscriber }));
  }

  private absolute(imageUrl: string): string {
    return imageUrl.startsWith(API_PREFIX) ? environment.apiUrl + imageUrl.slice(API_PREFIX.length) : imageUrl;
  }
}
