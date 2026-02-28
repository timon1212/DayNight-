let db;

// =======================
// IndexedDB Init
// =======================
async function initDB() {
  return new Promise((resolve)=>{
    const request = indexedDB.open('DayNightDB',6);

    request.onerror = e => console.error('DB Error', e);

    request.onsuccess = async e => {
      db = e.target.result;

      // Ensure stores exist
      ['inventory','drivers','routes','forms','users'].forEach(store=>{
        if(!db.objectStoreNames.contains(store)){
          db.createObjectStore(store,{keyPath:'id', autoIncrement:true});
        }
      });

      // Default admin
      const users = await getAllData('users');
      if(users.length===0){
        await addData('users',{username:'admin',password:'admin'});
        console.log('Default admin: admin/admin');
      }

      resolve();
    };

    request.onupgradeneeded = e=>{
      db = e.target.result;
      ['inventory','drivers','routes','forms','users'].forEach(store=>{
        if(!db.objectStoreNames.contains(store)){
          db.createObjectStore(store,{keyPath:'id', autoIncrement:true});
        }
      });
    };
  });
}

// =======================
// IndexedDB Helpers
// =======================
function getTransaction(store,mode='readonly'){ return db.transaction(store,mode).objectStore(store); }
function addData(store,data){ return new Promise(r=>getTransaction(store,'readwrite').add(data).onsuccess=r); }
function updateData(store,data){ return new Promise(r=>getTransaction(store,'readwrite').put(data).onsuccess=r); }
function getAllData(store){ return new Promise(r=>{ const arr=[]; const cursor=getTransaction(store).openCursor(); cursor.onsuccess=e=>{ const c=e.target.result; if(c){ arr.push(c.value); c.continue();} else r(arr); }; }); }

// =======================
// Login & Register
// =======================
async function login(){
  const username=document.getElementById('loginUsername').value.trim();
  const password=document.getElementById('loginPassword').value.trim();
  if(!username||!password)return alert('Enter username/password');

  const users = await getAllData('users');
  const user = users.find(u=>u.username===username&&u.password===password);
  if(user){
    document.getElementById('loginPage').style.display='none';
    document.getElementById('mainApp').style.display='block';
    initializeApp();
  }else alert('Invalid username/password');
}

function showRegister(){ document.getElementById('registerFields').style.display='block'; }
function showLogin(){ document.getElementById('registerFields').style.display='none'; }

async function register(){
  const username=document.getElementById('regUsername').value.trim();
  const password=document.getElementById('regPassword').value.trim();
  if(!username||!password)return alert('Fill username/password');

  const users = await getAllData('users');
  if(users.find(u=>u.username===username)) return alert('Username exists');

  await addData('users',{username,password});
  alert('Account created! Login now.');
  showLogin();
}

// =======================
// App Initialization
// =======================
window.addEventListener('DOMContentLoaded', async ()=>{
  await initDB(); // DB ready

  // Enable buttons
  document.getElementById('loginBtn').disabled=false;
  document.getElementById('registerBtn').disabled=false;

  // Attach event listeners
  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('registerBtn').addEventListener('click', register);
  document.getElementById('showRegisterLink').addEventListener('click', showRegister);
  document.getElementById('showLoginLink').addEventListener('click', showLogin);

  // Show login page
  document.getElementById('loginPage').style.display='flex';
});

// =======================
// Inventory Helpers
// =======================
async function initializeApp(){
  // Add default Dumb Dumbs if inventory empty
  const inv = await getAllData('inventory');
  if(inv.length===0){
    await addData('inventory',{name:'Dumb Dumbs', cost:0.04, priceSingle:0.5, priceBundle:0.33, quantity:0});
  }
  renderInventory();
  await populateInventoryDropdown();
}

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

async function populateInventoryDropdown(){
  const inventory = await getAllData('inventory');
  const select = document.getElementById('inventorySelect');
  select.innerHTML='<option value="">--Select Item--</option>';
  inventory.forEach(i=>{
    const opt=document.createElement('option');
    opt.value=i.id;
    opt.textContent=`${i.name} (Qty: ${i.quantity})`;
    select.appendChild(opt);
  });
}

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

document.getElementById('addStockBtn').addEventListener('click', addInventoryStock);

document.getElementById('addNewItemBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('newItemName').value.trim();
  const cost=parseFloat(document.getElementById('newItemCost').value);
  const priceSingle=parseFloat(document.getElementById('newItemPriceSingle').value);
  const priceBundle=parseFloat(document.getElementById('newItemPriceBundle').value);
  const quantity=parseInt(document.getElementById('newItemQty').value);
  if(!name||isNaN(cost)||isNaN(priceSingle)||isNaN(priceBundle)||isNaN(quantity)) return alert('Fill all fields');
  await addData('inventory',{name,cost,priceSingle,priceBundle,quantity});
  renderInventory();
  await populateInventoryDropdown();
});
