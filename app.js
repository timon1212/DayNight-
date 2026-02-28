// ==================== DATABASE ====================
let db;

function initDB() {
  return new Promise((resolve, reject)=>{
    const request = indexedDB.open("DeliveryDB",1);

    request.onupgradeneeded = (e)=>{
      db = e.target.result;
      if(!db.objectStoreNames.contains("users")) db.createObjectStore("users",{ keyPath: "username" });
      if(!db.objectStoreNames.contains("routes")) db.createObjectStore("routes",{ keyPath: "id" });
      if(!db.objectStoreNames.contains("inventory")) db.createObjectStore("inventory",{ keyPath: "id" });
      if(!db.objectStoreNames.contains("finance")) db.createObjectStore("finance",{ keyPath: "id" });
    };

    request.onsuccess = (e)=>{
      db = e.target.result;
      resolve();
    };
    request.onerror = (e)=>{ reject(e); };
  });
}

function getAll(storeName){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(storeName,"readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

function addData(storeName,obj){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(storeName,"readwrite");
    const store = tx.objectStore(storeName);
    const req = store.add(obj);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

function updateData(storeName,obj){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(storeName,"readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(obj);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

// ==================== DEFAULTS ====================
async function initDefaults() {
  const routes = await getAll("routes");
  if(routes.length === 0){
    await addData("routes",{ id:1, name:"Route A", pins:[] });
    await addData("routes",{ id:2, name:"Route B", pins:[] });
  }

  const inventory = await getAll("inventory");
  if(inventory.length === 0){
    await addData("inventory",{ id:1, name:"Dumb Dumbs", qty:100 });
    await addData("inventory",{ id:2, name:"Candy Bars", qty:50 });
  }
}

// ==================== LOGIN ====================
function checkLogin(){
  if(!localStorage.getItem("currentUser")){
    window.location.href="index.html";
  }
}

// ==================== ROUTES / STOPS ====================
async function addStop(){
  const name = document.getElementById("stopName").value.trim();
  const address = document.getElementById("stopAddress").value.trim();
  const routeId = document.getElementById("routeSelect").value;
  if(!name || !routeId) return alert("Stop name and route required.");

  const routes = await getAll("routes");
  const route = routes.find(r=>r.id==routeId);
  route.pins.push({ name, address, stockAssigned:[], completed:false });
  await updateData("routes",route);
  displayRoute();

  document.getElementById("stopName").value="";
  document.getElementById("stopAddress").value="";
}

async function toggleStop(routeId,index,checked){
  const routes = await getAll("routes");
  const route = routes.find(r=>r.id==routeId);
  route.pins[index].completed = checked;
  await updateData("routes",route);
  displayRoute();
}

// ==================== INVENTORY ====================
async function populateInventorySelect(){
  const inventory = await getAll("inventory");
  const select = document.getElementById("inventorySelect");
  if(!select) return;
  select.innerHTML = "";

  if(inventory.length===0){
    const opt = document.createElement("option");
    opt.text="No inventory";
    opt.value="";
    select.add(opt);
    return;
  }

  inventory.forEach(i=>{
    const opt = document.createElement("option");
    opt.text = `${i.name} (${i.qty})`;
    opt.value = i.id;
    select.add(opt);
  });
}

async function assignStockToStop(index){
  const qty = parseInt(document.getElementById("stockAmount").value);
  const invId = document.getElementById("inventorySelect").value;
  if(!qty || !invId) return alert("Select inventory and quantity");

  const inventory = await getAll("inventory");
  const item = inventory.find(i=>i.id==invId);
  if(item.qty<qty) return alert("Not enough stock");

  // Update stock
  item.qty -= qty;
  await updateData("inventory",item);

  // Assign to stop
  const routeId = document.getElementById("routeSelect").value;
  const routes = await getAll("routes");
  const route = routes.find(r=>r.id==routeId);
  route.pins[index].stockAssigned.push({ name:item.name, qty });
  await updateData("routes",route);

  displayRoute();
  populateInventorySelect();
  document.getElementById("stockAmount").value="";
}

// ==================== FINANCE ====================
async function populateFinanceRouteSelect(){
  const routes = await getAll("routes");
  const select = document.getElementById("financeRouteSelect");
  if(!select) return;
  select.innerHTML="";
  routes.forEach(r=>{
    const opt = document.createElement("option");
    opt.text=r.name; opt.value=r.id;
    select.add(opt);
  });
}

async function submitFinance(){
  const routeId = document.getElementById("financeRouteSelect").value;
  const total = parseFloat(document.getElementById("financeTotal").value);
  const notes = document.getElementById("financeNotes").value;

  if(!routeId || !total) return alert("Route and total required");
  const finance = await getAll("finance");
  const id = finance.length?finance[finance.length-1].id+1:1;
  await addData("finance",{ id, routeId, total, notes });
  displayFinance();
}

// ==================== GAS ====================
async function addGasUI(){
  const gasList = await getAll("gas");
  const id = gasList.length?gasList[gasList.length-1].id+1:1;
  await addData("gas",{ id, date:new Date().toLocaleDateString(), amount:0, notes:"" });
  displayGas();
}
