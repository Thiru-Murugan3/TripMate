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
const dashboard={...trip,tripId:10,tripName:trip.name,totalExpenses:18450,remainingBudget:6550,budgetUtilizationPercentage:74,upcomingActivities:[{title:'Coaker’s Walk',date:'2027-11-13',time:'10:00',location:'Kodaikanal'}],bookings:[],documentCount:2,memberCount:4};
const summary={tripId:10,totalTripBudget:25000,totalExpenses:18450,remainingBudget:6550,budgetUtilizationPercentage:74,categoryBreakdown:{HOTEL:8000,FOOD:3450,TRANSPORT:5000,ACTIVITIES:2000},memberBalances:[],suggestedSettlements:[]};
const item={id:1,tripId:10,dayId:1,title:'Coaker’s Walk',location:'Kodaikanal',startTime:'10:00',endTime:'11:00',estimatedCost:100,description:'Sightseeing stroll'};
const days=[{id:1,tripId:10,dayNumber:1,dayDate:trip.startDate,title:'Explore Kodaikanal',items:[item]},{id:2,tripId:10,dayNumber:2,dayDate:'2027-11-14',title:'Lake and gardens',items:[]}];
function response(url){
  const p=new URL(url).pathname.replace(/^.*\/api\/v1/,'');
  if(p==='/users/me')return user;
  if(p==='/trips')return [trip,{...trip,id:11,name:'Coorg Adventure',destination:'Coorg',tripType:'FRIENDS'}];
  if(p==='/trips/10')return trip;
  if(p.endsWith('/dashboard'))return dashboard;
  if(p.endsWith('/weather'))return {destination:trip.destination,resolvedLocation:'Kodaikanal',available:true,message:'',generatedAt:'2027-11-12T10:00:00',days:[]};
  if(p.endsWith('/expenses/summary'))return summary;
  if(p.endsWith('/expenses'))return [{id:1,tripId:10,title:'Hill View Resort',category:'HOTEL',amount:8000,expenseDate:'2027-11-13',paidById:1,paidByName:user.name,splitType:'EQUAL',splits:[]}];
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
  const browser=await chromium.launch({executablePath:process.env.SUTTRU_CHROME || '/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await context.addInitScript(user=>{localStorage.setItem('tripmate_access_token','visual-review-fixture');localStorage.setItem('tripmate_user',JSON.stringify(user));},user);
    await context.route('**/api/v1/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response(route.request().url()))}));
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    const screens=[['home','/dashboard','.mobile-home'],['trips','/trips','.trip-card'],['expenses','/expenses','.trip-option'],['profile','/account','.account-menu'],['trip','/trips/10?tab=OVERVIEW','.trip-header'],['itinerary','/trips/10?tab=ITINERARY','.day-card'],['trip-expenses','/trips/10?tab=EXPENSES','.expense-card'],['documents','/trips/10?tab=DOCUMENTS','.documents-toolbar']];
    for(const [name,url,selector] of screens){
      await page.goto(origin+url);await page.locator(selector).first().waitFor();await page.waitForTimeout(300);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflows phone viewport`);
      await page.screenshot({path:path.join(output,name+'.png')});
    }
    await page.goto(origin+'/dashboard');await page.locator('.mobile-home').waitFor();
    await page.getByRole('link',{name:'Plan a new trip',exact:true}).click();await page.locator('.modal-content').waitFor();
    await page.screenshot({path:path.join(output,'create-trip.png')});
    await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/dashboard');await page.locator('.hero-section').waitFor();
    assert.equal(await page.locator('.mobile-navigation').isVisible(),false);
    await page.screenshot({path:path.join(output,'desktop-home.png')});
    await page.setViewportSize({width:390,height:844});await page.goto(origin+'/login');await page.locator('form').waitFor();await page.screenshot({path:path.join(output,'login.png')});
    assert.deepEqual(errors,[],'App errors during UI review');
    console.log('Mobile UI review passed; screenshots saved in '+output);
    await context.close();
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
