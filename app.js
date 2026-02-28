//=========================
// DayNight Vending App.js
// Complete offline + login + inventory combo
//=========================

let db;

// =======================
// IndexedDB Initialization
// =======================
async function initDB() {
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open('DayNightDB',5);

    request.onerror = e => reject('DB error');

    request.onsuccess = async e => {
      db = e.target.result;

      // Ensure stores exist
      ['inventory','drivers','routes','forms','users'].forEach(storeName=>{
        if(!db.objectStoreNames.contains(storeName)){
          db.createObjectStore(storeName,{keyPath:'id', autoIncrement:true});
        }
      });

      // Ensure default admin user
      const users = await getAllData('users');
      if(users.length===0){
        await addData('users',{username:'admin', password:'admin'});
        console.log('Default admin user created: admin/admin');
      }

      resolve();
    };

    request.onupgradeneeded = e=>{
      db = e.target.result;
      ['inventory','drivers','routes','forms','users'].forEach(storeName=>{
        if(!db.objectStoreNames.contains(storeName)){
          db.createObjectStore(storeName,{keyPath:'id', autoIncrement:true});
        }
      });
    };
  });
}

// =======================
// IndexedDB Helpers
// =======================
function getTransaction(storeName, mode='readonly'){ return db.transaction(storeName, mode).objectStore(storeName); }
function addData(store,data){ return new Promise(r=>getTransaction(store,'readwrite').add(data).onsuccess=r); }
function updateData(store,data){ return new Promise(r=>getTransaction(store,'readwrite').put(data).onsuccess=r); }
function getAllData(store){ return new Promise(r=>{ const arr=[]; const cursor=getTransaction(store).openCursor(); cursor.onsuccess=e=>{ const c=e.target.result; if(c){ arr.push(c.value); c.continue(); } else r(arr); }; }); }

// =======================
// Login & Registration
// =======================
async function login(){
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if(!username || !password) return alert('Enter username and password');

  const users = await getAllData('users');
  const user = users.find(u=>u.username===username && u.password===password);
  if(user){
    document.getElementById('loginPage').style.display='none';
    document.getElementById('mainApp').style.display='block';
    initializeApp();
  } else {
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
  if(users.find(u=>u.username===username)) return alert('Username already exists');

  await addData('users',{username,password});
  alert('Account created! You can now log in.');
  showLogin();
}

// =======================
// Show login page once DB ready
// =======================
window.addEventListener('DOMContentLoaded', async ()=>{
  await initDB();
  document.getElementById('loginPage').style.display='flex';
});
