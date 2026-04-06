// app.js - Versão limpa com apenas as 4 opções originais
import { HSKLISTS } from "./hsk_data.js";

const HSKDB = HSKLISTS;

const STORAGE_KEY = 'mandarim_pwa_offline_v3';
const INTERVALS = [0, 10, 1440, 2880, 7200, 21600, 43200, 86400];

let decks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let curSession = {
    deckIdx: 0,
    cards: [],
    cur: 0,
    mode: '',      // 'typing' ou 'choice'
    subMode: '',   // 'visual' ou 'audio'
    answered: false,
    sessionCorrect: 0,
    sessionTotal: 0
};

let voices = [];
let reviewLog = JSON.parse(localStorage.getItem('mandarim_review_log')) || [];

// ====================== SALVAR ======================
function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
    localStorage.setItem('mandarim_review_log', JSON.stringify(reviewLog));
}

// ====================== MIGRAÇÃO ======================
function migrateCards() {
    decks.forEach(deck => {
        deck.cards.forEach(card => {
            if (!card.pinyin) card.pinyin = '';
            if (!card.example) card.example = '';
            if (!card.failCount) card.failCount = 0;
            if (!card.easeFactor) card.easeFactor = 2.5;
            if (!card.intervalDays) card.intervalDays = 0;
            if (!card.attemptCount) card.attemptCount = 0;
            if (!card.correctCount) card.correctCount = 0;
        });
    });
    save();
}

// ====================== SRS AUTOMÁTICO ======================
function handleResult(isCorrect) {
    curSession.answered = true;
    const c = curSession.cards[curSession.cur];
    curSession.sessionTotal++;

    c.attemptCount = (c.attemptCount || 0) + 1;

    if (isCorrect) {
        c.correctCount = (c.correctCount || 0) + 1;
        curSession.sessionCorrect++;
        c.easeFactor = Math.max(1.3, (c.easeFactor || 2.5) * 1.12);
        c.level = (c.level || 0) + 1;
        c.intervalDays = Math.max(1, Math.round((c.intervalDays || 1) * c.easeFactor));
    } else {
        c.failCount = (c.failCount || 0) + 1;
        c.easeFactor = Math.max(1.3, (c.easeFactor || 2.5) * 0.78);
        c.level = Math.max(0, (c.level || 0) - 2);
        c.intervalDays = 1;
    }

    c.nextReview = Date.now() + (c.intervalDays * 86400000);

    const fb = document.getElementById('feedback');
    fb.innerText = isCorrect ? "🔥 Excelente!" : `🧊 Revisar: ${c.front}`;
    fb.style.color = isCorrect ? "var(--success)" : "var(--danger)";

    save();
    document.getElementById('next-btn').style.display = 'block';
    speak(c.front);
}

// ====================== RENDERIZAR CARTA ======================
function renderCard() {
    const c = curSession.cards[curSession.cur];
    const display = document.getElementById('display-term');

    document.getElementById('pinyin-display').style.display = 'none';
    document.getElementById('example-display').style.display = 'none';

    if (curSession.subMode === 'audio') {
        display.innerText = "🔊";
        speak(c.front);
    } else {
        // visual: mostra tradução (back)
        display.innerText = c.back || c.front;
    }

    document.getElementById('prog-text').innerText = `${curSession.cur + 1} / ${curSession.cards.length}`;
    document.getElementById('feedback').innerText = '';
    document.getElementById('next-btn').style.display = 'none';
    curSession.answered = false;

    const zone = document.getElementById('interaction-zone');
    zone.innerHTML = '';

    if (curSession.mode === 'typing') {
        zone.innerHTML = `<input type="text" id="type-in" placeholder="Digite o Hanzi..." autocomplete="off">`;
        const input = document.getElementById('type-in');
        input.addEventListener('keypress', e => { if (e.key === 'Enter') handleTyping(e); });
        setTimeout(() => input.focus(), 150);
    } 
    else if (curSession.mode === 'choice') {
        const correct = c.front;
        let opts = [correct];
        
        // Pega outras palavras do mesmo baralho
        const others = decks[curSession.deckIdx].cards
            .map(x => x.front)
            .filter(f => f !== correct)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);
        
        opts = [...opts, ...others].sort(() => Math.random() - 0.5);

        zone.innerHTML = `<div class="options-grid">${opts.map(o => 
            `<button class="opt-btn" onclick="checkChoice(this,'${o}')">${o}</button>`).join('')}</div>`;
    }
}

// ====================== RESPOSTAS ======================
function checkChoice(btn, val) {
    if (curSession.answered) return;
    const correct = curSession.cards[curSession.cur].front;
    if (val === correct) {
        btn.classList.add('correct');
        handleResult(true);
    } else {
        btn.classList.add('wrong');
        handleResult(false);
    }
}

function handleTyping(e) {
    if (curSession.answered) return;
    const userAnswer = e.target.value.trim();
    const correct = curSession.cards[curSession.cur].front;
    handleResult(userAnswer === correct);
}

// ====================== PINYIN E EXEMPLO ======================
function togglePinyin() {
    const el = document.getElementById('pinyin-display');
    const c = curSession.cards[curSession.cur];
    el.innerText = c.pinyin || '(Sem pinyin cadastrado)';
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function toggleExample() {
    const el = document.getElementById('example-display');
    const c = curSession.cards[curSession.cur];
    el.innerHTML = c.example 
        ? `<strong>Exemplo:</strong><br>${c.example}` 
        : 'Sem exemplo cadastrado.';
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ====================== INICIAR ESTUDO ======================
function startStudy(i, mode, subMode) {
    const due = decks[i].cards.filter(c => (c.nextReview || 0) <= Date.now() || (c.level || 0) === 0);
    if (!due.length) return alert("Nada para revisar no momento!");

    curSession = {
        deckIdx: i,
        mode: mode,           // 'typing' ou 'choice'
        subMode: subMode,     // 'visual' ou 'audio'
        cards: due.sort(() => Math.random() - 0.5).slice(0, 15),
        cur: 0,
        answered: false,
        sessionCorrect: 0,
        sessionTotal: 0
    };

    showSection('study-area');
    renderCard();
}

function processNext() {
    curSession.cur++;
    if (curSession.cur < curSession.cards.length) {
        renderCard();
    } else {
        // Registra estatística da sessão
        const today = new Date().toISOString().slice(0,10);
        let logEntry = reviewLog.find(r => r.date === today);
        if (!logEntry) {
            logEntry = { date: today, reviews: 0 };
            reviewLog.push(logEntry);
        }
        logEntry.reviews += curSession.sessionTotal;
        save();

        const percent = curSession.sessionTotal ? Math.round((curSession.sessionCorrect / curSession.sessionTotal) * 100) : 0;
        alert(`Sessão finalizada!\n\nAcertos: ${curSession.sessionCorrect}/${curSession.sessionTotal}\nRetenção: ${percent}%`);
        showSection('library');
    }
}

// ====================== RENDER DECKS ======================
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
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-top:10px;">
                    <button class="main-btn" style="font-size:0.62em" onclick="startStudy(${i},'typing','visual')">1. Tradução → Hanzi</button>
                    <button class="main-btn" style="font-size:0.62em;background:#2c3e50" onclick="startStudy(${i},'typing','audio')">2. Ouvir → Hanzi</button>
                    <button class="main-btn" style="font-size:0.62em;background:#8e44ad" onclick="startStudy(${i},'choice','visual')">3. Tradução → Escolha</button>
                    <button class="main-btn" style="font-size:0.62em;background:#d35400" onclick="startStudy(${i},'choice','audio')">4. Ouvir → Escolha</button>
                </div>
            </div>`;
    });

    document.getElementById('dash-total').innerText = tA;
    document.getElementById('dash-review').innerText = tR;
    document.getElementById('dash-mastery').innerText = tA ? Math.round((tM / tA) * 100) + "%" : "0%";
    renderHSK(hskM);
}

function getHSK(word) {
    for (let lvl in HSKDB) {
        if (HSKDB[lvl].some(item => word.includes(item) || item.includes(word))) return lvl;
    }
    return '';
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

// ====================== ESTATÍSTICAS ======================
function renderStats() {
    let totalCards = 0, totalAttempts = 0, totalCorrect = 0, leech = 0;
    decks.forEach(deck => {
        totalCards += deck.cards.length;
        deck.cards.forEach(c => {
            totalAttempts += c.attemptCount || 0;
            totalCorrect += c.correctCount || 0;
            if ((c.attemptCount || 0) > 5 && ((c.correctCount || 0) / (c.attemptCount || 1)) < 0.65) leech++;
        });
    });

    const retention = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    let html = `<p><strong>Retenção Geral:</strong> ${retention}%</p>`;
    html += `<p><strong>Cartas Leech:</strong> ${leech}</p>`;
    html += `<p><strong>Total de Cartas:</strong> ${totalCards}</p>`;

    document.getElementById('stats-content').innerHTML = html;
}

// ====================== OUTRAS FUNÇÕES ======================
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'library') renderDecks();
    if (id === 'stats') renderStats();
}

function saveDeck() {
    const n = document.getElementById('deck-name').value.trim();
    const t = document.getElementById('bulk-input').value.trim();
    if (!n || !t) return alert("Nome e conteúdo são obrigatórios!");

    const newCards = t.split('\n').map(l => {
        const parts = l.split(';').map(p => p.trim());
        return parts.length >= 2 ? {
            front: parts[0],
            pinyin: parts[1] || '',
            back: parts[2] || '',
            example: parts[3] || '',
            level: 0,
            nextReview: 0,
            failCount: 0,
            easeFactor: 2.5,
            intervalDays: 0,
            attemptCount: 0,
            correctCount: 0
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

// ====================== ÁUDIO ======================
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
    const selected = voices.find(v => v.name === document.getElementById('voice-select').value);
    if (selected) utterance.voice = selected;
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
}

function speakCurrent() {
    if (curSession.cards && curSession.cards[curSession.cur]) {
        speak(curSession.cards[curSession.cur].front);
    }
}

// ====================== BACKUP ======================
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

// ====================== INICIALIZAÇÃO ======================
window.addEventListener('load', () => {
    const splash = document.getElementById('splash');
    if (splash) {
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 300);
        }, 500);
    }

    migrateCards();
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    updateStreak();
    renderDecks();
    renderStats();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js');
    }
});

// ====================== FUNÇÕES GLOBAIS ======================
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
window.togglePinyin = togglePinyin;
window.toggleExample = toggleExample;