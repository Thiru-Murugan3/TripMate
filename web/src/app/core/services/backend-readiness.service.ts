import { Injectable, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Observable, catchError, defer, finalize, map, of, repeat, shareReplay, take, tap, timeout, timer } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export const BACKEND_WAKE_TIMEOUT_MS = 180000;

/** Foreground-only readiness: no credentials, background keepalive or login retries. */
@Injectable({providedIn:'root'})
export class BackendReadinessService {
  readonly connecting = signal(false);
  private readonly http:HttpClient;
  private pending?:Observable<void>;
  private readyUntil=0;
  constructor(backend:HttpBackend) { this.http=new HttpClient(backend); }

  ready():Observable<void> {
    return defer(()=>{
      if(Date.now()<this.readyUntil)return of(void 0);
      if(!this.pending) {
        const shared:Observable<void>=defer(()=>{
          this.connecting.set(true);
          return this.http.get<{status:string}>(`${environment.apiUrl}/health`).pipe(
            timeout(8000), map(response=>response.status==='UP'), catchError(()=>of(false)),
            repeat({delay:()=>timer(2000)}), filter(Boolean), take(1),
            timeout(BACKEND_WAKE_TIMEOUT_MS),
            tap(()=>this.readyUntil=Date.now()+15000), map(()=>void 0)
          ).pipe(
            finalize(()=>{this.connecting.set(false);if(this.pending===shared)this.pending=undefined;})
          );
        }).pipe(shareReplay({bufferSize:1,refCount:true}));
        this.pending=shared;
      }
      return this.pending!;
    });
  }
}
