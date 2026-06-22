// js/flashcards.js
import { scheduler } from './scheduler.js';
import { storage } from './storage.js';
import { ui } from './ui.js';
import { audioSystem } from './audio.js'; // 🔊 Injeta o sistema de áudio para os bipes

let currentQueue = [];
let currentIndex = 0;
let currentCard = null;
let cardType = 1; 

export const flashcards = {
  getActiveSessionQueue: () => currentQueue,
  getCurrentIndex: () => currentIndex,

  initOrUpdateQueue: () => {
    const allCards = storage.getCards();
    const freshQueue = scheduler.getQueue(allCards);
    
    if (currentQueue.length === 0 || currentIndex >= currentQueue.length) {
      currentQueue = freshQueue;
      currentIndex = 0;
    } else {
      const activeId = currentQueue[currentIndex]?.id;
      currentQueue = freshQueue;
      const newIdx = currentQueue.findIndex(c => c.id === activeId);
      currentIndex = newIdx !== -1 ? newIdx : 0;
    }
  },

  renderLoop: (parent) => {
    flashcards.initOrUpdateQueue();

    if (currentQueue.length === 0) {
      parent.innerHTML = `
        <div style="text-align:center; padding:30px; color:var(--text-muted);">
          <span style="font-size:3rem">🎉</span>
          <p>Tudo revisado por hoje!</p>
        </div>`;
      return;
    }

    currentCard = currentQueue[currentIndex];
    cardType = currentCard.type || 1;
    let answered = false;

    parent.innerHTML = `
      <div class="card-panel">
        <div class="stats">Fila: ${currentIndex + 1} / ${currentQueue.length}</div>
        <h2 id="card-title">${currentCard.traducao}</h2>
        ${cardType === 1 
          ? `<input type="text" id="fc-input" class="input-field" placeholder="Digite em caracteres chineses (Hanzi)" autocomplete="off">`
          : `<div id="choices-container"></div>`
        }
        <button id="action-btn" class="btn">Verificar</button>
        <div id="fc-feedback" class="feedback-box hidden"></div>
      </div>
    `;

    const input = parent.querySelector('#fc-input');
    const actionBtn = parent.querySelector('#action-btn');
    const feedback = parent.querySelector('#fc-feedback');
    const choicesContainer = parent.querySelector('#choices-container');
    let altBtns = [];

    // --- CORREÇÃO DE FOCO AUTOMÁTICO ---
    if (input) {
      setTimeout(() => {
        input.focus();
      }, 100);
    }
    // ------------------------------------

    if (cardType === 2) {
      const options = [currentCard.hanzi, ...storage.getCards().slice(0, 3).map(c => c.hanzi)];
      options.sort(() => Math.random() - 0.5);
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.innerText = opt;
        btn.onclick = () => evaluateAnswer(opt);
        choicesContainer.appendChild(btn);
        altBtns.push(btn);
      });
    }

    const evaluateAnswer = (userAnswer) => {
      if (answered) return;
      answered = true;

      const isCorrect = userAnswer.trim() === currentCard.hanzi.trim();
      feedback.classList.remove('hidden');
      
      const updated = scheduler.processAnswer(currentCard, isCorrect);
      storage.upsertCard(updated);

      if (isCorrect) {
        audioSystem.tocarBip('acerto');
        feedback.className = "feedback-box feedback-success";
        feedback.innerHTML = `✓ Correto!<br><br><strong>${currentCard.hanzi}</strong> (${currentCard.pinyin})`;
        setTimeout(() => { currentIndex++; flashcards.renderLoop(parent); }, 1000);
      } else {
        audioSystem.tocarBip('erro');
        feedback.className = "feedback-box feedback-danger";
        feedback.innerHTML = `✗ Incorreto!<br><br>Correto: <strong>${currentCard.hanzi}</strong><br>Pinyin: ${currentCard.pinyin}`;
        currentQueue.push(updated);
      }

      if (input) input.disabled = true;
      altBtns.forEach(b => b.disabled = true);
      actionBtn.innerText = "Próxima Palavra";
    };

    if (cardType === 1) {
      actionBtn.addEventListener('click', () => {
        if (!answered) evaluateAnswer(input.value);
        else { currentIndex++; flashcards.renderLoop(parent); }
      });
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          if (!answered) evaluateAnswer(input.value);
          else { currentIndex++; flashcards.renderLoop(parent); }
        }
      });
    } else {
      altBtns.forEach(btn => {
        btn.addEventListener('click', () => evaluateAnswer(btn.innerText));
      });
      actionBtn.addEventListener('click', () => {
        if (answered) { currentIndex++; flashcards.renderLoop(parent); }
      });
    }
  }
};