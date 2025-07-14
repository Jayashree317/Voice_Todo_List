
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "voiceTodoTasks";


const ctx = new (window.AudioContext || window.webkitAudioContext)();
let audioUnlocked = false;
document.addEventListener(
  "click",
  () => ctx.resume().then(() => (audioUnlocked = true)),
  {
    once: true,
  }
);
function beep() {
  if (!audioUnlocked) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.value = 0.15;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.18);
}


function toast(msg, type = "success", sticky = false, dur = 4000) {
  const bucket = $("toastBucket");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  bucket.appendChild(el);
  beep();
  if (!sticky) setTimeout(() => el.remove(), dur + 600);
  return el; 
}


let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let editingId = null;
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function renderTasks() {
  const taskList = $('taskList');
  const taskHeading = $('taskHeading');
  const noTasksMsg = $('noTasksMsg');

  taskList.innerHTML = '';

  if (tasks.length > 0) {
    taskHeading.style.display = 'block';
    noTasksMsg.style.display = 'none';
  } else {
    taskHeading.style.display = 'none';
    noTasksMsg.style.display = 'block';
  }

  tasks.forEach(t => {
    const li = document.createElement('li');
    li.dataset.id = t.id;
    li.innerHTML = `
      <span class="task-text">${t.text}</span>
      ${t.when ? `<span class="when">${fmtDate(t.when)}</span>` : ''}
      <button class="edit"><i class="fa-solid fa-pen" style="color:#74C0FC"></i></button>
      <button class="remove"><i class="fa-solid fa-trash-can" style="color:#ff0000"></i></button>`;
    taskList.appendChild(li);
  });
}


function addTask(text, when) {
  tasks.push({
    id: Date.now() + Math.random().toString(36).slice(2),
    text,
    when,
    notified: false,
  });
  toast("✅ Task added", "success");
}

function updateTask(id, text, when) {
  const t = tasks.find((x) => x.id === id);
  if (t) {
    t.text = text;
    t.when = when;
    toast("✏️ Task updated", "success");
  }
}

function removeTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  toast("🗑️ Task deleted", "danger");
}


function buildWhen() {
  const date = $("dateInput").value;
  let time = $("timeInput").value;
  const ampm = $("ampm").value;
  if (!(date && time)) return null;
  let [hh, mm] = time.split(":").map(Number);
  if (ampm === "PM" && hh < 12) hh += 12;
  if (ampm === "AM" && hh === 12) hh = 0;
  time = `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
  return new Date(`${date}T${time}:00`).toISOString();
}

function clearForm() {
  ["taskInput", "dateInput", "timeInput"].forEach((id) => ($(id).value = ""));
  $("ampm").value = "AM";
  editingId = null;
}


const languageMap = {
  "🇮🇳 Tanglish / Hinglish": "en-IN",
  "🇺🇸 English": "en-US",
  "🇮🇳 Hindi": "hi-IN",
  "🇮🇳 Tamil": "ta-IN",
};


const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
const rec = new Rec();
rec.interimResults = false;
rec.lang = languageMap[$("langSel").value.trim()] || "en-US";
let listeningToast = null;
let listening = false;

$("langSel").addEventListener("input", (e) => {
  const code = languageMap[e.target.value.trim()];
  if (code) {
    rec.lang = code;
  }
});

$("micBtn").onclick = () => (listening ? rec.stop() : rec.start());

rec.onstart = () => {
  listening = true;
  $("micBtn").textContent = "⏹️ Stop";
  listeningToast = toast("🎤 Listening…", "warning", true);
};

rec.onend = () => {
  listening = false;
  $("micBtn").textContent = "🎙️ Start";
  if (listeningToast) listeningToast.remove();
  listeningToast = null;
};

rec.onerror = (e) => toast("⚠️ " + e.error, "warning");

rec.onresult = (e) => {
  $("taskInput").value = e.results[0][0].transcript.trim();
  toast("📝 Heard: " + $("taskInput").value, "success");
};


$("addBtn").onclick = () => {
  const text = $("taskInput").value.trim();
  if (!text) return;
  const when = buildWhen();
  if (editingId) updateTask(editingId, text, when);
  else addTask(text, when);
  saveTasks();
  renderTasks();
  clearForm();
};

$("taskList").onclick = (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  const id = li.dataset.id;
  if (e.target.closest(".remove")) {
    removeTask(id);
    saveTasks();
    renderTasks();
  } else if (e.target.closest(".edit")) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    editingId = id;
    $("taskInput").value = t.text;
    if (t.when) {
      const d = new Date(t.when);
      $("dateInput").value = d.toISOString().slice(0, 10);
      let h = d.getHours(),
        amp = "AM";
      if (h >= 12) {
        amp = "PM";
        if (h > 12) h -= 12;
      }
      if (h === 0) h = 12;
      $("timeInput").value = `${h.toString().padStart(2, "0")}:${d
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      $("ampm").value = amp;
    }
  }
};


function notify(msg) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("Task Reminder", { body: msg });
    } catch {}
  }
  toast("⏰ " + msg, "warning");
}

function checkReminders() {
  const now = Date.now();
  let changed = false;
  tasks.forEach((t) => {
    if (t.when && !t.notified && new Date(t.when).getTime() <= now) {
      notify(t.text);
      t.notified = true;
      changed = true;
    }
  });
  if (changed) saveTasks();
}


(async () => {
  renderTasks();
  if ("Notification" in window && Notification.permission !== "granted") {
    await Notification.requestPermission();
  }
  checkReminders();
  setInterval(checkReminders, 30_000);
})();
