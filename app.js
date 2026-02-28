//=========================
// DayNight Vending App.js
// Offline-first, AI + ERP
// Includes inventory stock update feature
//=========================

// =======================
// IndexedDB Setup
// =======================
let db;
const request = indexedDB.open('DayNightDB', 1);

request.onerror = e => console.error('DB Error', e);
request.onsuccess = e => {
  db = e.target.result;
  initializeApp();
};

request.onupgradeneeded = e => {
  db = e.target.result;
  db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
  db.createObjectStore('drivers', { keyPath: 'id', autoIncrement: true });
  db.createObjectStore('routes', { keyPath: 'id', autoIncrement: true });
  db.createObjectStore('forms', { keyPath: 'id', autoIncrement: true });
};

// =======================
// IndexedDB Helpers
// =======================
function getTransaction(storeName, mode='readonly'){ return db.transaction(storeName, mode).objectStore(storeName); }
function addData(store, data){ return new Promise(r=>getTransaction(store,'readwrite').add(data).onsuccess=r); }
function updateData(store, data){ return new Promise(r=>getTransaction(store,'readwrite').put(data).onsuccess=r); }
function getAllData(store){ return new Promise(r=>{ const arr=[]; const cursor=getTransaction(store).openCursor(); cursor.onsuccess=e=>{const c=e.target.result;if(c){arr.push(c.value);c.continue();}else r(arr);}; }); }

// =======================
// Initialize App
// =======================
async function initializeApp(){
  const inv = await getAllData('inventory');
  if(inv.length === 0){
    await addData('inventory',{name:'Dumb Dumbs', cost:0.04, priceSingle:0.5, priceBundle:0.33, quantity:0});
  }
  renderInventory();
  renderRoutesDropdowns();
  renderDriverLeaderboard();
  renderForms();
  populateInventoryDropdown(); // new
}

// =======================
// INVENTORY
// =======================
async function renderInventory(){
  const inv = await getAllData('inventory');
  const tbody = document.querySelector('#inventoryTable tbody');
  tbody.innerHTML = '';
  inv.forEach(i=>{
    const profit = ((i.priceSingle - i.cost) * i.quantity).toFixed(2);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i.name}</td><td>$${i.cost}</td><td>$${i.priceSingle}</td><td>${i.quantity}</td><td>$${profit}</td><td>${i.quantity>0?'OK':'Restock Needed'}</td>`;
    tbody.appendChild(tr);
  });
}

// =======================
// INVENTORY DROPDOWN & STOCK UPDATE
// =======================
async function populateInventoryDropdown(){
  const inventory = await getAllData('inventory');
  const select = document.getElementById('inventorySelect');
  if(!select) return;
  select.innerHTML = '<option value="">--Select Item--</option>';
  inventory.forEach(i => {
    const opt = document.createElement('option');
    opt.value = i.id;
    opt.textContent = `${i.name} (Qty: ${i.quantity})`;
    select.appendChild(opt);
  });
}

async function addInventoryStock(){
  const select = document.getElementById('inventorySelect');
  const qtyInput = document.getElementById('inventoryAddQty');
  const itemId = parseInt(select.value);
  const addQty = parseInt(qtyInput.value);

  if(isNaN(itemId) || isNaN(addQty)) return alert('Select item and enter quantity');

  const inventory = await getAllData('inventory');
  const item = inventory.find(i => i.id === itemId);
  if(item){
    item.quantity += addQty;
    await updateData('inventory', item);
    renderInventory();
    populateInventoryDropdown(); // refresh dropdown to show updated qty
    qtyInput.value = '';
  }
}

// =======================
// FINANCE
// =======================
function calculateFinance(){
  const spent = parseFloat(document.getElementById('moneySpent').value)||0;
  const earned = parseFloat(document.getElementById('moneyEarned').value)||0;
  const profit = (earned-spent).toFixed(2);
  document.getElementById('financeResult').innerHTML=`Profit: $${profit}`;
}

// =======================
// DRIVERS
// =======================
async function addDriver(name){
  if(!name) return alert('Enter driver name');
  await addData('drivers',{name, routesCompleted:[]});
  renderDriverLeaderboard();
}

async function recordRoute(driverId, routeName, profit, gasCost){
  const drivers = await getAllData('drivers');
  const driver = drivers.find(d=>d.id===driverId);
  if(driver){
    driver.routesCompleted.push({routeName, profit, gasCost});
    await updateData('drivers',driver);
    renderDriverLeaderboard();
  }
}

// =======================
// DRIVER LEADERBOARD & EFFICIENCY
// =======================
async function renderDriverLeaderboard(){
  const drivers = await getAllData('drivers');
  const leaderboard = document.getElementById('driverLeaderboard');
  leaderboard.innerHTML = '';
  const efficiencyPanel = document.getElementById('driverEfficiency');
  efficiencyPanel.innerHTML='';

  drivers.map(d=>{
    const totalProfit = d.routesCompleted.reduce((sum,r)=>sum+(r.profit||0),0);
    const avgGasCost = d.routesCompleted.length?d.routesCompleted.reduce((sum,r)=>sum+(r.gasCost||0),0)/d.routesCompleted.length:0.01;
    const efficiency = totalProfit / (d.routesCompleted.length||1) / avgGasCost;
    return {...d,totalProfit,efficiency};
  }).sort((a,b)=>b.totalProfit - a.totalProfit)
    .forEach((d,i)=>{
      const div=document.createElement('div');
      div.textContent=`${i+1}. ${d.name} | Profit: $${d.totalProfit.toFixed(2)} | Routes: ${d.routesCompleted.length}`;
      leaderboard.appendChild(div);

      const div2 = document.createElement('div');
      div2.textContent=`${i+1}. ${d.name} | Efficiency Score: ${d.efficiency.toFixed(2)}`;
      efficiencyPanel.appendChild(div2);
    });
}

// =======================
// ROUTES
// =======================
async function createNewRoute(){
  const name = document.getElementById('newRouteName').value;
  if(!name) return alert('Enter route name');
  await addData('routes',{routeName:name, lat:0, lng:0, profit:0});
  renderRoutesDropdowns();
}

async function renderRoutesDropdowns(){
  const routes = await getAllData('routes');
  const routeSelects = ['routeSelect','gasRouteSelect'];
  routeSelects.forEach(selId=>{
    const sel = document.getElementById(selId);
    if(sel){
      sel.innerHTML = '<option value="">--Select--</option>';
      [...new Set(routes.map(r=>r.routeName))].forEach(rn=>{
        const o = document.createElement('option'); o.value=rn; o.textContent=rn; sel.appendChild(o);
      });
    }
  });
}

// =======================
// MAPS & PINS
// =======================
let map;
function initMap(){
  map = L.map('map').setView([30.5, -90.1], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
}
initMap();

async function addPin(){
  const name = document.getElementById('pinName').value;
  const lat = parseFloat(document.getElementById('pinLat').value);
  const lng = parseFloat(document.getElementById('pinLng').value);
  const routeName = document.getElementById('routeSelect').value;
  if(!name||isNaN(lat)||isNaN(lng)||!routeName) return alert('Fill pin data');
  await addData('routes',{routeName,name,lat,lng,profit:0});
  L.marker([lat,lng],{draggable:true}).addTo(map).bindPopup(name).on('dragend',e=>{
    const marker = e.target;
    marker.getPopup().setContent(`${marker.getLatLng().lat.toFixed(5)}, ${marker.getLatLng().lng.toFixed(5)}`);
  });
}

// =======================
// FORMS
// =======================
async function submitForm(){
  const f1 = document.getElementById('formField1').value;
  const f2 = document.getElementById('formField2').value;
  const file = document.getElementById('formPhoto').files[0];
  if(!f1 || !f2) return alert('Fill form fields');
  let photo = null;
  if(file){
    photo = await new Promise(res=>{
      const reader=new FileReader();
      reader.onload=e=>res(e.target.result);
      reader.readAsDataURL(file);
    });
  }
  await addData('forms',{field1:f1,field2:f2,date:new Date().toISOString(),photo});
  renderForms();
}

async function renderForms(){
  const submissions = await getAllData('forms');
  const ul = document.getElementById('formSubmissions');
  ul.innerHTML='';
  submissions.forEach(f=>{
    const li = document.createElement('li');
    li.innerHTML=`${f.date}: ${f.field1} | ${f.field2}`;
    if(f.photo){
      const img = document.createElement('img');
      img.src=f.photo; img.style.height='100px'; img.style.marginLeft='10px';
      li.appendChild(img);
    }
    ul.appendChild(li);
  });
}

// =======================
// GAS CALCULATIONS
// =======================
function haversineDistance(lat1,lng1,lat2,lng2){
  const toRad = deg=>deg*Math.PI/180;
  const R = 3958.8; 
  const dLat=toRad(lat2-lat1);
  const dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

async function calculateGasForRoute(routeName, vehicleMPG, gasPrice){
  const allPins = await getAllData('routes');
  const routePins = allPins.filter(p=>p.routeName===routeName);
  if(routePins.length<2) return {totalDistance:0,gallonsUsed:0,cost:0};
  let totalDistance = 0;
  for(let i=0;i<routePins.length-1;i++){
    totalDistance+=haversineDistance(routePins[i].lat,routePins[i].lng,routePins[i+1].lat,routePins[i+1].lng);
  }
  const gallonsUsed = totalDistance/vehicleMPG;
  return {totalDistance:totalDistance.toFixed(2), gallonsUsed:gallonsUsed.toFixed(2), cost:(gallonsUsed*gasPrice).toFixed(2)};
}

async function computeGas(){
  const route = document.getElementById('gasRouteSelect').value;
  const mpg = parseFloat(document.getElementById('vehicleMPG').value);
  const price = parseFloat(document.getElementById('gasPrice').value);
  if(!route||isNaN(mpg)||isNaN(price)) return;
  const res = await calculateGasForRoute(route,mpg,price);
  document.getElementById('gasResult').innerHTML=`Route: ${route}<br>Total Distance: ${res.totalDistance} miles<br>Gas Used: ${res.gallonsUsed} gallons<br>Gas Cost: $${res.cost}`;
}

// =======================
// WEEKLY FUEL FORECAST
// =======================
async function weeklyFuelForecast(projectedGasPrice, vehicleMPG){
  const allRoutes = await getAllData('routes');
  const routeNames = [...new Set(allRoutes.map(r=>r.routeName))];
  let totalCost = 0;
  const panel = document.getElementById('fuelForecast');
  panel.innerHTML='';
  for(const rn of routeNames){
    const gasInfo = await calculateGasForRoute(rn,vehicleMPG,projectedGasPrice);
    totalCost+=parseFloat(gasInfo.cost);
    const div = document.createElement('div');
    div.textContent=`Route: ${rn} | Cost: $${gasInfo.cost}`;
    panel.appendChild(div);
  }
  const totalDiv = document.createElement('div'); totalDiv.textContent=`Total Weekly Fuel: $${totalCost.toFixed(2)}`;
  panel.appendChild(totalDiv);
}

// =======================
// OPTIMAL ROUTES
// =======================
async function suggestOptimalRoutes(vehicleMPG, projectedGasPrice){
  const allRoutes = await getAllData('routes');
  const routeNames = [...new Set(allRoutes.map(r=>r.routeName))];
  const scored = [];
  for(const rn of routeNames){
    const routePins = allRoutes.filter(p=>p.routeName===rn);
    const totalProfit = routePins.reduce((sum,r)=>sum+(r.profit||0),0);
    const gasInfo = await calculateGasForRoute(rn,vehicleMPG,projectedGasPrice);
    const score = totalProfit/(parseFloat(gasInfo.cost)||0.01);
    scored.push({routeName:rn, score, totalProfit, gasCost:gasInfo.cost});
  }
  scored.sort((a,b)=>b.score-a.score);
  const panel = document.getElementById('optimalRoutes'); panel.innerHTML='';
  scored.forEach((r,i)=>{
    const div=document.createElement('div');
    div.textContent=`${i+1}. ${r.routeName} | Score: ${r.score.toFixed(2)} | Profit: $${r.totalProfit.toFixed(2)} | Gas Cost: $${r.gasCost}`;
    panel.appendChild(div);
  });
}
