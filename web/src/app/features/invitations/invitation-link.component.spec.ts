import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { InvitationService } from '../../core/services/invitation.service';
import { InvitationLinkComponent } from './invitation-link.component';

describe('Invitation recipient recovery',()=>{
 it('keeps the invitation and retry action visible after a failed acceptance, then returns to the link after switching accounts',()=>{
  const invitation={id:1,tripId:10,tripName:'Ooty',inviterName:'Owner',role:'VIEWER',type:'EMAIL',status:'PENDING',expiresAt:'2027-01-01'};
  const auth={isAuthenticated:()=>true,logout:jasmine.createSpy().and.returnValue(of(void 0))};
  const service={getInvitationByToken:()=>of(invitation),acceptInvitationByToken:jasmine.createSpy().and.returnValues(throwError(()=>({error:{message:'This invitation was sent to a different email address'}})),of({...invitation,status:'ACCEPTED'}))};
  TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{paramMap:new Map([['token','abc-123']])}}},{provide:AuthService,useValue:auth},{provide:InvitationService,useValue:service}]});
  const router=TestBed.inject(Router);spyOnProperty(router,'url','get').and.returnValue('/invite/abc-123');
  const navigate=spyOn(router,'navigate').and.resolveTo(true);
  const fixture=TestBed.createComponent(InvitationLinkComponent);fixture.detectChanges();
  fixture.componentInstance.acceptInvitation();fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('different email address');
  expect(fixture.nativeElement.textContent).toContain('You’re invited to Ooty');
  expect(fixture.nativeElement.textContent).toContain('Accept invitation');
  fixture.componentInstance.switchAccount();
  expect(auth.logout).toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith(['/login'],{queryParams:{returnUrl:'/invite/abc-123'}});
  fixture.destroy();
 });
});
