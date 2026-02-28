let db, map, markers=[];

// ---------------- IndexedDB ----------------
async function initDB(){
  return new Promise(resolve=>{
    const request = indexedDB.open('DayNightDB',6);
    request.onerror = e => console.error(e);
    request.onupgradeneeded = e => {
      db = e.target.result;
      ['inventory','drivers','routes','forms','users'].forEach(store=>{
        if(!db.objectStoreNames.contains(store))
          db.createObjectStore(store,{keyPath:'id', autoIncrement:true});
      });
    };
    request.onsuccess = async e=>{
      db = e.target.result;
      const users = await getAllData('users');
      if(users.length===0) await addData('users',{username:'admin',password:'admin'});
      resolve();
    };
  });
}

function getTransaction(store,mode='readonly'){ return db.transaction(store,mode).objectStore(store); }
function addData(store,data){ return new Promise(r=>getTransaction(store,'readwrite').add(data).onsuccess=r); }
function updateData(store,data){ return new Promise(r=>getTransaction(store,'readwrite').put(data).onsuccess=r); }
function getAllData(store){ return new Promise(r=>{ const arr=[]; const cursor=getTransaction(store).openCursor(); cursor.onsuccess=e=>{ const c=e.target.result; if(c){ arr.push(c.value); c.continue(); } else r(arr); }; }); }

// ---------------- Login ----------------
async function login(){
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value.trim();
  if(!u||!p) return alert('Enter username/password');
  try{
    const users = await getAllData('users');
    const user = users.find(x=>x.username===u && x.password===p);
    if(user){ document.getElementById('loginPage').style.display='none'; document.getElementById('mainApp').style.display='block'; initializeApp();}
    else alert('Invalid username/password');
  }catch(e){ console.error(e); alert('DB Error'); }
}

function showRegister(){ document.getElementById('registerFields').style.display='block'; }
function showLogin(){ document.getElementById('registerFields').style.display='none'; }
async function register(){
  const u=document.getElementById('regUsername').value.trim();
  const p=document.getElementById('regPassword').value.trim();
  if(!u||!p) return alert('Fill username/password');
  const users = await getAllData('users');
  if(users.find(x=>x.username===u)) return alert('Username exists');
  await addData('users',{username:u,password:p}); alert('Account created! Login now.'); showLogin();
}

// ---------------- DOM Ready ----------------
window.addEventListener('DOMContentLoaded',async()=>{
  await initDB();
  const loginBtn=document.getElementById('loginBtn');
  const registerBtn=document.getElementById('registerBtn');
  loginBtn.disabled=false; registerBtn.disabled=false;
  loginBtn.addEventListener('click',login);
  registerBtn.addEventListener('click',register);
  document.getElementById('showRegisterLink').addEventListener('click',showRegister);
  document.getElementById('showLoginLink').addEventListener('click',showLogin);
  document.getElementById('loginPage').style.display='flex';
});

// ---------------- Inventory ----------------
async function initializeApp(){
  const inv = await getAllData('inventory');
  if(inv.length===0) await addData('inventory',{name:'Dumb Dumbs',cost:0.04,priceSingle:0.5,priceBundle:0.33,quantity:0});
  renderInventory(); await populateInventoryDropdown(); initMap();
}
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
  const select=document.getElementById('inventorySelect'); select.innerHTML='<option value="">--Select Item--</option>';
  inventory.forEach(i=>{ const o=document.createElement('option'); o.value=i.id; o.textContent=`${i.name} (Qty: ${i.quantity})`; select.appendChild(o); });
}
async function addInventoryStock(){
  const select=document.getElementById('inventorySelect');
  const qty=parseInt(document.getElementById('inventoryAddQty').value);
  const id=parseInt(select.value);
  if(isNaN(id)||isNaN(qty)) return alert('Select item & qty');
  const inv=await getAllData('inventory'); const item=inv.find(x=>x.id===id);
  if(item){ item.quantity+=qty; await updateData('inventory',item); renderInventory(); await populateInventoryDropdown(); document.getElementById('inventoryAddQty').value=''; }
}
document.getElementById('addStockBtn').addEventListener('click',addInventoryStock);
document.getElementById('addNewItemBtn').addEventListener('click',async()=>{
  const n=document.getElementById('newItemName').value.trim();
  const c=parseFloat(document.getElementById('newItemCost').value);
  const ps=parseFloat(document.getElementById('newItemPriceSingle').value);
  const pb=parseFloat(document.getElementById('newItemPriceBundle').value);
  const q=parseInt(document.getElementById('newItemQty').value);
  if(!n||isNaN(c)||isNaN(ps)||isNaN(pb)||isNaN(q)) return alert('Fill all fields');
  await addData('inventory',{name:n,cost:c,priceSingle:ps,priceBundle:pb,quantity:q});
  renderInventory(); await populateInventoryDropdown();
});

// ---------------- Routes + Map + Gas ----------------
async function initMap(){
  map=L.map('map').setView([30.45,-90.05],8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);
  await loadRoutes();
}
async function loadRoutes(){
  const routes=await getAllData('routes');
  [document.getElementById('routeSelect'),document.getElementById('gasRouteSelect')].forEach(s=>{ s.innerHTML='<option value="">--Select Route--</option>'; });
  routes.forEach(r=>{
    const o=document.createElement('option'); o.value=r.id; o.textContent=r.name; document.getElementById('routeSelect').appendChild(o);
    const o2=document.createElement('option'); o2.value=r.id; o2.textContent=r.name; document.getElementById('gasRouteSelect').appendChild(o2);
  });
}
document.getElementById('createRouteBtn').addEventListener('click',async()=>{
  const name=document.getElementById('newRouteName').value.trim();
  if(!name) return alert('Enter route name');
  await addData('routes',{name,pins:[]}); document.getElementById('newRouteName').value=''; await loadRoutes();
});
document.getElementById('routeSelect').addEventListener('change',async ()=>{
  markers.forEach(m=>map.removeLayer(m)); markers=[];
  const id=parseInt(document.getElementById('routeSelect').value);
  if(!id) return;
  const routes=await getAllData('routes'); const route=routes.find(r=>r.id===id);
  if(route && route.pins){ route.pins.forEach(p=>{
    const m=L.marker([p.lat,p.lng],{draggable:true}).addTo(map).bindPopup(p.name);
    m.on('dragend',async e=>{ p.lat=e.target.getLatLng().lat; p.lng=e.target.getLatLng().lng; await updateData('routes',route); });
    markers.push(m);
  }); if(route.pins.length>0) map.setView([route.pins[0].lat,route.pins[0].lng],10);}
});
document.getElementById('addPinBtn').addEventListener('click',async ()=>{
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
document.getElementById('computeGasBtn').addEventListener('click',async ()=>{
  const id=parseInt(document.getElementById('gasRouteSelect').value);
  const mpg=parseFloat(document.getElementById('vehicleMPG').value);
  const gasPrice=parseFloat(document.getElementById('gasPrice').value);
  if(!id||isNaN(mpg)||isNaN(gasPrice)) return alert('Fill all fields');
  const routes=await getAllData('routes'); const route=routes.find(r=>r.id===id);
  if(!route.pins||route.pins.length<2) return alert('Route must have at least 2 stops');
  let miles=0;
  for(let i=0;i<route.pins.length-1;i++){ const a=route.pins[i],b=route.pins[i+1]; miles+=getDistance(a.lat,a.lng,b.lat,b.lng);}
  const gallons=miles/mpg; const cost=gallons*gasPrice;
  document.getElementById('gasResult').innerHTML=`Route Distance: ${miles.toFixed(2)} mi<br>Estimated Gas: $${cost.toFixed(2)}`;
});
function getDistance(lat1,lon1,lat2,lon2){ const R=3958.8; const dLat=toRad(lat2-lat1); const dLon=toRad(lon2-lon1); const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2; const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); return R*c; }
function toRad(v){ return v*Math.PI/180; }
