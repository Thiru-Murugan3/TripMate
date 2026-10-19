// Local visual review only: all account/API data below are fixtures, never live credentials.
const { chromium } = require(process.env.SUTTRU_PLAYWRIGHT || 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../dist/tripmate-web/browser');
const output = path.resolve(process.env.SUTTRU_SCREENSHOTS || 'mobile-ui-review');
fs.mkdirSync(output, { recursive: true });
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const server = http.createServer((req,res)=>{
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file = path.resolve(root,'.'+pathname);
  if (!file.startsWith(root+path.sep) && file !== root) { res.writeHead(403);return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if(path.extname(pathname)) {res.writeHead(404);return res.end();}
    file=path.join(root,'index.html');
  }
  res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const user={id:1,name:'Demo Traveller',email:'traveller@example.com',systemRole:'USER',status:'ACTIVE'};
const trip={id:10,name:'Kodaikanal Family Trip',destination:'Kodaikanal, Tamil Nadu',tripType:'FAMILY',startDate:'2027-11-13',endDate:'2027-11-16',travelerCount:4,budget:25000,status:'UPCOMING',ownerId:1,ownerName:user.name,userRole:'OWNER'};
const dashboard={...trip,tripId:10,tripName:trip.name,totalExpenses:18450,remainingBudget:6550,budgetUtilizationPercentage:74,upcomingActivities:[{activity:'Coaker’s Walk',date:'2027-11-13',time:'10:00',location:'Kodaikanal'}],bookings:[],documentCount:2,memberCount:4};
const summary={tripId:10,totalTripBudget:25000,totalExpenses:18450,remainingBudget:6550,budgetUtilizationPercentage:74,categoryBreakdown:{HOTEL:8000,FOOD:3450,TRANSPORT:5000,ACTIVITIES:2000},memberBalances:[{userId:1,userName:user.name,totalPaid:8000,totalOwed:4000,netBalance:4000},{userId:2,userName:'Trip member',totalPaid:0,totalOwed:4000,netBalance:-4000}],suggestedSettlements:[{fromUserId:2,fromUserName:'Trip member',toUserId:1,toUserName:user.name,amount:4000}]};
const item={tripadvisorLocationId:'legacy-1',id:1,tripId:10,dayId:1,title:'Coaker’s Walk',placeId:1,location:'Kodaikanal',startTime:'10:00',endTime:'11:00',estimatedCost:100,description:'Sightseeing stroll'};
const days=[{id:1,tripId:10,dayNumber:1,dayDate:trip.startDate,title:'Explore Kodaikanal',items:[item,{...item,id:2,placeId:2,title:'Kodaikanal Lake'}]},{id:2,tripId:10,dayNumber:2,dayDate:'2027-11-14',title:'Lake and gardens',items:[]}];
const savedPlace={id:1,tripId:10,name:'Coaker’s Walk',category:'ATTRACTION',latitude:10.235,longitude:77.492,estimatedCost:100};
const discoveryPlace={externalId:'wikidata:Q123',name:'Coaker’s Walk',category:'VIEWPOINT',saveCategory:'ATTRACTION',latitude:10.235,longitude:77.492,distanceKm:1.2,suggestedVisitMinutes:60,priceStatus:'UNKNOWN',sourceName:'Fixture source',sourceUrl:'https://example.com/place',imageGallery:[{url:'/assets/hero.jpg',sourcePage:'https://example.com/photo',license:'Visual fixture',attribution:'Test photo',exact:true,primary:true}]};
const discoveryResult={query:trip.destination,resolvedDestination:'Kodaikanal',latitude:10.235,longitude:77.492,radiusKm:25,category:'ALL',provider:'Visual fixture',attribution:'Internal review only',resultCount:2,totalPages:1,page:0,places:[discoveryPlace,{...discoveryPlace,externalId:'fixture:lake',name:'Kodaikanal Lake',category:'LAKE',distanceKm:2.4}]};
const invitation={id:1,tripId:10,tripName:trip.name,inviterId:1,inviterName:user.name,inviteeEmail:'friend@example.com',role:'PLANNER',status:'PENDING',type:'EMAIL',expiresAt:'2027-11-20T12:00:00',createdAt:'2027-11-12T12:00:00'};
let locationPhotoUrl='';
function response(url){
  const p=new URL(url).pathname.replace(/^.*\/api\/v1/,'');
  if(p==='/discovery/place-photos')return {images:[{url:locationPhotoUrl,sourcePage:'https://commons.wikimedia.org/wiki/File:Fixture-one.jpg',license:'Visual fixture',attribution:'Test photographer one',exact:true,primary:true},{url:locationPhotoUrl.replace('hero.jpg','kodaikanal.jpg'),sourcePage:'https://commons.wikimedia.org/wiki/File:Fixture-two.jpg',license:'Visual fixture',attribution:'Test photographer two',exact:true,primary:false}],message:'Internal visual fixture only',retryable:false};
  if(p==='/auth/login')return {accessToken:'visual-review-fixture',refreshToken:'visual-refresh-fixture',tokenType:'Bearer',expiresIn:900};
  if(p==='/users/me')return user;
  if(p==='/discovery/places' || p==='/discovery/top-places')return discoveryResult;
  if(p==='/notifications')return [{id:1,tripId:10,recipientId:1,title:'Your trip is coming up',message:'Check your itinerary and essential documents before departure.',type:'TRIP_REMINDER',read:false,createdAt:'2027-11-12T10:00:00'}];
  if(p.startsWith('/invitations/token/'))return invitation;
  if(p.endsWith('/invitations') || p==='/invitations/my')return [invitation];
  if(p.endsWith('/places'))return [savedPlace,{...savedPlace,id:2,name:'Kodaikanal Lake',latitude:10.238,longitude:77.489},{...savedPlace,id:3,name:'Hill View Resort',category:'HOTEL',latitude:10.239,longitude:77.49}];
  if(p.endsWith('/documents'))return [{id:1,tripId:10,fileName:'Hotel confirmation.pdf',documentType:'HOTEL_CONFIRMATION',fileSize:204800,uploadedById:1,uploadedByName:user.name,createdAt:'2027-11-12T10:00:00'}];
  if(p.endsWith('/bookings'))return [{id:1,tripId:10,providerName:'Hill View Resort',bookingType:'HOTEL',startDatetime:'2027-11-13T14:00:00',endDatetime:'2027-11-16T11:00:00',amount:8000,status:'CONFIRMED',currency:'INR',destination:'Kodaikanal'}];
  if(p==='/trips')return [trip,{...trip,id:11,name:'Coorg Adventure',destination:'Coorg',tripType:'FRIENDS'}];
  if(p==='/trips/10')return trip;
  if(p.endsWith('/dashboard'))return dashboard;
  if(p.endsWith('/weather'))return {destination:trip.destination,resolvedLocation:'Kodaikanal',available:true,message:'',generatedAt:'2027-11-12T10:00:00',days:[]};
  if(p.endsWith('/expenses/summary'))return summary;
  if(p.endsWith('/expenses'))return [{id:1,tripId:10,title:'Hill View Resort',category:'HOTEL',amount:8000,expenseDate:'2027-11-13',paidById:1,paidByName:user.name,splitType:'EQUAL',splits:[{id:1,userId:1,userName:user.name,shareAmount:4000,settlementStatus:'PENDING'},{id:2,userId:2,userName:'Trip member',shareAmount:4000,settlementStatus:'PENDING'}]}];
  if(p.endsWith('/itinerary'))return {tripId:10,totalDays:2,totalActivities:1,totalEstimatedCost:100,days};
  if(p.endsWith('/members'))return [{id:1,tripId:10,userId:1,userName:user.name,userEmail:user.email,role:'OWNER',memberStatus:'ACTIVE'}];
  if(p.endsWith('/timeline'))return {tripId:10,tripName:trip.name,destination:trip.destination,startDate:trip.startDate,endDate:trip.endDate,totalEvents:1,transportCount:0,stayCount:0,activityCount:1,mealCount:0,conflictCount:0,days:[{dayNumber:1,date:trip.startDate,formattedDate:'Sat, 13 Nov 2027',title:'Explore Kodaikanal',hasConflict:false,items:[{id:'activity:1',sourceType:'ITINERARY_ITEM',sourceId:1,itemType:'ACTIVITY',category:'ACTIVITY',title:item.title,location:item.location,timeFormatted:'10:00 AM',icon:'attractions',badgeColor:'emerald',conflict:false}]}]};
  if(p.endsWith('/unread/count'))return {count:2};
  if(p.includes('/reservation-imports/address'))return {enabled:false};
  return [];
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  locationPhotoUrl=origin+'/assets/images/hero.jpg';
  const browser=await chromium.launch({executablePath:process.env.SUTTRU_CHROME || '/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await context.addInitScript(user=>{if(['/register','/verify-email','/forgot-password','/reset-password','/login'].includes(location.pathname)){localStorage.removeItem('tripmate_access_token');localStorage.removeItem('tripmate_user');}else{localStorage.setItem('tripmate_access_token','visual-review-fixture');localStorage.setItem('tripmate_user',JSON.stringify(user));}},user);
    const providerRequests=[];context.on('request',request=>{if(request.url().includes('/discovery/tripadvisor'))providerRequests.push(request.url());});
    await context.route('**/api/v1/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response(route.request().url()))}));
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    const screens=[['home','/dashboard','.mobile-home'],['trips','/trips','.trip-card'],['expenses','/expenses','.trip-option'],['profile','/account','.account-menu'],['trip','/trips/10?tab=OVERVIEW','.trip-header'],['itinerary','/trips/10?tab=ITINERARY','.day-card'],['trip-expenses','/trips/10?tab=EXPENSES','.expense-card'],['documents','/trips/10?tab=DOCUMENTS','.document-card'],['timeline','/trips/10?tab=TIMELINE','.timeline-event-card'],['explore','/trips/10?tab=EXPLORE','app-combined-places .card'],['legacy-places-link','/trips/10?tab=PLACES','app-combined-places .card'],['bookings','/trips/10?tab=BOOKINGS','.booking-card'],['members','/trips/10?tab=MEMBERS','.member-card'],['booking-search','/trips/10/bookings/new','.booking-type-grid'],['notifications','/notifications','.notification-card'],['invitations','/invitations','.invite-card'],['share','/trips/10/share','.invite-card'],['invitation-link','/invite/fixture-token','.invite-summary'],['register','/register','form'],['verify-email','/verify-email?email=traveller%40example.com','.otp-boxes-container'],['forgot-password','/forgot-password','form'],['reset-password','/reset-password?token=fixture','form']];
    for(const [name,url,selector] of screens){
      await page.goto(origin+url);await page.locator(selector).first().waitFor();await page.waitForTimeout(300);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflows phone viewport`);
      if(name==='legacy-places-link'){
        assert.equal(new URL(page.url()).searchParams.get('tab'),'EXPLORE');
        assert.equal(await page.locator('.tab-btn').filter({hasText:/^\s*Places\s*$/}).count(),0);
      }
      await page.screenshot({animations:'disabled',path:path.join(output,name+'.png')});
    }
    // Native camera fixture: selecting a photo must stop at review, without a POST.
    await page.addInitScript(()=>{
      const read=()=>JSON.parse(localStorage.getItem('fixture-native-grants')||'{"photos":"denied","camera":"denied","location":"denied"}');
      window.SuttruDevice={
        permissionSetup:async()=>{const state=read();return {completed:localStorage.getItem('fixture-native-setup-v2')==='done',photoSelection:state.photos==='limited',camera:state.camera,location:state.location};},
        requestPermission:async feature=>{
          const calls=JSON.parse(localStorage.getItem('fixture-native-requests')||'[]');calls.push(feature);localStorage.setItem('fixture-native-requests',JSON.stringify(calls));
          window.fixturePermissionActive=(window.fixturePermissionActive||0)+1;window.fixturePermissionMax=Math.max(window.fixturePermissionMax||0,window.fixturePermissionActive);
          await new Promise(r=>setTimeout(r,25));const state=read();state[feature]=feature==='photos'?'limited':'granted';localStorage.setItem('fixture-native-grants',JSON.stringify(state));window.fixturePermissionActive--;return true;
        },
        completePermissionSetup:async()=>localStorage.setItem('fixture-native-setup-v2','done'),
        openPermissionSettings:async()=>localStorage.setItem('fixture-native-settings','opened'),
        takeDocumentPhoto:async()=>new File(['camera fixture'],'camera-review.jpg',{type:'image/jpeg'}),
        pickDocumentPhoto:async()=>new File(['gallery fixture'],'gallery-review.jpg',{type:'image/jpeg'})
      };
    });
    await page.goto(origin+'/login?returnUrl='+encodeURIComponent('/trips/10?tab=DOCUMENTS'));await page.locator('form').waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-native-requests')),null,'permissions started before login');
    await page.locator('#email').fill('traveller@example.com');await page.locator('#password').fill('fixture-password-only');
    await page.getByRole('button',{name:'Sign In to Account',exact:true}).click();
    await page.locator('.document-card').waitFor();
    await page.waitForFunction(()=>localStorage.getItem('fixture-native-setup-v2')==='done');
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('fixture-native-requests'))),['photos','camera','location']);
    assert.equal(await page.evaluate(()=>window.fixturePermissionMax),1,'permission requests overlapped');
    assert.equal(await page.locator('dialog[data-device-permissions]').count(),0,'web imitation of permission dialog remains');
    await page.screenshot({animations:'disabled',path:path.join(output,'post-login-permissions-complete.png')});
    await page.reload();await page.locator('.document-card').waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fixture-native-requests')).length),3,'setup repeated after restart');
    await page.goto(origin+'/account');await page.getByRole('button',{name:/App permissions/}).click();
    await page.waitForFunction(()=>localStorage.getItem('fixture-native-settings')==='opened');
    await page.goto(origin+'/trips/10?tab=DOCUMENTS');await page.locator('.document-card').waitFor();
    let documentUploads=0;const trackUpload=request=>{if(request.method()==='POST' && new URL(request.url()).pathname.endsWith('/documents'))documentUploads++;};
    page.on('request',trackUpload);
    await page.getByRole('button',{name:/Upload Document/}).click();
    await page.getByRole('button',{name:'Take document photo',exact:true}).click();
    await page.locator('.selected-file strong').filter({hasText:'camera-review.jpg'}).waitFor();
    assert.equal(documentUploads,0,'camera capture uploaded without review');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'camera review overflows phone viewport');
    await page.screenshot({animations:'disabled',path:path.join(output,'document-camera-review.png')});
    await page.getByRole('button',{name:'Choose photos',exact:true}).click();
    await page.locator('.selected-file strong').filter({hasText:'gallery-review.jpg'}).waitFor();
    assert.equal(documentUploads,0,'gallery photo uploaded without review');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'gallery review overflows phone viewport');
    await page.screenshot({animations:'disabled',path:path.join(output,'document-gallery-review.png')});
    page.off('request',trackUpload);
    await page.goto(origin+'/trips/10?tab=TIMELINE');await page.locator('.mobile-offline-toggle').waitFor();
    await page.locator('.mobile-offline-toggle').click();await page.locator('.offline-options.mobile-expanded').waitFor();
    await page.screenshot({animations:'disabled',path:path.join(output,'offline-access.png')});
    await page.goto(origin+'/trips/10?tab=EXPENSES');await page.locator('.expense-card').waitFor();
    await page.locator('.expense-card').scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:path.join(output,'expense-list.png')});
    await page.getByRole('button',{name:'Balances & settlements',exact:true}).click();
    await page.locator('.mobile-balances .expense-sidebar').waitFor();
    assert.equal(await page.locator('.expense-list-column').isVisible(),false);
    await page.screenshot({animations:'disabled',path:path.join(output,'expense-balances.png')});
    await page.getByRole('button',{name:'Spending',exact:true}).click();
    await page.locator('.expense-toolbar button').click();await page.locator('.modal').waitFor();
    await page.screenshot({animations:'disabled',path:path.join(output,'expense-entry.png')});
    await page.goto(origin+'/trips/10?tab=ITINERARY');await page.locator('.mobile-route-toggle').waitFor();
    await page.locator('.route-planner-card.mobile-route-open').waitFor();
    await page.locator('app-day-route-map .sightseeing-number').first().waitFor();
    assert.deepEqual(await page.locator('.day-route-card').first().locator('.numbered-stops li span').evaluateAll(elements=>elements.map(e=>e.firstChild.textContent.trim())),['Hill View Resort','Kodaikanal Lake','Coaker’s Walk','Hill View Resort']);
    assert.equal(await page.locator('app-day-route-map').first().locator('.sightseeing-number').count(),3);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'route map overflows phone viewport');
    await page.screenshot({animations:'disabled',path:path.join(output,'itinerary-route-tools.png')});
    await page.goto(origin+'/trips/10?tab=EXPLORE');await page.locator('app-combined-places .card').first().waitFor();
    await page.locator('app-combined-places .card').first().scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:path.join(output,'explore-results.png')});
    assert.equal(await page.getByRole('button',{name:'Tripadvisor',exact:true}).count(),0);
    assert.equal(await page.locator('app-combined-places .source-notes').count(),0);
    assert.equal(await page.getByText('Free, source-based highlights',{exact:false}).count(),0);
    assert.equal(providerRequests.length,0,'removed provider still receives requests');
    const gallery=page.locator('app-combined-places app-place-photo-gallery').first();
    await gallery.getByRole('button',{name:'Next photo',exact:true}).waitFor();
    await gallery.getByRole('button',{name:'Next photo',exact:true}).click();
    await gallery.locator('figcaption').filter({hasText:'Test photographer two'}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'photo gallery overflows phone viewport');
    await page.screenshot({animations:'disabled',path:path.join(output,'explore-second-photo.png')});
    await page.getByRole('button',{name:'Top 10 places to visit',exact:true}).click();await page.locator('app-top-places li').first().waitFor();
    await page.locator('app-top-places input[type=checkbox]').first().check();await page.locator('app-top-places .selection-actions').waitFor();
    await page.screenshot({animations:'disabled',path:path.join(output,'top-places-selected.png')});
    await page.goto(origin+'/trips');await page.locator('.trip-card').first().waitFor();
    await page.getByRole('button',{name:'Filters',exact:true}).click();
    await page.locator('.select-field select').nth(1).selectOption('FRIENDS');
    await page.waitForFunction(()=>document.querySelectorAll('.trip-card').length===1);
    assert.equal(await page.locator('.trip-card').count(),1);
    await page.getByRole('button',{name:'Clear',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.trip-card').length===2);
    assert.equal(await page.locator('.trip-card').count(),2);
    await page.goto(origin+'/dashboard');await page.locator('.mobile-home').waitFor();
    await page.getByRole('link',{name:'Plan a new trip',exact:true}).click();await page.locator('.modal-content').waitFor();
    await page.screenshot({animations:'disabled',path:path.join(output,'create-trip.png')});
    await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/dashboard');await page.locator('.hero-section').waitFor();
    assert.equal(await page.locator('.mobile-navigation').isVisible(),false);
    await page.screenshot({animations:'disabled',path:path.join(output,'desktop-home.png')});
    await page.setViewportSize({width:390,height:844});await page.goto(origin+'/login');await page.locator('form').waitFor();await page.screenshot({animations:'disabled',path:path.join(output,'login.png')});
    for(const width of [320,360,454,760]) {
      await page.setViewportSize({width,height:800});
      for(const [url,selector] of [['/trips/10?tab=EXPLORE','app-combined-places .card'],['/trips/10?tab=EXPENSES','.expense-card'],['/trips/10/share','.method-grid']]) {
        await page.goto(origin+url);await page.locator(selector).first().waitFor();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${url} overflows ${width}px`);
      }
    }
    assert.deepEqual(errors,[],'App errors during UI review');
    console.log('Mobile UI review passed; screenshots saved in '+output);
    await context.close();
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
