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

  renderLoop: (targetElement) => {
    flashcards.initOrUpdateQueue();

    if (currentQueue.length === 0) {
      targetElement.innerHTML = `
        <div style="text-align:center; padding:30px; color:var(--text-muted);">
          <span style="font-size:3.5rem;">🎉</span>
          <p style="margin-top:15px; font-weight:600; color:var(--text-main);">Tudo limpo por aqui!</p>
          <p style="font-size:0.9rem; margin-top:5px;">Nenhuma revisão pendente no momento. Adicione palavras ou descanse.</p>
        </div>
      `;
      return;
    }

    currentCard = currentQueue[currentIndex];
    if (!currentCard._type) {
      currentCard._type = Math.random() > 0.5 ? 1 : 2;
    }
    cardType = currentCard._type;

    let html = `
      <div class="flashcard-header">
        <span>Fila de Revisão: ${currentIndex + 1} / ${currentQueue.length}</span>
        <span>Nível: ${currentCard.nivel}</span>
      </div>
    `;

    if (cardType === 1) {
      html += `
        <div class="prompt-display">${currentCard.traducao}</div>
        <input type="text" id="fc-input" class="input-field" placeholder="Digite em caracteres chineses (Hanzi)" autofocus autocomplete="off">
      `;
    } else {
      const options = flashcards.generateOptions(currentCard);
      html += `
        <div class="prompt-display">${currentCard.hanzi}</div>
        <div class="alternative-grid">
          ${options.map((opt, i) => `<button class="alt-btn" data-opt="${opt}">${String.fromCharCode(65 + i)}) ${opt}</button>`).join('')}
        </div>
      `;
    }

    html += `
      <div id="fc-feedback" class="feedback-box hidden"></div>
      <button id="fc-action-btn" class="btn">Verificar Resposta</button>
    `;

    targetElement.innerHTML = html;
    flashcards.bindEvents(targetElement);
  },

  generateOptions: (correctCard) => {
    const allCards = storage.getCards();
    const wrongTranslations = [...new Set(allCards
      .filter(c => c.traducao !== correctCard.traducao)
      .map(c => c.traducao))];

    wrongTranslations.sort(() => Math.random() - 0.5);
    const selected = wrongTranslations.slice(0, 3);
    selected.push(correctCard.traducao);
    
    while (selected.length < 4) {
      selected.push(`Opção Correlata ${selected.length + 1}`);
    }

    return selected.sort(() => Math.random() - 0.5);
  },

  bindEvents: (parent) => {
    const actionBtn = parent.querySelector('#fc-action-btn');
    const input = parent.querySelector('#fc-input');
    const altBtns = parent.querySelectorAll('.alt-btn');
    let answered = false;

    const evaluateAnswer = (userAnswer) => {
      if (answered) return;
      answered = true;

      const isCorrect = cardType === 1 
        ? userAnswer.trim() === currentCard.hanzi.trim()
        : userAnswer === currentCard.traducao;

      const feedback = parent.querySelector('#fc-feedback');
      feedback.classList.remove('hidden');

      const updated = scheduler.processAnswer(currentCard, isCorrect);
      storage.upsertCard(updated);

      if (isCorrect) {
        audioSystem.tocarBip('acerto');
        feedback.className = "feedback-box feedback-success";
        feedback.innerHTML = `✓ Correto!<br><br><span style="font-size:1.5rem">${currentCard.hanzi}</span><br>Pinyin: ${currentCard.pinyin}<br>Tradução: ${currentCard.traducao}`;
        
        setTimeout(() => {
          currentIndex++;
          flashcards.renderLoop(parent);
        }, 1000);
        
        if (input) input.disabled = true;
        altBtns.forEach(b => b.disabled = true);
        actionBtn.innerText = "Próxima Palavra";

      } else {
        // ✗ ERRO: Início da Lógica de Correção Ativa
        audioSystem.tocarBip('erro');
        
        feedback.className = "feedback-box feedback-danger";
        feedback.innerHTML = `
          <strong>Incorreto!</strong><br>
          Digite o Hanzi correto para prosseguir:<br>
          <span style="font-size:1.2rem">${currentCard.hanzi}</span> (${currentCard.pinyin})
        `;
        
        currentQueue.push(updated); // Mantém o card na fila

        // Prepara o input para o usuário escrever a resposta correta
        if (input) {
          input.disabled = false;
          input.value = "";
          input.placeholder = "Digite o Hanzi aqui...";
          input.focus();
        }

        // Altera o botão para validar a correção
        actionBtn.innerText = "Validar Correção";
        actionBtn.onclick = () => {
          const correcao = input.value.trim();
          if (correcao === currentCard.hanzi.trim()) {
            audioSystem.tocarBip('acerto');
            currentIndex++;
            flashcards.renderLoop(parent);
          } else {
            audioSystem.tocarBip('erro');
            input.value = "";
            input.placeholder = "Errado! Tente novamente.";
          }
        };
      }
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
        btn.addEventListener('click', () => evaluateAnswer(btn.dataset.opt));
      });
      actionBtn.addEventListener('click', () => {
        if (!answered) ui.showToast('Selecione uma alternativa!');
        else { currentIndex++; flashcards.renderLoop(parent); }
      });
    }
  }
};