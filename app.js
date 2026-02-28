// ================== DATABASE ==================
let db;
let map;
let markers = [];

// Initialize IndexedDB
function initDB() {
  return new Promise(resolve => {
    const request = indexedDB.open("DispatchDB", 6);
    request.onupgradeneeded = e => {
      db = e.target.result;
      if (!db.objectStoreNames.contains("users")) db.createObjectStore("users", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("inventory")) db.createObjectStore("inventory", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("routes")) db.createObjectStore("routes", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("finance")) db.createObjectStore("finance", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("gas")) db.createObjectStore("gas", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = e => { db = e.target.result; resolve(); };
  });
}

// Shortcut for transactions
function tx(store, mode = "readonly") { return db.transaction(store, mode).objectStore(store); }
function addData(store, data) { return new Promise(res => tx(store, "readwrite").add(data).onsuccess = res); }
function updateData(store, data) { return new Promise(res => tx(store, "readwrite").put(data).onsuccess = res); }
function getAll(store) {
  return new Promise(resolve => {
    const results = [];
    const cursor = tx(store).openCursor();
    cursor.onsuccess = e => {
      const c = e.target.result;
      if (c) { results.push(c.value); c.continue(); } else resolve(results);
    };
  });
}

// ================== DEFAULT DATA ==================
async function initDefaults() {
  const users = await getAll("users");
  if (users.length === 0) await addData("users", { username: "admin", password: "admin", role: "admin" });

  const inventoryItems = await getAll("inventory");
  if (inventoryItems.length === 0) {
    await addData("inventory", { name: "Dumb Dumbs", qty: 1000, cost: 0.04, price: 0.5 });
    await addData("inventory", { name: "Candy Bar", qty: 500, cost: 0.2, price: 1.0 });
    await addData("inventory", { name: "Soda", qty: 300, cost: 0.25, price: 1.5 });
  }

  const routes = await getAll("routes");
  if (routes.length === 0) {
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
    for (const name of defaultRouteNames) await addData("routes", { name, pins: [] });
  }
}

// ================== LOGIN CHECK ==================
function checkLogin() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser && !window.location.href.includes("index.html")) {
    window.location.href = "index.html";
  }
  return currentUser;
}

// ================== MAP ==================
function initMap() {
  map = L.map("map").setView([30.47, -90.1], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
}

// ================== ROUTES ==================
async function populateRoutes() {
  const routes = await getAll("routes");
  const select = document.getElementById("routeSelect");
  if (!select) return;
  select.innerHTML = routes.length ? routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('') : "<option disabled>No routes</option>";
  displayRoute();
}

async function addRoute() {
  const name = document.getElementById("newRouteName").value;
  if (!name) { alert("Enter route name"); return; }
  await addData("routes", { name, pins: [] });
  document.getElementById("newRouteName").value = "";
  populateRoutes();
}

async function addStop() {
  const routeId = document.getElementById("routeSelect").value;
  const stopName = document.getElementById("stopName").value;
  const stopAddress = document.getElementById("stopAddress").value;
  if (!routeId || !stopName) { alert("Select route and enter stop"); return; }
  const routes = await getAll("routes");
  const route = routes.find(r => r.id == routeId);
  route.pins.push({ name: stopName, address: stopAddress, completed: false, stockAssigned: [] });
  await updateData("routes", route);
  document.getElementById("stopName").value = "";
  document.getElementById("stopAddress").value = "";
  displayRoute();
}

// Get offline coordinates from stops.json
async function getCoordinates(stopName) {
  const stops = await fetch('stops.json').then(r => r.json());
  const s = stops.find(x => x.stop === stopName);
  return s ? [s.lat, s.lon] : null;
}

async function displayRoute() {
  const routeId = document.getElementById("routeSelect").value;
  if (!routeId) return;
  const routes = await getAll("routes");
  const route = routes.find(r => r.id == routeId);
  const div = document.getElementById("routeList");
  if (!div) return;
  div.innerHTML = "";

  // Clear map markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  for (const [i, p] of route.pins.entries()) {
    const stockStr = p.stockAssigned.length ? p.stockAssigned.map(s => `${s.name}: ${s.qty}`).join(", ") : "No stock assigned";
    const stopDiv = document.createElement("div");
    stopDiv.className = "stopBox";
    stopDiv.innerHTML = `
      <strong>${p.name}</strong> - ${p.address || ""}<br>
      <label><input type="checkbox" ${p.completed ? "checked" : ""} onchange="toggleStop(${route.id},${i},this.checked)">Completed</label><br>
      Stock: ${stockStr}<br>
      <button onclick="assignStockToStop(${i})">Assign Stock</button>
    `;
    div.appendChild(stopDiv);

    // Add map pin using offline coordinates
    const coords = await getCoordinates(p.name);
    if (coords) {
      const marker = L.marker(coords).addTo(map);
      marker.bindPopup(`<strong>${p.name}</strong><br>${stockStr}`);
      markers.push(marker);
    }
  }
}

async function toggleStop(routeId, index, val) {
  const routes = await getAll("routes");
  const route = routes.find(r => r.id == routeId);
  route.pins[index].completed = val;
  await updateData("routes", route);
}

// ================== INVENTORY ==================
async function populateInventorySelect() {
  const inventory = await getAll("inventory");
  const select = document.getElementById("inventorySelect");
  if (!select) return;
  select.innerHTML = inventory.length ? inventory.map(i => `<option value="${i.id}">${i.name} (Available: ${i.qty})</option>`).join('') : "<option disabled>No items</option>";
  displayInventoryList();
}

async function displayInventoryList() {
  const div = document.getElementById("inventoryList");
  if (!div) return;
  const inventory = await getAll("inventory");
  div.innerHTML = inventory.map(i => `
    <div class="stopBox">
      ${i.name} - Qty: <input type="number" value="${i.qty}" onchange="updateInventory(${i.id},this.value)">
    </div>
  `).join("");
}

async function addInventoryPrompt() {
  const name = prompt("Item name");
  const qty = Number(prompt("Starting qty"));
  if (!name || isNaN(qty)) { alert("Invalid input"); return; }
  await addData("inventory", { name, qty, cost: 0, price: 0 });
  populateInventorySelect();
}

async function updateInventory(id, newQty) {
  const inventory = await getAll("inventory");
  const item = inventory.find(x => x.id == id);
  item.qty = Number(newQty);
  await updateData("inventory", item);
  populateInventorySelect();
}

// Assign stock to stop
async function assignStockToStop(stopIndex) {
  const routeId = document.getElementById("routeSelect").value;
  const itemId = document.getElementById("inventorySelect").value;
  const qty = Number(document.getElementById("stockAmount").value);
  if (!routeId || !itemId || qty <= 0) { alert("Select item & quantity"); return; }

  const routes = await getAll("routes");
  const route = routes.find(r => r.id == routeId);
  const stop = route.pins[stopIndex];

  const inventory = await getAll("inventory");
  const item = inventory.find(i => i.id == itemId);
  if (qty > item.qty) { alert("Not enough inventory"); return; }

  item.qty -= qty;
  await updateData("inventory", item);
  populateInventorySelect();

  stop.stockAssigned.push({ itemId, name: item.name, qty });
  await updateData("routes", route);
  displayRoute();
}

// ================== FINANCE ==================
async function populateFinanceRouteSelect() {
  const routes = await getAll("routes");
  const select = document.getElementById("financeRouteSelect");
  if (!select) return;
  select.innerHTML = routes.length ? routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('') : "<option disabled>No routes</option>";
}

async function submitFinance() {
  const routeId = document.getElementById("financeRouteSelect").value;
  const total = Number(document.getElementById("financeTotal").value);
  const notes = document.getElementById("financeNotes").value;
  if (!routeId || isNaN(total) || total <= 0) { alert("Select route & valid total"); return; }

  const routes = await getAll("routes");
  const route = routes.find(r => r.id == routeId);
  await addData("finance", { route: route.name, total, date: new Date().toLocaleString(), notes });
  alert("Finance recorded");
  document.getElementById("financeTotal").value = "";
  document.getElementById("financeNotes").value = "";
  displayFinance();
}

async function displayFinance() {
  const div = document.getElementById("financeList");
  if (!div) return;
  const finance = await getAll("finance");
  div.innerHTML = finance.map(f => `Route: ${f.route} | Total: $${f.total.toFixed(2)} | Notes: ${f.notes || "-"} | Date: ${f.date}`).join("<br>");
}

// ================== GAS ==================
async function displayGas() {
  const div = document.getElementById("gasList");
  if (!div) return;
  const gas = await getAll("gas");
  div.innerHTML = gas.map(g => `Cost: $${g.amount} | Miles: ${g.miles} | Date: ${g.date}`).join("<br>");
}

function addGasUI() {
  const amount = Number(prompt("Enter gas cost"));
  const miles = Number(prompt("Enter miles driven"));
  if (isNaN(amount) || isNaN(miles)) { alert("Invalid input"); return; }
  addData("gas", { amount, miles, date: new Date().toLocaleString() }).then(displayGas);
}
