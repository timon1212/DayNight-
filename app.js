//=========================
// DayNight Vending App.js
// Offline-first, AI + ERP
// Full Inventory Management with New Item & Stock Addition
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
  await populateInventoryDropdown(); // ensures dropdown shows items
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

// Add stock to existing item
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
    await populateInventoryDropdown();
    qtyInput.value = '';
  }
}

// Add new inventory item
async function addNewItem(){
  const name = document.getElementById('newItemName').value.trim();
  const cost = parseFloat(document.getElementById('newItemCost').value);
  const priceSingle = parseFloat(document.getElementById('newItemPriceSingle').value);
  const priceBundle = parseFloat(document.getElementById('newItemPriceBundle').value);
  const quantity = parseInt(document.getElementById('newItemQty').value);

  if(!name || isNaN(cost) || isNaN(priceSingle) || isNaN(priceBundle) || isNaN(quantity)){
    return alert('Fill all fields to add new item');
  }

  await addData('inventory',{name,cost,priceSingle,priceBundle,quantity});
  renderInventory();
  await populateInventoryDropdown();

  // Clear input fields
  document.getElementById('newItemName').value='';
  document.getElementById('newItemCost').value='';
  document.getElementById('newItemPriceSingle').value='';
  document.getElementById('newItemPriceBundle').value='';
  document.getElementById('newItemQty').value='';
}
