let db;
let map;
let markers = [];
let currentUser = null;

/* ============================
   DATABASE
============================ */

async function initDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open("DayNightDB", 10);

    request.onupgradeneeded = (e) => {
      db = e.target.result;

      ["inventory", "routes", "users", "forms", "sync"]
        .forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "id", autoIncrement: true });
          }
        });
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };
  });
}

function tx(store, mode = "readonly") {
  return db.transaction(store, mode).objectStore(store);
}

function addData(store, data) {
  return new Promise(res => tx(store, "readwrite").add(data).onsuccess = res);
}

function updateData(store, data) {
  return new Promise(res => tx(store, "readwrite").put(data).onsuccess = res);
}

function getAllData(store) {
  return new Promise(resolve => {
    const results = [];
    const cursor = tx(store).openCursor();
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        results.push(c.value);
        c.continue();
      } else resolve(results);
    };
  });
}

/* ============================
   LOGIN + ROLE SYSTEM
============================ */

async function login() {
  const u = loginUsername.value.trim();
  const p = loginPassword.value.trim();

  const users = await getAllData("users");
  const found = users.find(x => x.username === u && x.password === p);

  if (!found) return alert("Invalid login");

  currentUser = found;
  loginPage.style.display = "none";
  mainApp.style.display = "block";

  if (found.role === "driver") {
    adminPanel.style.display = "none";
  }

  initializeApp();
}

async function register() {
  const u = regUsername.value.trim();
  const p = regPassword.value.trim();
  const role = regRole.value;

  await addData("users", { username: u, password: p, role });
  alert("User created");
}

/* ============================
   ROUTES + STOPS
============================ */

async function addStopToRoute(routeId) {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeId);

  route.pins.push({
    name: stopName.value,
    address: stopAddress.value,
    lat: 30.47,
    lng: -90.1,
    notes: "",
    completed: false,
    deliveries: []
  });

  await updateData("routes", route);
  displayRoute();
}

async function displayRoute() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeSelect.value);

  routeOrderList.innerHTML = "";

  route.pins.forEach((p, i) => {

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${p.name}</strong><br>
      ${p.address}<br>
      Notes: <input value="${p.notes || ""}" onchange="updateNotes(${route.id},${i},this.value)">
      <br>
      Completed: 
      <input type="checkbox" ${p.completed ? "checked" : ""} 
        onchange="toggleComplete(${route.id},${i},this.checked)">
      <button onclick="moveStop(${route.id},${i},-1)">⬆</button>
      <button onclick="moveStop(${route.id},${i},1)">⬇</button>
    `;

    routeOrderList.appendChild(li);

    const m = L.marker([p.lat, p.lng], { draggable: true }).addTo(map);
    markers.push(m);

    m.on("dragend", async e => {
      p.lat = e.target.getLatLng().lat;
      p.lng = e.target.getLatLng().lng;
      await updateData("routes", route);
    });
  });
}

async function updateNotes(routeId, index, value) {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeId);
  route.pins[index].notes = value;
  await updateData("routes", route);
}

async function toggleComplete(routeId, index, state) {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeId);
  route.pins[index].completed = state;
  await updateData("routes", route);
}

async function moveStop(routeId, index, direction) {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeId);

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= route.pins.length) return;

  [route.pins[index], route.pins[newIndex]] =
    [route.pins[newIndex], route.pins[index]];

  await updateData("routes", route);
  displayRoute();
}

/* ============================
   ROUTE OPTIMIZER
============================ */

async function optimizeRoute(routeId) {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeId);

  route.pins.sort((a, b) => a.lat - b.lat);
  await updateData("routes", route);

  displayRoute();
}

/* ============================
   CLOUD SYNC (Basic JSON Export)
============================ */

async function exportBackup() {
  const data = {
    inventory: await getAllData("inventory"),
    routes: await getAllData("routes"),
    users: await getAllData("users")
  };

  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "backup.json";
  a.click();
}

/* ============================
   INIT MAP
============================ */

function initMap() {
  map = L.map("map").setView([30.47, -90.1], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  routeSelect.onchange = displayRoute;
}
