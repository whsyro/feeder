const feedButton    = document.getElementById('feedButton');
const startInput    = document.getElementById('startTime');
const intervalInput = document.getElementById('interval');
const countInput    = document.getElementById('count');
const progName      = document.getElementById('progName');
const fishCountInput= document.getElementById('fishCount');
const fishAgeInput  = document.getElementById('fishAge');
const fishPreset    = document.getElementById('fishPreset');
const addButton     = document.getElementById('addProgram');
const setButton     = document.getElementById('setSchedule');
const stopButton    = document.getElementById('stopProgram');
const loadButton    = document.getElementById('loadProgram');
const deleteButton  = document.getElementById('deleteProgram');
const programList   = document.getElementById('programList');
const status        = document.getElementById('status');

let timeoutId = null, intervalId = null;
let currentBaseMoves = 1;

// Calculează câte feed cycles sunt necesare
function calculateFeedCount(baseMoves) {
  const numFish  = parseInt(fishCountInput.value) || 1;
  const ageYears = parseFloat(fishAgeInput.value) || 1;
  const ageFactor= 1 + (ageYears * 0.1);  // +10% hrană per an
  return Math.ceil(baseMoves * numFish * ageFactor);
}

// La selectarea unui preset
fishPreset.addEventListener('change', () => {
  const opt = fishPreset.selectedOptions[0];
  if (!opt.value) return;
  const base = parseInt(opt.dataset.moves);
  currentBaseMoves = base;
  const total = calculateFeedCount(base);
  countInput.value = total;
  progName.value   = opt.value;
  alert(`${opt.value}: ${total} mișcare${total>1?'i':''} (~${total*2} g pentru ${fishCountInput.value} pești, vârsta ${fishAgeInput.value} ani).`);
});

// Funcție de feed multiple cu buffer
function feedMultiple(times) {
  const movementDuration = 400;
   buffer = 500, delayStep = movementDuration + buffer;
  for (let i = 0; i < times; i++) {
    setTimeout(() => fetch('/feed').catch(e => console.error(e)), i * delayStep);
  }
}

// Hrănire manuală
feedButton.addEventListener('click', () => {
  const cnt = parseInt(countInput.value) || 1;
  const movementDuration = 400;  // ms servo active time
  const buffer = 500;            // ms safety buffer
  const delayStep = movementDuration + buffer;
  for (let i = 0; i < cnt; i++) {
    setTimeout(() => {
      fetch('/feed').catch(err => console.error('Feed error:', err));
    }, i * delayStep);
  }
  alert(`Hraănire manuală executată de ${cnt} ori!`);
});


// Programare hrănire automată
function scheduleFeed(time, mins, times) {
  clearTimeout(timeoutId); clearInterval(intervalId);
  const now = new Date(), [h,m] = time.split(':').map(Number);
  let first = new Date(now); first.setHours(h,m,0,0);
  if (first <= now) first.setDate(first.getDate()+1);
  const delay = first - now;
  timeoutId = setTimeout(() => {
    feedMultiple(times);
    intervalId = setInterval(() => feedMultiple(times), mins*60*1000);
  }, delay);
  status.textContent = `Program activ: ${time}, la fiecare ${mins} min, ${times} mișcări`;
}

// Buton “Pornește Imediat”
setButton.addEventListener('click', () => {
  const cnt = calculateFeedCount(currentBaseMoves);
  scheduleFeed(startInput.value, parseInt(intervalInput.value), cnt);
});

// Oprește programul
stopButton.addEventListener('click', () => {
  clearTimeout(timeoutId); clearInterval(intervalId);
  timeoutId = intervalId = null;
  status.textContent = 'Program oprit';
});

// LocalStorage pentru programe
function loadSchedules(){ return JSON.parse(localStorage.getItem('schedules')||'[]'); }
function saveSchedules(arr){ localStorage.setItem('schedules', JSON.stringify(arr)); }
function populateProgramList(){
  const arr = loadSchedules();
  programList.innerHTML = '<option value="">--Selectează--</option>';
  arr.forEach((s,i)=>{
    const o=document.createElement('option');
    o.value=i; o.textContent=s.name;
    programList.appendChild(o);
  });
}

// Salvează program nou
addButton.addEventListener('click', ()=>{
  const name=progName.value.trim(), time=startInput.value;
  const mins=parseInt(intervalInput.value);
  const times=parseInt(countInput.value);
  if(!name||!time||!mins||!times){
    alert('Completează toate câmpurile'); return;
  }
  const sc=loadSchedules();
  sc.push({ name, time, mins, times });
  saveSchedules(sc); populateProgramList();
  progName.value = '';
});

// Încarcă program salvat
loadButton.addEventListener('click', ()=>{
  const idx=programList.value;
  if(idx===''){ alert('Selectează un program'); return; }
  const s=loadSchedules()[idx];
  startInput.value=s.time;
  intervalInput.value=s.mins;
  countInput.value=s.times;
  scheduleFeed(s.time, s.mins, s.times);
});

// Șterge program
deleteButton.addEventListener('click', ()=>{
  const idx=programList.value;
  if(idx===''){ alert('Selectează un program'); return; }
  const sc=loadSchedules(); sc.splice(idx,1);
  saveSchedules(sc); populateProgramList();
});

// Inițializare listă programe
window.addEventListener('load', populateProgramList);
