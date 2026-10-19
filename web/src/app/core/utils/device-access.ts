interface DeviceAccess {
  takeDocumentPhoto():Promise<File|null>;
  currentPosition():Promise<{coords:{latitude:number;longitude:number}}>;
}
function device():DeviceAccess|undefined {return (window as Window & {SuttruDevice?:DeviceAccess}).SuttruDevice;}
export function hasNativeCamera():boolean {return !!device();}
export async function takeDocumentPhoto():Promise<File|null> {return device()?.takeDocumentPhoto() ?? null;}
export async function currentPosition():Promise<{coords:{latitude:number;longitude:number}}> {
  const native=device();if(native)return native.currentPosition();
  if(!navigator.geolocation)throw new Error('Current location is not supported. Choose a place manually.');
  return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,error=>reject(new Error(error.code===1?'Location permission was denied. Allow it in browser settings, or choose a place manually.':'Unable to find your current location. Please try again.')),{enableHighAccuracy:false,timeout:10000,maximumAge:300000}));
}
