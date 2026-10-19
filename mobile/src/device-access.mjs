// Genuine Android runtime dialogs; no web imitation or blanket startup request.
export function createDeviceAccess({camera,location,permissions,readPhoto,makeFile,preferences}) {
 const allowed=(state,feature)=>feature==='photos'?['full','limited'].includes(state.photos):state[feature]==='granted';
 async function requestPermission(feature){
  if(!['photos','camera','location'].includes(feature))throw new Error('Unknown permission.');
  const method={photos:'requestPhotos',camera:'requestCamera',location:'requestLocation'}[feature];
  return allowed(await permissions[method](),feature);
 }
 async function ensure(feature){
  if(allowed(await permissions.status(),feature))return;
  if(!await requestPermission(feature))throw new Error(`${feature==='photos'?'Photo':feature==='camera'?'Camera':'Location'} access is off. Open Profile > App permissions or Android Settings > Apps > Suttru > Permissions.`);
 }
 async function photoFrom(source){
  let photo;
  try{photo=await camera.getPhoto({source,resultType:'uri',quality:90,width:2000,height:2000,saveToGallery:false,allowEditing:false});}
  catch(error){if(/cancelled|canceled/i.test(error?.message||''))return null;throw new Error('Unable to open photos or camera. Check App permissions and try again.');}
  const blob=await readPhoto(photo);
  if(!blob.size||blob.size>10*1024*1024)throw new Error('The photo must be under 10 MB. Retake it or choose a smaller file.');
  return makeFile(blob,`trip-document-${Date.now()}.jpg`);
 }
 return {
  async permissionSetup(){
   const [done,state]=await Promise.all([preferences.get({key:'post-login-native-permissions-v2'}),permissions.status()]);
   return {completed:done.value==='done',photoSelection:allowed(state,'photos'),photoAccess:state.photos,camera:state.camera,location:state.location};
  },
  requestPermission,
  async completePermissionSetup(){await preferences.set({key:'post-login-native-permissions-v2',value:'done'});},
  async openPermissionSettings(){await permissions.openSettings();},
  async pickDocumentPhoto(){await ensure('photos');return photoFrom('PHOTOS');},
  async takeDocumentPhoto(){await ensure('camera');return photoFrom('CAMERA');},
  async currentPosition(){
   await ensure('location');
   try{return await location.getCurrentPosition({enableHighAccuracy:false,timeout:10000,maximumAge:300000});}
   catch{throw new Error('Location is unavailable. Turn on Location or choose a place manually.');}
  }
 };
}
