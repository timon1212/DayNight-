let db;
let map;
let markers = [];
let watchId = null;
let currentUser = null;

// ================= DATABASE =================
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

// ================= INIT =================
window.addEventListener("DOMContentLoaded",async()=>{
  await initDB();

  const loginUser = document.getElementById("loginUser");
  const loginPass = document.getElementById("loginPass");
  const loginSection = document.getElementById("loginSection");
  const appSection = document.getElementById("appSection");
  const routeSelect = document.getElementById("routeSelect");

  // default admin
  const users = await getAll("users");
  if(users.length===0) await addData("users",{username:"admin",password:"admin",role:"admin"});

  // default routes
  const routes = await getAll("routes");
  if(routes.length===0){
    const defaultRouteNames = [
      "Covington A","Covington B","Covington C",
      "Mandeville A","Mandeville B",
      "Madisonville A","Madisonville B",
      "Hammond A","Hammond B",
      "Baton Rouge A","Baton Rouge B","Baton Rouge C",
      "Slidell A","Slidell B","Slidell C",
      "Gulfport A","Gulfport B","Gulfport C",
      "Biloxi A","Biloxi B","Biloxi C"
    ];
    for(const name of defaultRouteNames) await addData("routes",{name,pins:[]});
  }

  // login
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

// ================= ROUTES =================
async function populateRoutes(){
  const routes = await getAll("routes");
  const routeSelect = document.getElementById("routeSelect");
  routeSelect.innerHTML="";
  routes.forEach(r=>routeSelect.innerHTML+=`<option value="${r.id}">${r.name}</option>`);
  if(routes.length>0) displayRoute();
}

async function addRoute(){ const name=document.getElementById("newRouteName").value; if(!name) return; await addData("routes",{name,pins:[]}); populateRoutes(); }
async function addStop(){
  const routes=await getAll("routes");
  const route=routes.find(r=>r.id==routeSelect.value); if(!route) return;
  const stopName=document.getElementById("stopName").value;
  const stopAddress=document.getElementById("stopAddress").value;
  route.pins.push({name:stopName,address:stopAddress,lat:30.47,lng:-90.1,notes:"",completed:false,arrived:false,photo:null,arrival:null,departure:null,honor:0,slots:0,revenue:0,stockUsed:{}});
  await updateData("routes",route);
  displayRoute();
}

async function displayRoute(){
  const routeSelect = document.getElementById("routeSelect");
  markers.forEach(m=>map.removeLayer(m)); markers=[];
  const routes=await getAll("routes");
  const route=routes.find(r=>r.id==routeSelect.value); if(!route) return;
  const routeList=document.getElementById("routeList");
  routeList.innerHTML="";
  route.pins.forEach((p,i)=>{
    const div=document.createElement("div"); div.className="stopBox";
    div.innerHTML=`<b>${p.name}</b><br>${p.address}<br>
    Arrival: ${p.arrival||"-"}<br>Departure: ${p.departure||"-"}<br>
    Revenue: $${p.revenue}<br>
    Arrived: <input type="checkbox" ${p.arrived?"checked":""} onchange="markArrived(${route.id},${i},this.checked)"><br>
    Notes: <input value="${p.notes}" onchange="updateNotes(${route.id},${i},this.value)"><br>
    Honor: <input type="number" value="${p.honor}" onchange="updateMoney(${route.id},${i},this.value,p.slots)"><br>
    Slots: <input type="number" value="${p.slots}" onchange="updateMoney(${route.id},${i},p.honor,this.value)"><br>
    Photo: <input type="file" onchange="uploadPhoto(${route.id},${i},this)"><br>
    Complete: <input type="checkbox" ${p.completed?"checked":""} onchange="completeStop(${route.id},${i},this.checked)"><br>
    <button onclick="moveStop(${route.id},${i},-1)">⬆</button>
    <button onclick="moveStop(${route.id},${i},1)">⬇</button>
    <button onclick="deleteStop(${route.id},${i})">Delete</button><hr>`;
    routeList.appendChild(div);
    const marker=L.marker([p.lat,p.lng],{draggable:true}).addTo(map); markers.push(marker);
    marker.on("dragend",async e=>{p.lat=e.target.getLatLng().lat; p.lng=e.target.getLatLng().lng; await updateData("routes",route);});
  });
}

// ================= STOP ACTIONS =================
// (keep all previous stop actions from prior version here) ...

// ================= INVENTORY / FINANCE / GAS =================
// (keep all inventory + finance + gas code from prior version here) ...
