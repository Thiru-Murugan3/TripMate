import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy, ViewEncapsulation, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

interface GoogleTopPlacesResult {
  destination:string; text:string; sources:{title:string;url:string}[];
  searchSuggestionsHtml:string; checkedAt:string;
}

/** Keep the provider's required HTML/CSS intact; reject active content rather than rewriting it. */
export function validateSearchSuggestions(html:string):boolean {
  if (!html || html.length>100000) return false;
  const doc=new DOMParser().parseFromString(html,'text/html');
  const tags=new Set(['style','div','span','a','svg','path','g','circle','rect','polygon','line','polyline','ellipse','title','defs','clippath','br','p','small','strong','b']);
  const safeUrl=(value:string) => {try {const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password;} catch {return false;}};
  for (const node of Array.from(doc.querySelectorAll('*'))) {
    const tag=node.tagName.toLowerCase();
    if (!tags.has(tag) && !['html','head','body'].includes(tag)) return false;
    for (const attr of Array.from(node.attributes)) {
      if (/^on/i.test(attr.name) || attr.name==='srcdoc') return false;
      if (['href','xlink:href','src'].includes(attr.name) && !attr.value.startsWith('#') && !safeUrl(attr.value)) return false;
      if (attr.name==='style' && /url\s*\(|@import|expression\s*\(|javascript:/i.test(attr.value)) return false;
    }
    if (tag==='style' && /url\s*\(|@import|expression\s*\(|javascript:/i.test(node.textContent || '')) return false;
  }
  return doc.querySelector('a[href]')!==null;
}

@Component({
  selector:'app-google-top-places',standalone:true,imports:[CommonModule],encapsulation:ViewEncapsulation.ShadowDom,
  template:`
    <section aria-label="Top 10 places to visit" class="top-places">
      <button type="button" (click)="load()" [disabled]="busy || disabled || destination.trim().length<2">{{ busy ? 'Searching Google…' : 'Top 10 places to visit' }}</button>
      <p class="note">Google Search-based suggestions with AI assistance; not an official Google ranking.</p>
      <p *ngIf="busy" role="status">Finding highlights for {{ destination }}…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <section *ngIf="result as data" aria-live="polite">
        <header><h3>Places to visit in {{ data.destination }}</h3><button type="button" (click)="close()">Close</button></header>
        <p class="answer">{{ data.text }}</p>
        <nav aria-label="Google Search answer sources"><a *ngFor="let source of data.sources; index as i" [href]="source.url" target="_blank" rel="noopener noreferrer">{{ i+1 }}. {{ source.title }}</a></nav>
        <div class="search-suggestions" [innerHTML]="suggestions"></div>
        <p class="note">Live suggestions · {{ data.checkedAt | date:'medium' }}. Check the linked sources before travelling.</p>
      </section>
    </section>`,
  styles:[`:host{display:block;margin:16px 0;font:inherit;color:inherit}.top-places{border:1px solid #d9e4dc;border-radius:14px;padding:16px;background:#fff}button{font:inherit;padding:9px 14px;border:1px solid #174a33;border-radius:20px;background:#174a33;color:white;cursor:pointer}button:disabled{opacity:.55;cursor:default}.note{font-size:12px;color:#55675b;margin:8px 0}header{display:flex;align-items:center;justify-content:space-between;gap:12px}h3{font-size:17px}.answer{white-space:pre-wrap;line-height:1.6}nav{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}a{color:#174a33;font-size:13px}.search-suggestions{margin-top:16px}section[aria-live]{margin-top:12px}`]
})
export class GoogleTopPlacesComponent implements OnChanges,OnDestroy {
  @Input() destination=''; @Input() disabled=false;
  private readonly http=inject(HttpClient);
  private readonly sanitizer=inject(DomSanitizer);
  private request?:Subscription;
  busy=false; error=''; result:GoogleTopPlacesResult|null=null; suggestions:SafeHtml|null=null;
  ngOnChanges():void {this.close();}
  load():void {
    if (this.busy || this.disabled || this.destination.trim().length<2) return;
    this.close();this.busy=true;
    this.request=this.http.post<GoogleTopPlacesResult>(`${environment.apiUrl}/discovery/top-places`,{destination:this.destination.trim()}).subscribe({
      next:result=>{
        this.busy=false;
        if (!validateSearchSuggestions(result.searchSuggestionsHtml)) {this.error='Google Search suggestions could not be displayed safely. Please try again.';return;}
        // Fixed Google API metadata, validated above; Shadow DOM preserves its CSS without framing or scripts.
        this.suggestions=this.sanitizer.bypassSecurityTrustHtml(result.searchSuggestionsHtml);
        this.result=result;
      },
      error:err=>{this.busy=false;this.error=err?.error?.message || err?.error?.detail || 'Top 10 suggestions are unavailable. Your regular places are still available.';}
    });
  }
  close():void {this.request?.unsubscribe();this.request=undefined;this.result=null;this.suggestions=null;this.error='';this.busy=false;}
  ngOnDestroy():void {this.close();}
}
