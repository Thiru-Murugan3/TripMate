import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripService } from '../../core/services/trip.service';
import { Trip } from '../../core/models/trip.model';

@Component({selector:'app-expense-trips',standalone:true,imports:[CommonModule,RouterLink],template:`
  <main><header><span class="eyebrow">GROUP SPENDING</span><h1>Trip expenses</h1><p>Choose a trip to track costs, split expenses and settle up.</p></header>
    <p *ngIf="loading" role="status">Loading your trips…</p>
    <section *ngIf="error" class="state" role="alert"><p>{{error}}</p><button (click)="load()">Try again</button></section>
    <section *ngIf="!loading && !error && !trips.length" class="state"><h2>Your next journey starts here</h2><p>Create a trip to begin tracking expenses together.</p><a routerLink="/dashboard" [queryParams]="{createTrip:1}">Plan a trip</a></section>
    <div class="trip-list" *ngIf="!loading && !error">
      <a *ngFor="let trip of trips" class="trip-option" [routerLink]="['/trips',trip.id]" [queryParams]="{tab:'EXPENSES'}"><span class="expense-icon"><img src="assets/mobile/expense.svg" alt="" /></span><div><strong>{{trip.name}}</strong><span>{{trip.destination}}</span><small>Budget {{trip.budget | currency:'INR':'symbol':'1.0-0'}} · {{trip.travelerCount}} travellers</small></div><span class="arrow" aria-hidden="true">›</span></a>
    </div>
  </main>`,styles:[`
  :host{display:block;min-height:100vh;background:#f8fafc;color:#0f172a}main{max-width:760px;margin:auto;padding:24px 20px;overflow-wrap:anywhere}h1{font-size:24px;margin:6px 0 8px;letter-spacing:-.03em}.eyebrow{color:#2563eb;font-size:11px;letter-spacing:.1em;font-weight:800}header p,.state p{color:#64748b;font-size:14px;line-height:1.6}.trip-list{display:grid;gap:12px;margin-top:24px}.trip-option{display:flex;gap:12px;align-items:center;padding:16px;border-radius:16px;background:white;text-decoration:none;color:inherit;box-shadow:0 4px 16px #2563eb08;min-height:88px}.expense-icon{display:grid;place-items:center;width:44px;height:44px;flex-shrink:0;background:#f0fdfa;border-radius:12px}.trip-option>div{min-width:0;display:grid;gap:4px;flex:1}.trip-option strong{font-size:15px}.trip-option div>span,.trip-option small{color:#64748b;font-size:12px}.arrow{color:#94a3b8}.state{background:white;padding:20px;border-radius:16px;margin-top:24px}.state h2{font-size:18px}button,.state a{display:inline-flex;align-items:center;min-height:44px;padding:10px 16px;border-radius:10px;border:0;background:#2563eb;color:white;text-decoration:none;cursor:pointer;font:inherit}
  `]})
export class ExpenseTripsComponent implements OnInit {
  private readonly tripsService=inject(TripService);trips:Trip[]=[];loading=true;error='';
  ngOnInit():void{this.load();}
  load():void{this.loading=true;this.error='';this.tripsService.getMyTrips().subscribe({next:trips=>{this.trips=trips;this.loading=false;},error:()=>{this.error='Unable to load trips. Please try again.';this.loading=false;}});}
}
