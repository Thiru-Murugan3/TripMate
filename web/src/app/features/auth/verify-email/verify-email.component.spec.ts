import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { VerifyEmailComponent } from './verify-email.component';

describe('OTP verification navigation', () => {
  function setup(returnUrl?:string) {
    const response=new Subject<any>();
    const verifyEmail=jasmine.createSpy().and.returnValue(response);
    TestBed.configureTestingModule({providers:[provideRouter([]),
      {provide:ActivatedRoute,useValue:{snapshot:{queryParams:{email:'new@example.com',returnUrl}}}},
      {provide:AuthService,useValue:{verifyEmail}}]});
    const fixture=TestBed.createComponent(VerifyEmailComponent);
    const navigate=spyOn(TestBed.inject(Router),'navigateByUrl').and.resolveTo(true);
    fixture.componentInstance.email='new@example.com';
    fixture.componentInstance.otpDigits=['1','2','3','4','5','6'];
    return {fixture,response,verifyEmail,navigate,component:fixture.componentInstance};
  }
  it('opens Home after session initialization and prevents repeated verification submissions', () => {
    const t=setup();
    t.component.onVerifySubmit(new Event('submit'));
    t.component.onVerifySubmit(new Event('submit'));
    expect(t.verifyEmail).toHaveBeenCalledTimes(1);expect(t.navigate).not.toHaveBeenCalled();
    t.response.next({message:'Verified'});
    expect(t.navigate).toHaveBeenCalledWith('/dashboard',{replaceUrl:true});
    t.fixture.destroy();
  });
  it('returns a new account to the original invitation after verification', () => {
    const t=setup('/invite/abc-123');t.component.onVerifySubmit(new Event('submit'));
    t.response.next({message:'Verified'});
    expect(t.navigate).toHaveBeenCalledWith('/invite/abc-123',{replaceUrl:true});t.fixture.destroy();
  });
  it('stays on verification with an actionable error when OTP is rejected', () => {
    const t=setup();t.component.onVerifySubmit(new Event('submit'));
    t.response.error(new HttpErrorResponse({status:400,error:{message:'OTP expired. Resend code.'}}));
    expect(t.navigate).not.toHaveBeenCalled();expect(t.component.isLoading).toBeFalse();
    expect(t.component.errorMessage).toContain('OTP expired');t.fixture.destroy();
  });
});
