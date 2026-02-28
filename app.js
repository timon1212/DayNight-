let db;
let map;
let markers = [];
let watchId = null;
let currentUser = null;

// ================ DATABASE =================
function initDB() {
  return new Promise(resolve => {
    const request = indexedDB.open("DispatchDB",3);
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

// ================ DEFAULTS =================
async function initDefaults() {
  // Users
  const users = await getAll("users");
  if(users.length===0) await addData("users",{username:"admin",password:"admin",role:"admin"});
  
  // Inventory
  const inventoryItems = await getAll("inventory");
  if(inventoryItems.length === 0){
    await addData("inventory", { name: "Dumb Dumbs", qty: 1000, cost: 0.04, price: 0.5 });
    await addData("inventory", { name: "Candy Bar", qty: 500, cost: 0.2, price: 1.0 });
    await addData("inventory", { name: "Soda", qty: 300, cost: 0.25, price: 1.5 });
  }

  // Routes
  const routes = await getAll("routes");
  if(routes.length === 0){
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
}

// ================ INIT =================
window.addEventListener("DOMContentLoaded", async () => {
  await initDB();
  await initDefaults();

  // Populate selects after defaults exist
  await populateInventorySelect();
  await populateRoutes();
  await populateFinanceRouteSelect();

  const loginSection = document.getElementById("loginSection");
  const loginUser = document.getElementById("loginUser");
  const loginPass = document.getElementById("loginPass");
  const loginBtn = loginSection.querySelector("button");

  loginBtn.onclick = async ()=>{
    const allUsers = await getAll("users");
    const found = allUsers.find(u=>u.username===loginUser.value && u.password===loginPass.value);
    if(!found){alert("Invalid login"); return;}
    currentUser = found;
    loginSection.style.display="none";
    document.querySelectorAll('.main > div').forEach(div=>div.style.display='none');
    document.getElementById('routesTab').style.display='block';

    await populateInventorySelect();
    await populateRoutes();
    await populateFinanceRouteSelect();
    displayFinance();
    displayGas();
    initMap();
  };
});

// ================ MAP =================
function initMap(){
  map=L.map("map").setView([30.47,-90.1],9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
}

// ================ ROUTES =================
async function populateRoutes(){
  const routes = await getAll("routes");
  const routeSelect = document.getElementById("routeSelect");
  routeSelect.innerHTML="";
  if(routes.length===0){ routeSelect.innerHTML="<option disabled>No routes</option>"; return; }
  routes.forEach(r=>routeSelect.innerHTML+=`<option value="${r.id}">${r.name}</option>`);
  displayRoute();
}

// ================ INVENTORY =================
async function populateInventorySelect(){
  const inventory = await getAll("inventory");
  const select = document.getElementById("inventorySelect");
  select.innerHTML = "";
  if(inventory.length===0){ select.innerHTML="<option disabled>No inventory items</option>"; return; }
  inventory.forEach(i=>select.innerHTML+=`<option value="${i.id}">${i.name} (Available: ${i.qty})</option>`);
}

// ================ FINANCE =================
async function populateFinanceRouteSelect(){
  const routes = await getAll("routes");
  const select = document.getElementById("financeRouteSelect");
  select.innerHTML = "";
  if(routes.length===0){ select.innerHTML="<option disabled>No routes</option>"; return; }
  routes.forEach(r=>select.innerHTML+=`<option value="${r.id}">${r.name}</option>`);
}

async function submitFinance(){
  const routeId = document.getElementById("financeRouteSelect").value;
  const total = Number(document.getElementById("financeTotal").value);
  const notes = document.getElementById("financeNotes").value;
  if(!routeId || isNaN(total) || total<=0){ alert("Please select route and enter valid total."); return; }
  const routes = await getAll("routes");
  const route = routes.find(r=>r.id==routeId);
  if(!route){ alert("Route not found"); return; }
  await addData("finance",{route:route.name,total,date:new Date().toLocaleString(),notes});
  alert("Finance Recorded Successfully!");
  document.getElementById("financeTotal").value="";
  document.getElementById("financeNotes").value="";
  displayFinance();
}

async function displayFinance(){
  const finance = await getAll("finance");
  const div = document.getElementById("financeList");
  div.innerHTML = finance.map(f=>`Route: ${f.route} | Total: $${f.total.toFixed(2)} | Notes: ${f.notes||"-"} | Date: ${f.date}`).join("<br>");
}

// ================ GAS =================
async function displayGas(){ 
  const gas=await getAll("gas"); 
  const div=document.getElementById("gasList"); 
  div.innerHTML=gas.map(g=>`Cost: $${g.amount} | Miles: ${g.miles} | Date: ${g.date}`).join("<br>");
}

// ================ GPS & UTIL =================
function getDistance(lat1,lon1,lat2,lon2){ const R=3958.8; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180; const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2; return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}

// --- Other route/stop, stock distribution, photos, move/delete functions remain same as previous version ---
