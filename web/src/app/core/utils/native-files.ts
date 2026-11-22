interface NativeFiles {
  shareFile(blob:Blob, name:string):Promise<void>;
  clearTemporaryFiles():Promise<void>;
}
function nativeFiles():NativeFiles|undefined {
  return (window as Window & { SuttruNative?:NativeFiles }).SuttruNative;
}
export function hasNativeFiles():boolean { return !!nativeFiles(); }
export async function shareNativeFile(blob:Blob,name:string):Promise<boolean> {
  const files=nativeFiles();
  if (!files) return false;
  await files.shareFile(blob,name);
  return true;
}
export function clearNativeFiles():void {
  void nativeFiles()?.clearTemporaryFiles().catch(()=>{});
}
