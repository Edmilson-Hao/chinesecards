import { HSKLISTS } from "./hsk_data.js";

const HSKDB = HSKLISTS;

const STORAGE_KEY = 'mandarim_pwa_offline_v1';
const INTERVALS = [0, 10, 1440, 2880, 7200, 21600, 43200, 86400];

let decks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let curSession = { deckIdx: 0, cards: [], cur: 0, mode: '', subMode: '', answered: false };
let voices = [];

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

function renderHSK(data) {
    const hskContainer = document.getElementById('hsk-bars');
    hskContainer.innerHTML = '';
   ['hsk1','hsk2','hsk3','hsk4','hsk5','hsk6','hsk7_9'].forEach(lvl => {
        const total = HSKDB[lvl] ? HSKDB[lvl].length : 1;
        const p = Math.min(Math.round((data[lvl] / total) * 100), 100);
        hskContainer.innerHTML += `
            <div class="hsk-bar-container">
                <div class="hsk-meta"><span>${lvl.toUpperCase()}</span><span>${p}%</span></div>
                <div class="prog-bg" style="margin:0;height:6px;">
                    <div class="prog-fill ${lvl}" style="width:${p}%"></div>
                </div>
            </div>`;
    });
}

function getHSK(word) {
    for (let lvl in HSKDB) {
        if (HSKDB[lvl].some(item => 
            word.includes(item) || item.includes(word)
        )) {
            return lvl;
        }
    }
    return '';
}

function updateStreak() {
    const stats = JSON.parse(localStorage.getItem('mandarim_stats')) || { lastDate: '', streak: 0 };
    const today = new Date().toLocaleDateString('pt-BR');
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR');

    if (stats.lastDate === yesterday) stats.streak++;
    else if (stats.lastDate !== today) stats.streak = 1;

    stats.lastDate = today;
    localStorage.setItem('mandarim_stats', JSON.stringify(stats));
    document.getElementById('dash-streak').innerText = stats.streak;
}

function renderDecks() {
    const container = document.getElementById('deck-list');
    container.innerHTML = '';

    let tA = 0, tR = 0, tM = 0;
    const now = Date.now();
    let hskM = { hsk1: 0, hsk2: 0, hsk3: 0, hsk4: 0, hsk5: 0, hsk6: 0, hsk7_9: 0 };

    decks.forEach((d, i) => {
        const rev = d.cards.filter(c => (c.level || 0) < 6 && (c.nextReview || 0) <= now).length;
        const mas = d.cards.filter(c => (c.level || 0) >= 6).length;
        const perc = d.cards.length ? Math.round((mas / d.cards.length) * 100) : 0;

        d.cards.forEach(c => {
            if ((c.level || 0) >= 6) {
                const lvl = getHSK(c.front);
                if (lvl) hskM[lvl]++;
            }
        });

        tA += d.cards.length;
        tR += rev;
        tM += mas;

        container.innerHTML += `
            <div class="deck-card">
                <button onclick="deleteDeck(${i}, event)" style="position:absolute;top:10px;right:10px;border:none;background:none;color:#666;">✖</button>
                <strong class="deck-title">${d.name}</strong>
                <div class="prog-bg"><div class="prog-fill" style="width:${perc}%"></div></div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">
                    <button class="main-btn" style="font-size:0.6em" onclick="startStudy(${i},'typing','visual')">⌨ LER</button>
                    <button class="main-btn" style="font-size:0.6em;background:#8e44ad" onclick="startStudy(${i},'choice','visual')">🔘 LER</button>
                    <button class="main-btn" style="font-size:0.6em;background:#2c3e50" onclick="startStudy(${i},'typing','audio')">🎧 OUVIR</button>
                    <button class="main-btn" style="font-size:0.6em;background:#d35400" onclick="startStudy(${i},'choice','audio')">🔊 OUVIR</button>
                </div>
            </div>`;
    });

    document.getElementById('dash-total').innerText = tA;
    document.getElementById('dash-review').innerText = tR;
    document.getElementById('dash-mastery').innerText = tA ? Math.round((tM / tA) * 100) + "%" : "0%";
    renderHSK(hskM);
}

function loadVoices() {
    voices = window.speechSynthesis.getVoices();
    const select = document.getElementById('voice-select');
    select.innerHTML = voices
        .filter(v => v.lang.includes('zh'))
        .map(v => `<option value="${v.name}">${v.name}</option>`)
        .join('');
}

function speak(t) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(t);
    const selectedVoice = voices.find(v => v.name === document.getElementById('voice-select').value);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
}

// ==================== ESTUDO ====================
function startStudy(i, mode, subMode) {
    const due = decks[i].cards.filter(c => (c.nextReview || 0) <= Date.now() || (c.level || 0) === 0);
    if (!due.length) return alert("Nada para revisar!");

    curSession = {
        deckIdx: i,
        mode,
        subMode,
        cards: due.sort(() => Math.random() - 0.5).slice(0, 15),
        cur: 0,
        answered: false
    };

    showSection('study-area');
    renderCard();
}

function renderCard() {
    const c = curSession.cards[curSession.cur];
    const display = document.getElementById('display-term');

    if (curSession.subMode === 'audio') {
        display.innerText = "🔊";
        speak(c.front);
    } else {
        display.innerText = c.back.includes('-') ? c.back.split('-')[1].trim() : c.back;
    }

    document.getElementById('prog-text').innerText = `${curSession.cur + 1} / ${curSession.cards.length}`;
    document.getElementById('feedback').innerText = '';
    document.getElementById('next-btn').style.display = 'none';
    curSession.answered = false;

    const zone = document.getElementById('interaction-zone');

    if (curSession.mode === 'typing') {
        zone.innerHTML = `<input type="text" id="type-in" placeholder="Hanzi..." autocomplete="off">`;
        const input = document.getElementById('type-in');
        input.addEventListener('keypress', e => { if (e.key === 'Enter') handleTyping(e); });
        setTimeout(() => input.focus(), 150);
    } else {
        const opts = [c.front, ...decks[curSession.deckIdx].cards.map(x => x.front)
            .filter(f => f !== c.front)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3)]
            .sort(() => 0.5 - Math.random());

        zone.innerHTML = `<div class="options-grid">${opts.map(o => 
            `<button class="opt-btn" onclick="checkChoice(this,'${o}')">${o}</button>`).join('')}</div>`;
    }
}

function checkChoice(btn, val) {
    if (curSession.answered) return;
    if (val === curSession.cards[curSession.cur].front) {
        btn.classList.add('correct');
        handleResult(true);
    } else {
        btn.classList.add('wrong');
        handleResult(false);
    }
}

function handleTyping(e) {
    if (!curSession.answered) handleResult(e.target.value.trim() === curSession.cards[curSession.cur].front);
}

function handleResult(isCorrect) {
    curSession.answered = true;
    const c = curSession.cards[curSession.cur];

    if (isCorrect) c.level = (c.level || 0) + 1;
    else c.level = Math.max((c.level || 0) - 2, 0);

    c.nextReview = Date.now() + (INTERVALS[Math.min(c.level, 7)] * 60000);

    const fb = document.getElementById('feedback');
    fb.innerText = isCorrect ? "🔥 Excelente!" : "🧊 Revisar: " + c.front;
    fb.style.color = isCorrect ? "var(--success)" : "var(--danger)";

    save();
    document.getElementById('next-btn').style.display = 'block';
    speak(c.front);
}

function processNext() {
    curSession.cur++;
    if (curSession.cur < curSession.cards.length) renderCard();
    else showSection('library');
}

// ==================== OUTRAS FUNÇÕES ====================
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'library') renderDecks();
}

function saveDeck() {
    const n = document.getElementById('deck-name').value.trim();
    const t = document.getElementById('bulk-input').value.trim();
    if (!n || !t) return;

    const newCards = t.split('\n').map(l => {
        const parts = l.split(';');
        return parts.length >= 2 ? {
            front: parts[0].trim(),
            back: parts[1].trim(),
            level: 0,
            nextReview: 0
        } : null;
    }).filter(Boolean);

    decks.push({ name: n, cards: newCards });
    save();
    showSection('library');
    document.getElementById('deck-name').value = '';
    document.getElementById('bulk-input').value = '';
}

function deleteDeck(i, e) {
    e.stopPropagation();
    if (confirm("Apagar este baralho?")) {
        decks.splice(i, 1);
        save();
        renderDecks();
    }
}

function exportJSON() {
    const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(decks));
    const a = document.createElement('a');
    a.href = data;
    a.download = "mandarim_backup.json";
    a.click();
}

function importJSON(e) {
    const reader = new FileReader();
    reader.onload = ev => {
        decks = JSON.parse(ev.target.result);
        save();
        renderDecks();
        alert("✅ Backup restaurado!");
    };
    reader.readAsText(e.target.files[0]);
}

async function requestNotificationPermission() {
    if (await Notification.requestPermission() === 'granted') {
        alert("🔔 Notificações ativadas!");
    }
}

function speakCurrent() {
    if (curSession.cards && curSession.cards[curSession.cur]) {
        speak(curSession.cards[curSession.cur].front);
    }
}

// ==================== INICIALIZAÇÃO ====================
window.addEventListener('load', () => {
    // Splash
    const splash = document.getElementById('splash');
    if (splash) {
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => { splash.style.display = 'none'; }, 300);
        }, 500);
    }

    // Vozes
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices(); // primeira tentativa

    updateStreak();
    renderDecks();

    // Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('✅ Service Worker registrado'));
    }
});

// Tecla Enter no estudo
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('next-btn').style.display === 'block') {
        processNext();
    }
});

// Expor funções globais usadas no HTML
window.showSection = showSection;
window.saveDeck = saveDeck;
window.deleteDeck = deleteDeck;
window.startStudy = startStudy;
window.checkChoice = checkChoice;
window.processNext = processNext;
window.exportJSON = exportJSON;
window.importJSON = importJSON;
window.requestNotificationPermission = requestNotificationPermission;
window.speakCurrent = speakCurrent;