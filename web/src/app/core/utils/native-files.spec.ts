import { clearNativeFiles, hasNativeFiles, shareNativeFile } from './native-files';
describe('Optional Android file handling',()=>{
  const target=window as any;
  afterEach(()=>{delete target.SuttruNative;});
  it('preserves the browser flow when no native runtime is present',async()=>{
    expect(hasNativeFiles()).toBeFalse();expect(await shareNativeFile(new Blob(['ticket']),'ticket.pdf')).toBeFalse();expect(()=>clearNativeFiles()).not.toThrow();
  });
  it('shares the actual document and clears native temporary files on logout',async()=>{
    const shareFile=jasmine.createSpy().and.resolveTo(),clearTemporaryFiles=jasmine.createSpy().and.resolveTo();
    target.SuttruNative={shareFile,clearTemporaryFiles};const blob=new Blob(['ticket']);
    expect(await shareNativeFile(blob,'ticket.pdf')).toBeTrue();expect(shareFile).toHaveBeenCalledWith(blob,'ticket.pdf');
    clearNativeFiles();expect(clearTemporaryFiles).toHaveBeenCalled();
  });
  it('reports native failures rather than silently pretending the document opened',async()=>{
    target.SuttruNative={shareFile:()=>Promise.reject(new Error('device unavailable'))};
    await expectAsync(shareNativeFile(new Blob(),'ticket.pdf')).toBeRejectedWithError('device unavailable');
  });
});
