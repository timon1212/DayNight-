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

      // Enable buttons
      document.getElementById('loginBtn').disabled=false;
      document.getElementById('registerBtn').disabled=false;
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
  await initDB(); // DB ready, login page buttons enabled
});
