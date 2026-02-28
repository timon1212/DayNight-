//=========================
// DayNight Vending App.js
// Full Inventory + Login + Offline Support
//=========================

// =======================
// IndexedDB Setup
// =======================
let db;
const request = indexedDB.open('DayNightDB', 3); // upgraded version

request.onerror = e => console.error('DB Error', e);
request.onsuccess = e => {
  db = e.target.result;
  console.log('DB initialized');
};

request.onupgradeneeded = e => {
  db = e.target.result;
  if(!db.objectStoreNames.contains('inventory')) db.createObjectStore('inventory',{keyPath:'id', autoIncrement:true});
  if(!db.objectStoreNames.contains('drivers')) db.createObjectStore('drivers',{keyPath:'id', autoIncrement:true});
  if(!db.objectStoreNames.contains('routes')) db.createObjectStore('routes',{keyPath:'id', autoIncrement:true});
  if(!db.objectStoreNames.contains('forms')) db.createObjectStore('forms',{keyPath:'id', autoIncrement:true});
  if(!db.objectStoreNames.contains('users')) db.createObjectStore('users',{keyPath:'id', autoIncrement:true});
};

// =======================
// IndexedDB Helpers
// =======================
function getTransaction(storeName, mode='readonly'){ return db.transaction(storeName, mode).objectStore(storeName); }
function addData(store, data){ return new Promise(r=>getTransaction(store,'readwrite').add(data).onsuccess=r); }
function updateData(store, data){ return new Promise(r=>getTransaction(store,'readwrite').put(data).onsuccess=r); }
function getAllData(store){ return new Promise(r=>{ const arr=[]; const cursor=getTransaction(store).openCursor(); cursor.onsuccess=e=>{const c=e.target.result;if(c){arr.push(c.value);c.continue();}else r(arr);}; }); }

// =======================
// LOGIN & REGISTRATION
// =======================
async function login(){
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if(!username || !password) return alert('Enter username and password');

  const users = await getAllData('users');
  const user = users.find(u => u.username === username && u.password === password);
  if(user){
    document.getElementById('loginPage').style.display='none';
    document.getElementById('mainApp').style.display='block';
    initializeApp();
  }else{
    alert('Invalid username or password');
  }
}

function showRegister(){ document.getElementById('registerFields').style.display='block'; }
function showLogin(){ document.getElementById('registerFields').style.display='none'; }

async function register(){
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  if(!username || !password) return alert('Fill username and password');

  const users = await getAllData('users');
  if(users.find(u => u.username === username)) return alert('Username already exists');

  await addData('users',{username,password});
  alert('Account created! You can now log in.');
  showLogin();
}

// =======================
// APP INITIALIZATION
// =======================
async function initializeApp(){
  // Ensure default inventory exists
  const inv = await getAllData('inventory');
  if(inv.length===0){
    await addData('inventory',{name:'Dumb Dumbs', cost:0.04, priceSingle:0.5, priceBundle:0.33, quantity:0});
  }

  // Now inventory definitely exists
  renderInventory();
  renderRoutesDropdowns();
  renderDriverLeaderboard();
  renderForms();
  await populateInventoryDropdown();
}

// =======================
// INVENTORY
// =======================
async function renderInventory(){
  const inv = await getAllData('inventory');
  const tbody = document.querySelector('#inventoryTable tbody');
  tbody.innerHTML='';
  inv.forEach(i=>{
    const profit = ((i.priceSingle-i.cost)*i.quantity).toFixed(2);
    const tr = document.createElement('tr');
    tr.innerHTML=`<td>${i.name}</td><td>$${i.cost}</td><td>$${i.priceSingle}</td><td>${i.quantity}</td><td>$${profit}</td><td>${i.quantity>0?'OK':'Restock Needed'}</td>`;
    tbody.appendChild(tr);
  });
}

// Populate dropdown for adding stock
async function populateInventoryDropdown(){
  const inventory = await getAllData('inventory');
  const select = document.getElementById('inventorySelect');
  if(!select) return;
  select.innerHTML='<option value="">--Select Item--</option>';
  inventory.forEach(i=>{
    const opt=document.createElement('option');
    opt.value=i.id;
    opt.textContent=`${i.name} (Qty: ${i.quantity})`;
    select.appendChild(opt);
  });
}

// Add stock to existing inventory
async function addInventoryStock(){
  const select=document.getElementById('inventorySelect');
  const qtyInput=document.getElementById('inventoryAddQty');
  const itemId=parseInt(select.value);
  const addQty=parseInt(qtyInput.value);
  if(isNaN(itemId) || isNaN(addQty)) return alert('Select item and enter quantity');

  const inventory=await getAllData('inventory');
  const item=inventory.find(i=>i.id===itemId);
  if(item){
    item.quantity+=addQty;
    await updateData('inventory',item);
    renderInventory();
    await populateInventoryDropdown();
    qtyInput.value='';
  }
}

// Add a new inventory item
async function addNewItem(){
  const name=document.getElementById('newItemName').value.trim();
  const cost=parseFloat(document.getElementById('newItemCost').value);
  const priceSingle=parseFloat(document.getElementById('newItemPriceSingle').value);
  const priceBundle=parseFloat(document.getElementById('newItemPriceBundle').value);
  const quantity=parseInt(document.getElementById('newItemQty').value);
  if(!name || isNaN(cost) || isNaN(priceSingle) || isNaN(priceBundle) || isNaN(quantity)){
    return alert('Fill all fields to add new item');
  }
  await addData('inventory',{name,cost,priceSingle,priceBundle,quantity});
  renderInventory();
  await populateInventoryDropdown();
  document.getElementById('newItemName').value='';
  document.getElementById('newItemCost').value='';
  document.getElementById('newItemPriceSingle').value='';
  document.getElementById('newItemPriceBundle').value='';
  document.getElementById('newItemQty').value='';
}

// =======================
// FINANCE
// =======================
function calculateFinance(){
  const spent=parseFloat(document.getElementById('moneySpent').value)||0;
  const earned=parseFloat(document.getElementById('moneyEarned').value)||0;
  const profit=(earned-spent).toFixed(2);
  document.getElementById('financeResult').innerHTML=`Profit: $${profit}`;
}

// =======================
// ROUTES, DRIVERS, FORMS, GAS
// =======================
// Copy your existing functions here (createNewRoute, addDriver, submitForm, computeGas, etc.)
// They remain unchanged from your last working version.
