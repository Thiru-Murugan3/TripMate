import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GoogleTopPlacesComponent, validateSearchSuggestions } from './google-top-places.component';

const response={destination:'Ooty, Tamil Nadu, India',text:'1. Ooty Lake\n2. Botanical Garden',sources:[{title:'Tourism',url:'https://tourism.example/ooty'}],searchSuggestionsHtml:'<style>.chip {color:green}</style><a class="chip" href="https://www.google.com/search?q=Ooty">Search Ooty</a>',checkedAt:'2026-10-17T10:00:00Z'};
describe('Google Top 10 places',()=>{
  let http:HttpTestingController;
  beforeEach(()=>{TestBed.configureTestingModule({imports:[GoogleTopPlacesComponent],providers:[provideHttpClient(),provideHttpClientTesting()]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());
  it('only requests after a click and displays the complete answer, sources and original suggestions inside Explore',()=>{
    const fixture=TestBed.createComponent(GoogleTopPlacesComponent);fixture.componentRef.setInput('destination','Ooty');fixture.detectChanges();http.expectNone(r=>r.url.includes('top-places'));
    fixture.nativeElement.shadowRoot.querySelector('button').click();
    const req=http.expectOne(r=>r.url.endsWith('/discovery/top-places'));expect(req.request.method).toBe('POST');expect(req.request.body).toEqual({destination:'Ooty'});req.flush(response);fixture.detectChanges();
    const root=fixture.nativeElement.shadowRoot;
    expect(root.querySelector('.answer').textContent.trim()).toBe(response.text);
    expect(root.querySelectorAll('nav a').length).toBe(1);expect(root.querySelector('.search-suggestions style')).not.toBeNull();
    expect(root.querySelector('.search-suggestions a').getAttribute('href')).toBe('https://www.google.com/search?q=Ooty');
    expect(root.querySelector('iframe')).toBeNull();fixture.destroy();
  });
  it('clears results and cancels pending requests when the destination changes',()=>{
    const fixture=TestBed.createComponent(GoogleTopPlacesComponent);fixture.componentRef.setInput('destination','Ooty');fixture.detectChanges();fixture.componentInstance.load();
    const req=http.expectOne(r=>r.url.endsWith('/discovery/top-places'));fixture.componentRef.setInput('destination','Jaipur');fixture.detectChanges();
    expect(req.cancelled).toBeTrue();expect(fixture.componentInstance.result).toBeNull();expect(fixture.componentInstance.busy).toBeFalse();fixture.destroy();
  });
  it('retains the existing discovery UI when Google is unavailable and permits retry',()=>{
    const fixture=TestBed.createComponent(GoogleTopPlacesComponent);fixture.componentRef.setInput('destination','Ooty');fixture.detectChanges();fixture.componentInstance.load();
    http.expectOne(r=>r.url.endsWith('/discovery/top-places')).flush({message:'Not available yet'},{status:503,statusText:'Unavailable'});fixture.detectChanges();
    expect(fixture.nativeElement.shadowRoot.textContent).toContain('Not available yet');expect(fixture.componentInstance.result).toBeNull();
    fixture.componentInstance.load();http.expectOne(r=>r.url.endsWith('/discovery/top-places')).flush(response);expect(fixture.componentInstance.result?.text).toBe(response.text);fixture.destroy();
  });
  it('never displays the answer without safe required Search Suggestions',()=>{
    const fixture=TestBed.createComponent(GoogleTopPlacesComponent);fixture.componentRef.setInput('destination','Ooty');fixture.detectChanges();fixture.componentInstance.load();
    http.expectOne(r=>r.url.endsWith('/discovery/top-places')).flush({...response,searchSuggestionsHtml:'<script>alert(1)</script>'});
    expect(fixture.componentInstance.result).toBeNull();expect(fixture.componentInstance.error).toContain('safely');fixture.destroy();
  });
  it('prevents duplicate requests while loading or saving',()=>{
    const fixture=TestBed.createComponent(GoogleTopPlacesComponent);fixture.componentRef.setInput('destination','Ooty');fixture.detectChanges();fixture.componentInstance.load();fixture.componentInstance.load();
    http.expectOne(r=>r.url.endsWith('/discovery/top-places')).flush(response);
    fixture.componentRef.setInput('disabled',true);fixture.detectChanges();fixture.componentInstance.load();http.expectNone(r=>r.url.endsWith('/discovery/top-places'));fixture.destroy();
  });
  it('rejects active HTML and unsafe links without modifying valid Google CSS/markup',()=>{
    expect(validateSearchSuggestions(response.searchSuggestionsHtml)).toBeTrue();
    for(const html of ['<a href="javascript:alert(1)">Bad</a>','<a href="https://google.com" onclick="alert(1)">Bad</a>','<iframe src="https://google.com"></iframe>','<style>@import "https://bad.example";</style><a href="https://google.com">Bad</a>','<svg><animate onbegin="alert(1)"></animate></svg>']) expect(validateSearchSuggestions(html)).toBeFalse();
  });
});
