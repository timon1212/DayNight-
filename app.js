let db;
let map;
let markers = [];
let watchId = null;
let currentUser = null;

// ================ DATABASE =================
function initDB() {
  return new Promise(resolve => {
    const request = indexedDB.open("DispatchDB",2);
    request.onupgradeneeded=e=>{
      db=e.target.result;
      if(!db.objectStoreNames.contains("routes")) db.createObjectStore("routes",{keyPath:"id",autoIncrement:true});
      if(!db.objectStoreNames.contains("users")) db.createObjectStore("users",{keyPath:"id",autoIncrement:true});
      if(!db.objectStoreNames.contains("inventory")) db.createObjectStore("inventory",{keyPath:"id",autoIncrement:true});
      if(!db.objectStoreNames.contains("finance")) db.createObjectStore("finance",{keyPath:"id",autoIncrement:true});
      if(!db.objectStoreNames.contains("gas")) db.createObjectStore("gas",{keyPath:"id",autoIncrement:true});
    };
    request.onsuccess=e=>{db=e.target.result; resolve();}
  });
}

function tx(store,mode="readonly"){return db.transaction(store,mode).objectStore(store);}
function addData(store,data){return new Promise(res=>tx(store,"readwrite").add(data).onsuccess=res);}
function updateData(store,data){return new Promise(res=>tx(store,"readwrite").put(data).onsuccess=res);}
function getAll(store){return new Promise(resolve=>{const results=[];const cursor=tx(store).openCursor();cursor.onsuccess=e=>{const c=e.target.result;if(c){results.push(c.value);c.continue();}else resolve(results);};});}

// ================ INIT =================
window.addEventListener("DOMContentLoaded",async()=>{
  await initDB();

  const loginUser = document.getElementById("loginUser");
  const loginPass = document.getElementById("loginPass");
  const loginSection = document.getElementById("loginSection");
  const appSection = document.getElementById("appSection");
  const routeSelect = document.getElementById("routeSelect");
  const routeList = document.getElementById("routeList");

  // ensure default admin
  const users = await getAll("users");
  if(users.length===0) await addData("users",{username:"admin",password:"admin",role:"admin"});

  // login button
  const loginBtn = loginSection.querySelector("button");
  loginBtn.onclick = async ()=>{
    const u = loginUser.value, p = loginPass.value;
    const allUsers = await getAll("users");
    const found = allUsers.find(x=>x.username===u && x.password===p);
    if(!found){alert("Invalid login"); return;}
    currentUser = found;
    loginSection.style.display="none";
    appSection.style.display="block";
    populateRoutes();
    populateInventorySelect();
    displayFinance();
    displayGas();
  };

  initMap();
});

// ================= MAP =================
function initMap(){
  map=L.map("map").setView([30.47,-90.1],9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
}

// ================= ROUTES / STOPS =================
async function addRoute(){ if(!newRouteName.value) return; await addData("routes",{name:newRouteName.value,pins:[]}); populateRoutes(); }
async function populateRoutes(){
  const routes = await getAll("routes");
  routeSelect.innerHTML="";
  routes.forEach(r=>routeSelect.innerHTML+=`<option value="${r.id}">${r.name}</option>`);
  if(routes.length>0) displayRoute();
}

async function addStop(){
  const routes = await getAll("routes");
  const route = routes.find(r=>r.id==routeSelect.value); if(!route) return;
  route.pins.push({name:stopName.value,address:stopAddress.value,lat:30.47,lng:-90.1,notes:"",completed:false,arrived:false,comments:"",arrival:null,departure:null,honor:0,slots:0,revenue:0,photo:null,stockUsed:{}});
  await updateData("routes",route); displayRoute();
}

async function displayRoute(){
  markers.forEach(m=>map.removeLayer(m)); markers=[];
  const routes=await getAll("routes");
  const route=routes.find(r=>r.id==routeSelect.value); if(!route) return;
  routeList.innerHTML="";
  route.pins.forEach((p,i)=>{
    const div=document.createElement("div"); div.className="stopBox";
    div.innerHTML=`
      <b>${p.name}</b><br>${p.address}<br>
      Arrival: ${p.arrival||"-"}<br>
      Departure: ${p.departure||"-"}<br>
      Revenue: $${p.revenue}<br>
      Arrived: <input type="checkbox" ${p.arrived?"checked":""} onchange="markArrived(${route.id},${i},this.checked)"><br>
      Notes: <input value="${p.notes}" onchange="updateNotes(${route.id},${i},this.value)"><br>
      Honor: <input type="number" value="${p.honor}" onchange="updateMoney(${route.id},${i},this.value,p.slots)"><br>
      Slots: <input type="number" value="${p.slots}" onchange="updateMoney(${route.id},${i},p.honor,this.value)"><br>
      Photo: <input type="file" onchange="uploadPhoto(${route.id},${i},this)"><br>
      Complete: <input type="checkbox" ${p.completed?"checked":""} onchange="completeStop(${route.id},${i},this.checked)"><br>
      <button onclick="moveStop(${route.id},${i},-1)">⬆</button>
      <button onclick="moveStop(${route.id},${i},1)">⬇</button>
      <button onclick="deleteStop(${route.id},${i})">Delete</button>
      <hr>`;
    routeList.appendChild(div);
    const marker=L.marker([p.lat,p.lng],{draggable:true}).addTo(map); markers.push(marker);
    marker.on("dragend",async e=>{p.lat=e.target.getLatLng().lat; p.lng=e.target.getLatLng().lng; await updateData("routes",route);});
  });
}

// ================= STOP ACTIONS =================
async function markArrived(routeId,i,state){ const routes=await getAll("routes"); const route=routes.find(r=>r.id==routeId); route.pins[i].arrived=state; await updateData("routes",route);}
async function updateNotes(routeId,i,val){ const routes=await getAll("routes"); const route=routes.find(r=>r.id==routeId); route.pins[i].notes=val; await updateData("routes",route);}
async function updateMoney(routeId,i,h,s){ const routes=await getAll("routes"); const route=routes.find(r=>r.id==routeId); const stop=route.pins[i]; stop.honor=Number(h); stop.slots=Number(s); stop.revenue=stop.honor+stop.slots; await updateData("routes",route); displayRoute();}
async function uploadPhoto(routeId,i,input){ const file=input.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=async ()=>{ const routes=await getAll("routes"); const route=routes.find(r=>r.id==routeId); route.pins[i].photo=reader.result; await updateData("routes",route); }; reader.readAsDataURL(file);}
async function completeStop(routeId,i,state){ const routes=await getAll("routes"); const route=routes.find(r=>r.id==routeId); const stop=route.pins[i]; if(!stop.arrived){alert("Must mark arrived first."); return;} if(state && !stop.photo){alert("Photo required."); return;} if(state) stop.departure=new Date().toLocaleString(); stop.completed=state; await updateData("routes",route); displayRoute();}
async function moveStop(routeId,i,dir){ const routes=await getAll("routes"); const route=routes.find(r=>r.id==routeId); const newIndex=i+dir; if(newIndex<0||newIndex>=route.pins.length) return; [route.pins[i],route.pins[newIndex]]=[route.pins[newIndex],route.pins[i]]; await updateData("routes",route); displayRoute();}
async function deleteStop(routeId,i){ const routes=await getAll("routes"); const route=routes.find(r=>r.id==routeId); route.pins.splice(i,1); await updateData("routes",route); displayRoute();}

// ================= GPS =================
function startTracking(){ if(!navigator.geolocation) return; watchId=navigator.geolocation.watchPosition(async pos=>{ const routes=await getAll("routes"); const route=routes.find(r=>r.id==routeSelect.value); if(!route) return; route.pins.forEach(stop=>{ const d=getDistance(pos.coords.latitude,pos.coords.longitude,stop.lat,stop.lng); if(d<0.03 && !stop.arrival){ stop.arrival=new Date().toLocaleString(); alert("Arrived at "+stop.name); } }); await updateData("routes",route); displayRoute(); });}
function stopTracking(){ if(watchId) navigator.geolocation.clearWatch(watchId);}
function getDistance(lat1,lon1,lat2,lon2){ const R=3958.8; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180; const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2; return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}

// ================= ROUTE OPTIMIZER =================
async function optimizeRoute(){ const routes=await getAll("routes"); const route=routes.find(r=>r.id==routeSelect.value); if(!route||route.pins.length<2) return; route.pins.sort((a,b)=>a.lat-b.lat); await updateData("routes",route); displayRoute();}

// ================= INVENTORY =================
async function getInventory(){ return await getAll("inventory");}
async function populateInventorySelect(){ const inventory=await getInventory(); const select=document.getElementById("inventorySelect"); select.innerHTML=""; inventory.forEach(i=>select.innerHTML+=`<option value="${i.id}">${i.name} (Available: ${i.qty})</option>`);}
async function distributeStockUI(){ 
  const itemId=document.getElementById("inventorySelect").value; 
  const amount=Number(document.getElementById("stockAmount").value);
  const routes=await getAll("routes");
  const route=routes.find(r=>r.id==routeSelect.value);
  if(!route) return;
  const stopIndex=prompt("Enter Stop Index (0 for first stop, etc):");
  const stop=route.pins[Number(stopIndex)];
  if(!stop) return;
  const inventory=await getInventory();
  const item=inventory.find(i=>i.id==itemId);
  if(!item||item.qty<amount){alert("Not enough stock"); return;}
  item.qty-=amount;
  stop.stockUsed[itemId]=(stop.stockUsed[itemId]||0)+amount;
  await updateData("inventory",item);
  await updateData("routes",route);
  alert(`Distributed ${amount} ${item.name} to ${stop.name}`);
  populateInventorySelect();
  displayRoute();
}
function addInventoryPrompt(){ const name=prompt("Item Name:"); const qty=prompt("Quantity:"); if(name&&qty) addInventoryItem(name,Number(qty)); }
async function addInventoryItem(name, qty){ await addData("inventory",{name,qty}); alert("Inventory added"); populateInventorySelect();}

// ================= FINANCE / GAS =================
async function recordFinanceUI(){ const routes=await getAll("routes"); const route=routes.find(r=>r.id==routeSelect.value); if(!route) return; const total=route.pins.reduce((sum,s)=>sum.revenue+sum.stockUsed?s.sum:0,0); await addData("finance",{route:route.name,total,date:new Date().toLocaleString()}); alert("Finance Recorded"); displayFinance();}
async function addGasUI(){ const amount=prompt("Gas Cost ($):"); const miles=prompt("Miles driven:"); if(!amount||!miles) return; await addData("gas",{amount:Number(amount),miles:Number(miles),date:new Date().toLocaleString()}); displayGas();}
async function displayFinance(){ const finance=await getAll("finance"); const div=document.getElementById("financeList"); div.innerHTML=finance.map(f=>`Route: ${f.route} | Total: $${f.total} | Date: ${f.date}`).join("<br>"); }
async function displayGas(){ const gas=await getAll("gas"); const div=document.getElementById("gasList"); div.innerHTML=gas.map(g=>`Cost: $${g.amount} | Miles: ${g.miles} | Date: ${g.date}`).join("<br>"); }
