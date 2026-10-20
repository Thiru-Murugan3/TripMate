import {HttpInterceptorFn} from '@angular/common/http';
import {timeout} from 'rxjs';
import {environment} from '../../../environments/environment';

export function isApiRequest(url:string):boolean {
  try {
    const base=new URL(environment.apiUrl,window.location.origin),request=new URL(url,window.location.origin);
    const path=base.pathname.replace(/\/$/,'');
    return request.origin===base.origin&&(request.pathname===path||request.pathname.startsWith(path+'/'));
  } catch {return false;}
}

// Keep slow discovery providers and document transfers independent of ordinary page loading.
export const apiTimeoutInterceptor:HttpInterceptorFn=(request,next)=>{
  if(!isApiRequest(request.url))return next(request);
  const longRequest=/\/(discovery|documents)(\/|\?|$)/.test(request.url)||request.body instanceof FormData;
  return next(request).pipe(timeout({each:longRequest?120000:45000}));
};
