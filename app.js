let db;
let map;
let markers = [];
let currentUser = null;
let watchId = null;

/* ============================
   DATABASE
============================ */

async function initDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open("DayNightDB", 11);

    request.onupgradeneeded = (e) => {
      db = e.target.result;
      ["inventory", "routes", "users"].forEach(store => {
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
   LOGIN SYSTEM
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
  await addData("users", {
    username: regUsername.value.trim(),
    password: regPassword.value.trim(),
    role: regRole.value
  });
  alert("User created");
}

/* ============================
   INITIALIZE
============================ */

window.addEventListener("DOMContentLoaded", async () => {
  await initDB();

  const users = await getAllData("users");
  if (users.length === 0) {
    await addData("users", {
      username: "admin",
      password: "admin",
      role: "admin"
    });
  }

  loginBtn.onclick = login;
  registerBtn.onclick = register;

  initMap();
});

/* ============================
   ROUTES
============================ */

async function initializeApp() {
  populateRoutes();
}

async function populateRoutes() {
  const routes = await getAllData("routes");
  routeSelect.innerHTML = "";

  routes.forEach(r => {
    routeSelect.innerHTML += `<option value="${r.id}">${r.name}</option>`;
  });

  if (routes.length > 0) displayRoute();
}

async function addRoute() {
  await addData("routes", {
    name: newRouteName.value,
    pins: []
  });
  populateRoutes();
}

async function addStop() {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeSelect.value);

  route.pins.push({
    name: stopName.value,
    address: stopAddress.value,
    lat: 30.47,
    lng: -90.1,
    notes: "",
    completed: false,
    deliveries: [],
    arrivalTime: null,
    departureTime: null,
    honorBoxCash: 0,
    slotsSold: 0,
    revenue: 0,
    photo: null
  });

  await updateData("routes", route);
  displayRoute();
}

async function deleteStop(index) {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeSelect.value);
  route.pins.splice(index, 1);
  await updateData("routes", route);
  displayRoute();
}

/* ============================
   DISPLAY ROUTE
============================ */

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
      Arrival: ${p.arrivalTime || "—"}<br>
      Departure: ${p.departureTime || "—"}<br>
      Revenue: $${p.revenue || 0}<br>

      Notes:
      <input value="${p.notes}" 
        onchange="updateNotes(${route.id},${i},this.value)"><br>

      Honor Box:
      <input type="number" value="${p.honorBoxCash}"
        onchange="updateMoney(${route.id},${i},this.value,p.slotsSold)"><br>

      Slots Sold:
      <input type="number" value="${p.slotsSold}"
        onchange="updateMoney(${route.id},${i},p.honorBoxCash,this.value)"><br>

      Photo:
      <input type="file" onchange="uploadPhoto(${route.id},${i},this)"><br>

      Completed:
      <input type="checkbox" ${p.completed ? "checked" : ""}
        onchange="toggleComplete(${route.id},${i},this.checked)"><br>

      <button onclick="moveStop(${route.id},${i},-1)">⬆</button>
      <button onclick="moveStop(${route.id},${i},1)">⬇</button>
      <button onclick="deleteStop(${i})">Delete</button>
      <hr>
    `;

    routeOrderList.appendChild(li);

    const marker = L.marker([p.lat, p.lng], { draggable: true }).addTo(map);
    markers.push(marker);

    marker.on("dragend", async e => {
      p.lat = e.target.getLatLng().lat;
      p.lng = e.target.getLatLng().lng;
      await updateData("routes", route);
    });
  });
}

/* ============================
   STOP FUNCTIONS
============================ */

async function updateNotes(routeId, index, value) {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeId);
  route.pins[index].notes = value;
  await updateData("routes", route);
}

async function updateMoney(routeId, index, cash, slots) {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeId);
  const stop = route.pins[index];

  stop.honorBoxCash = Number(cash);
  stop.slotsSold = Number(slots);
  stop.revenue = stop.honorBoxCash + stop.slotsSold;

  await updateData("routes", route);
  displayRoute();
}

async function toggleComplete(routeId, index, state) {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeId);
  const stop = route.pins[index];

  if (state && !stop.photo) {
    alert("Photo required before completing stop.");
    return;
  }

  if (state) stop.departureTime = new Date().toLocaleString();

  stop.completed = state;
  await updateData("routes", route);
  displayRoute();
}

async function uploadPhoto(routeId, index, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function() {
    const routes = await getAllData("routes");
    const route = routes.find(r => r.id == routeId);
    route.pins[index].photo = reader.result;
    await updateData("routes", route);
  };
  reader.readAsDataURL(file);
}

async function moveStop(routeId, index, dir) {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeId);

  const newIndex = index + dir;
  if (newIndex < 0 || newIndex >= route.pins.length) return;

  [route.pins[index], route.pins[newIndex]] =
    [route.pins[newIndex], route.pins[index]];

  await updateData("routes", route);
  displayRoute();
}

/* ============================
   ROUTE OPTIMIZER
============================ */

async function optimizeRoute() {
  const routes = await getAllData("routes");
  const route = routes.find(r => r.id == routeSelect.value);

  if (route.pins.length < 2) return;

  let optimized = [];
  let remaining = [...route.pins];
  optimized.push(remaining.shift());

  while (remaining.length > 0) {
    let last = optimized[optimized.length - 1];
    let nearestIndex = 0;
    let nearestDist = Infinity;

    remaining.forEach((stop, i) => {
      const d = getDistance(last.lat, last.lng, stop.lat, stop.lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIndex = i;
      }
    });

    optimized.push(remaining.splice(nearestIndex, 1)[0]);
  }

  route.pins = optimized;
  await updateData("routes", route);
  displayRoute();
}

/* ============================
   GPS TRACKING
============================ */

function startTracking() {
  if (!navigator.geolocation) return alert("GPS not supported");

  watchId = navigator.geolocation.watchPosition(async pos => {

    const routes = await getAllData("routes");
    const route = routes.find(r => r.id == routeSelect.value);

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    route.pins.forEach(stop => {
      const dist = getDistance(lat, lng, stop.lat, stop.lng);
      if (dist < 0.03 && !stop.arrivalTime) {
        stop.arrivalTime = new Date().toLocaleString();
        alert("Arrived at " + stop.name);
      }
    });

    await updateData("routes", route);
    displayRoute();

  }, null, { enableHighAccuracy: true });
}

function stopTracking() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
}

/* ============================
   DISTANCE FORMULA
============================ */

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI/180;
  const dLon = (lon2 - lon1) * Math.PI/180;

  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) *
    Math.cos(lat2*Math.PI/180) *
    Math.sin(dLon/2)**2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ============================
   MAP
============================ */

function initMap() {
  map = L.map("map").setView([30.47, -90.1], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  routeSelect.onchange = displayRoute;
}
