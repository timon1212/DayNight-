let db, map, markers = [];

// ---------------- IndexedDB ----------------
async function initDB() {
  return new Promise(resolve => {
    const request = indexedDB.open('DayNightDB', 8);
    request.onerror = e => console.error(e);
    request.onupgradeneeded = e => {
      db = e.target.result;
      ['inventory','routes','users','forms'].forEach(store=>{
        if(!db.objectStoreNames.contains(store))
          db.createObjectStore(store,{keyPath:'id',autoIncrement:true});
      });
    };
    request.onsuccess = e => { db = e.target.result; resolve(); };
  });
}

function getTransaction(store, mode='readonly'){ return db.transaction(store, mode).objectStore(store); }
function addData(store, data){ return new Promise(r=>getTransaction(store,'readwrite').add(data).onsuccess=r); }
function updateData(store,data){ return new Promise(r=>getTransaction(store,'readwrite').put(data).onsuccess=r); }
function getAllData(store){
  return new Promise(r=>{
    const arr=[]; const cursor = getTransaction(store).openCursor();
    cursor.onsuccess=e=>{ const c=e.target.result; if(c){ arr.push(c.value); c.continue(); } else r(arr); };
  });
}

// ---------------- Login ----------------
async function login(){
  const u=document.getElementById('loginUsername').value.trim();
  const p=document.getElementById('loginPassword').value.trim();
  if(!u||!p) return alert('Enter username/password');
  const users=await getAllData('users');
  const user=users.find(x=>x.username===u && x.password===p);
  if(user){
    document.getElementById('loginPage').style.display='none';
    document.getElementById('mainApp').style.display='block';
    initializeApp();
  }else alert('Invalid username/password');
}

function showRegister(){ document.getElementById('registerFields').style.display='block'; }
function showLogin(){ document.getElementById('registerFields').style.display='none'; }
async function register(){
  const u=document.getElementById('regUsername').value.trim();
  const p=document.getElementById('regPassword').value.trim();
  if(!u||!p) return alert('Fill username/password');
  const users=await getAllData('users');
  if(users.find(x=>x.username===u)) return alert('Username exists');
  await addData('users',{username:u,password:p});
  alert('Account created! Login now.');
  showLogin();
}

// ---------------- DOM Ready ----------------
window.addEventListener('DOMContentLoaded',async()=>{
  await initDB();
  const users=await getAllData('users');
  if(users.length===0) await addData('users',{username:'admin',password:'admin'});

  const loginBtn=document.getElementById('loginBtn');
  const registerBtn=document.getElementById('registerBtn');
  loginBtn.disabled=false;
  registerBtn.disabled=false;
  loginBtn.addEventListener('click',login);
  registerBtn.addEventListener('click',register);
  document.getElementById('showRegisterLink').addEventListener('click',showRegister);
  document.getElementById('showLoginLink').addEventListener('click',showLogin);

  document.getElementById('loginPage').style.display='flex';
});

// ---------------- Initialize App ----------------
async function initializeApp(){
  // Inventory default
  const inv=await getAllData('inventory');
  if(inv.length===0)
    await addData('inventory',{name:'Dumb Dumbs',cost:0.04,priceSingle:0.5,priceBundle:0.33,quantity:0});

  // Preset Routes
  const existingRoutes=await getAllData('routes');
  if(existingRoutes.length===0){
    const presetRoutes=[
      {name:'Covington A', pins:[{name:'Stop 1',lat:30.475,lng:-90.100},{name:'Stop 2',lat:30.480,lng:-90.110}]},
      {name:'Covington B', pins:[{name:'Stop 1',lat:30.460,lng:-90.120},{name:'Stop 2',lat:30.465,lng:-90.130}]},
      {name:'Covington C', pins:[{name:'Stop 1',lat:30.450,lng:-90.140},{name:'Stop 2',lat:30.455,lng:-90.150}]},
      {name:'Mandeville A', pins:[{name:'Stop 1',lat:30.360,lng:-90.080},{name:'Stop 2',lat:30.365,lng:-90.085}]},
      {name:'Mandeville B', pins:[{name:'Stop 1',lat:30.370,lng:-90.090},{name:'Stop 2',lat:30.375,lng:-90.095}]},
      {name:'Madisonville A', pins:[{name:'Stop 1',lat:30.320,lng:-90.060},{name:'Stop 2',lat:30.325,lng:-90.065}]},
      {name:'Madisonville B', pins:[{name:'Stop 1',lat:30.330,lng:-90.070},{name:'Stop 2',lat:30.335,lng:-90.075}]},
      {name:'Hammond A', pins:[{name:'Stop 1',lat:30.500,lng:-90.460},{name:'Stop 2',lat:30.505,lng:-90.465}]},
      {name:'Hammond B', pins:[{name:'Stop 1',lat:30.510,lng:-90.470},{name:'Stop 2',lat:30.515,lng:-90.475}]},
      {name:'Baton Rouge A', pins:[{name:'Stop 1',lat:30.450,lng:-91.150},{name:'Stop 2',lat:30.455,lng:-91.155}]},
      {name:'Baton Rouge B', pins:[{name:'Stop 1',lat:30.460,lng:-91.160},{name:'Stop 2',lat:30.465,lng:-91.165}]},
      {name:'Baton Rouge C', pins:[{name:'Stop 1',lat:30.470,lng:-91.170},{name:'Stop 2',lat:30.475,lng:-91.175}]},
      {name:'Slidell A', pins:[{name:'Stop 1',lat:30.300,lng:-89.750},{name:'Stop 2',lat:30.305,lng:-89.755}]},
      {name:'Slidell B', pins:[{name:'Stop 1',lat:30.310,lng:-89.760},{name:'Stop 2',lat:30.315,lng:-89.765}]},
      {name:'Slidell C', pins:[{name:'Stop 1',lat:30.320,lng:-89.770},{name:'Stop 2',lat:30.325,lng:-89.775}]},
      {name:'Gulfport A', pins:[{name:'Stop 1',lat:30.360,lng:-89.070},{name:'Stop 2',lat:30.365,lng:-89.075}]},
      {name:'Gulfport B', pins:[{name:'Stop 1',lat:30.370,lng:-89.080},{name:'Stop 2',lat:30.375,lng:-89.085}]},
      {name:'Gulfport C', pins:[{name:'Stop 1',lat:30.380,lng:-89.090},{name:'Stop 2',lat:30.385,lng:-89.095}]},
      {name:'Biloxi A', pins:[{name:'Stop 1',lat:30.390,lng:-88.900},{name:'Stop 2',lat:30.395,lng:-88.905}]},
      {name:'Biloxi B', pins:[{name:'Stop 1',lat:30.400,lng:-88.910},{name:'Stop 2',lat:30.405,lng:-88.915}]},
      {name:'Biloxi C', pins:[{name:'Stop 1',lat:30.410,lng:-88.920},{name:'Stop 2',lat:30.415,lng:-88.925}]},
    ];
    for(const r of presetRoutes) await addData('routes',r);
  }

  await renderInventory();
  await populateInventoryDropdown();
  await loadRoutes();
  await populateDistributeDropdowns();
  initMap();
}

// ---------------- Inventory ----------------
async function renderInventory(){
  const inv=await getAllData('inventory');
  const tbody=document.querySelector('#inventoryTable tbody'); tbody.innerHTML='';
  inv.forEach(i=>{
    const profit=((i.priceSingle-i.cost)*i.quantity).toFixed(2);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i.name}</td><td>$${i.cost}</td><td>$${i.priceSingle}</td><td>${i.quantity}</td><td>$${profit}</td><td>${i.quantity>0?'OK':'Restock Needed'}</td>`;
    tbody.appendChild(tr);
  });
}

async function populateInventoryDropdown(){
  const inventory=await getAllData('inventory');
  const selects=[document.getElementById('inventorySelect'),document.getElementById('distributeItemSelect')];
  selects.forEach(select=>{
    select.innerHTML='<option value="">--Select Item--</option>';
    inventory.forEach(i=>{
      const o=document.createElement('option'); o.value=i.id; o.textContent=`${i.name} (Qty: ${i.quantity})`;
      select.appendChild(o);
    });
  });
}

// Add stock
document.getElementById('addStockBtn').addEventListener('click',async()=>{
  const select=document.getElementById('inventorySelect');
  const qty=parseInt(document.getElementById('inventoryAddQty').value);
  const id=parseInt(select.value);
  if(isNaN(id)||isNaN(qty)) return alert('Select item & qty');
  const inv=await getAllData('inventory'); const item=inv.find(x=>x.id===id);
  if(item){ item.quantity+=qty; await updateData('inventory',item); await renderInventory(); await populateInventoryDropdown(); document.getElementById('inventoryAddQty').value=''; }
});

// Add new item
document.getElementById('addNewItemBtn').addEventListener('click',async()=>{
  const n=document.getElementById('newItemName').value.trim();
  const c=parseFloat(document.getElementById('newItemCost').value);
  const ps=parseFloat(document.getElementById('newItemPriceSingle').value);
  const pb=parseFloat(document.getElementById('newItemPriceBundle').value);
  const q=parseInt(document.getElementById('newItemQty').value);
  if(!n||isNaN(c)||isNaN(ps)||isNaN(pb)||isNaN(q)) return alert('Fill all fields');
  await addData('inventory',{name:n,cost:c,priceSingle:ps,priceBundle:pb,quantity:q});
  await renderInventory(); await populateInventoryDropdown(); await populateDistributeDropdowns();
});

// ---------------- Distribute Stock by Stop ----------------
async function populateDistributeDropdowns(){
  const inventory=await getAllData('inventory');
  const routes=await getAllData('routes');
  const routeSelect=document.getElementById('distributeRouteSelect');
  routeSelect.innerHTML='<option value="">--Select Route--</option>';
  routes.forEach(r=>{ const o=document.createElement('option'); o.value=r.id; o.textContent=r.name; routeSelect.appendChild(o); });
}

// Populate stops when route changes
document.getElementById('distributeRouteSelect').addEventListener('change',async()=>{
  const routeId=parseInt(document.getElementById('distributeRouteSelect').value);
  const stopSelect=document.getElementById('distributeStopSelect');
  stopSelect.innerHTML='<option value="">--Select Stop--</option>';
  if(!routeId) return;
  const routes=await getAllData('routes');
  const route=routes.find(r=>r.id===routeId);
  if(route && route.pins) route.pins.forEach((p,idx)=>{ const o=document.createElement('option'); o.value=idx; o.textContent=p.name; stopSelect.appendChild(o); });
});

// Distribute stock to stop
document.getElementById('distributeBtn').addEventListener('click',async()=>{
  const itemId=parseInt(document.getElementById('distributeItemSelect').value);
  const routeId=parseInt(document.getElementById('distributeRouteSelect').value);
  const stopIndex=parseInt(document.getElementById('distributeStopSelect').value);
  const qty=parseInt(document.getElementById('distributeQty').value);
  if(isNaN(itemId)||isNaN(routeId)||isNaN(stopIndex)||isNaN(qty)||qty<=0) return alert('Fill all fields');

  const inventory=await getAllData('inventory');
  const item=inventory.find(i=>i.id===itemId);
  if(qty>item.quantity) return alert('Not enough stock');

  item.quantity-=qty;
  await updateData('inventory',item);

  const routes=await getAllData('routes');
  const route=routes.find(r=>r.id===routeId);
  if(!route.pins[stopIndex].deliveries) route.pins[stopIndex].deliveries=[];
  route.pins[stopIndex].deliveries.push({item:item.name,quantity:qty,date:new Date().toLocaleString()});
  await updateData('routes',route);

  await renderInventory(); await populateInventoryDropdown(); document.getElementById('distributeQty').value='';
  document.getElementById('distributeResult').innerHTML=`Distributed ${qty} of ${item.name} to ${route.pins[stopIndex].name} (${route.name})`;
});

// ---------------- Routes + Map + Gas ----------------
async function loadRoutes(){
  const routes=await getAllData('routes');
  const routeSelects=[document.getElementById('routeSelect'),document.getElementById('gasRouteSelect')];
  routeSelects.forEach(s=>{ s.innerHTML='<option value="">--Select Route--</option>'; routes.forEach(r=>{ const o=document.createElement('option'); o.value=r.id; o.textContent=r.name; s.appendChild(o); }); });
}

function initMap(){
  map=L.map('map').setView([30.45,-90.05],8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);
  document.getElementById('routeSelect').addEventListener('change',displayRoutePins);
}

async function displayRoutePins(){
  markers.forEach(m=>map.removeLayer(m)); markers=[];
  const id=parseInt(document.getElementById('routeSelect').value);
  if(!id) return;
  const routes=await getAllData('routes'); const route=routes.find(r=>r.id===id);
  if(route && route.pins){
    route.pins.forEach(p=>{
      const m=L.marker([p.lat,p.lng],{draggable:true}).addTo(map).bindPopup(p.name);
      m.on('dragend',async e=>{ p.lat=e.target.getLatLng().lat; p.lng=e.target.getLatLng().lng; await updateData('routes',route); });
      markers.push(m);
    });
    if(route.pins.length>0) map.setView([route.pins[0].lat,route.pins[0].lng],10);
  }
}

document.getElementById('addPinBtn').addEventListener('click',async()=>{
  const id=parseInt(document.getElementById('routeSelect').value);
  const n=document.getElementById('pinName').value.trim();
  const lat=parseFloat(document.getElementById('pinLat').value);
  const lng=parseFloat(document.getElementById('pinLng').value);
  if(!id||!n||isNaN(lat)||isNaN(lng)) return alert('Fill all fields');
  const routes=await getAllData('routes'); const route=routes.find(r=>r.id===id);
  if(!route.pins) route.pins=[];
  route.pins.push({name:n,lat,lng});
  await updateData('routes',route);
  document.getElementById('routeSelect').dispatchEvent(new Event('change'));
});

document.getElementById('computeGasBtn').addEventListener('click',async()=>{
  const id=parseInt(document.getElementById('gasRouteSelect').value);
  const mpg=parseFloat(document.getElementById('vehicleMPG').value);
  const gasPrice=parseFloat(document.getElementById('gasPrice').value);
  if(!id||isNaN(mpg)||isNaN(gasPrice)) return alert('Fill all fields');
  const routes=await getAllData('routes'); const route=routes.find(r=>r.id===id);
  if(!route.pins||route.pins.length<2) return alert('Route must have at least 2 stops');
  let miles=0;
  for(let i=0;i<route.pins.length-1;i++){
    const a=route.pins[i],b=route.pins[i+1];
    const dLat=(b.lat-a.lat)*Math.PI/180;
    const dLng=(b.lng-a.lng)*Math.PI/180;
    const lat1=a.lat*Math.PI/180,lat2=b.lat*Math.PI/180;
    const R=3958.8;
    const aVal=Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(lat1)*Math.cos(lat2);
    const c=2*Math.atan2(Math.sqrt(aVal),Math.sqrt(1-aVal));
    miles+=R*c;
  }
  const cost=(miles/mpg)*gasPrice;
  document.getElementById('gasResult').innerHTML=`Distance: ${miles.toFixed(2)} mi, Gas Cost: $${cost.toFixed(2)}`;
});

// ---------------- Finance ----------------
document.getElementById('updateFinance
