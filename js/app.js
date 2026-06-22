import { storage } from './storage.js';
import { importExport } from './importExport.js';
import { flashcards } from './flashcards.js';
import { router } from './router.js';
import { audioSystem } from './audio.js'; // 🔊 Corrigido: Importação do sistema de áudio inserida!

let cardAtual = null;
let transicaoAtiva = false;

document.addEventListener('DOMContentLoaded', () => {
  console.log('Mandarim SRS PWA inicializado com sucesso.');
  
  // Inicia o gerenciamento das abas do menu
  inicializarAbas();
  
  // Força o carregamento da tela inicial (Estudos) logo no início
  const container = document.getElementById('app-container');
  if (container) {
    flashcards.renderLoop(container);
  }
});

function inicializarNavegacao() {
  const abas = ['tab-study', 'tab-management', 'tab-statistics', 'tab-sync'];

  abas.forEach(tabId => {
    const btn = document.getElementById(tabId);
    if (btn) {
      btn.addEventListener('click', () => {
        mostrarAba(tabId);
      });
    }
  });
}

// 1. GERENCIAMENTO DE ABAS ORIGINAL (Altera classes sem quebrar o app)
function inicializarAbas() {
  const tabs = {
    'tab-study': 'study',
    'tab-management': 'manage',
    'tab-statistics': 'stats',
    'tab-sync': 'io'
  };

  Object.keys(tabs).forEach(tabId => {
    const btn = document.getElementById(tabId);
    if (btn) {
      btn.addEventListener('click', () => {
        // 1. Atualiza visualmente os botões do menu
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const view = tabs[tabId];
        const container = document.getElementById('app-container');
        
        if (!container) return;

        // 2. Limpa o container principal antes de injetar a nova interface
        container.innerHTML = '';

        // 3. Renderiza o módulo correto baseado na aba selecionada
        if (view === 'study') {
          // Aba de Estudo usa o loop dinâmico do motor de flashcards
          flashcards.renderLoop(container);
        } else {
          // As outras abas delegam a construção para o router/módulos específicos
          router.executeViewModule(view, container);
        }
      });
    }
  });
}

// 2. LÓGICA DE ESTUDO COM BIPES E AVANÇO AUTOMÁTICO DE 1 SEGUNDO
function inicializarEventosEstudo() {
  const btnReveal = document.getElementById('btn-reveal-card') || document.getElementById('btn-reveal');
  const btnAcerto = document.getElementById('btn-srs-acerto') || document.getElementById('btn-easy') || document.getElementById('btn-good');
  const btnErro = document.getElementById('btn-srs-errado') || document.getElementById('btn-wrong');

  if (btnReveal) {
    btnReveal.addEventListener('click', () => {
      const answerSec = document.getElementById('flashcard-answer-section') || document.getElementById('card-answer');
      if (answerSec) answerSec.classList.remove('hidden');
      btnReveal.classList.add('hidden');
      
      const srsBox = document.getElementById('srs-buttons-box') || document.getElementById('srs-actions');
      if (srsBox) srsBox.classList.remove('hidden');
    });
  }

  if (btnAcerto) {
    btnAcerto.addEventListener('click', () => {
      if (transicaoAtiva) return;
      transicaoAtiva = true;

      // 👍 Feedback auditivo de acerto
      audioSystem.tocarBip('acerto');

      // Executa seu salvamento do SRS original
      if (cardAtual) {
        if (storage.updateCardProgress) storage.updateCardProgress(cardAtual.id, true);
        else if (storage.upsertCard) {
          cardAtual.nivel = Math.min(7, (cardAtual.nivel || 0) + 1);
          cardAtual.acertos = (cardAtual.acertos || 0) + 1;
          cardAtual.ultimaRevisao = new Date().toISOString().split('T')[0];
          storage.upsertCard(cardAtual);
        }
      }

      // ⏱️ Carrega o novo card automaticamente em exatamente 1 segundo
      setTimeout(() => {
        carregarProximoCard();
        transicaoAtiva = false;
      }, 1000);
    });
  }

  if (btnErro) {
    btnErro.addEventListener('click', () => {
      if (transicaoAtiva) return;

      // ❌ Feedback auditivo de erro
      audioSystem.tocarBip('erro');

      // Executa seu salvamento de erro original
      if (cardAtual) {
        if (storage.updateCardProgress) storage.updateCardProgress(cardAtual.id, false);
        else if (storage.upsertCard) {
          cardAtual.nivel = Math.max(0, (cardAtual.nivel || 0) - 1);
          cardAtual.erros = (cardAtual.erros || 0) + 1;
          cardAtual.ultimaRevisao = new Date().toISOString().split('T')[0];
          storage.upsertCard(cardAtual);
        }
      }
      
      // No erro, damos 1.5 segundos para o usuário ver o caractere correto antes de avançar sozinho
      transicaoAtiva = true;
      setTimeout(() => {
        carregarProximoCard();
        transicaoAtiva = false;
      }, 1500);
    });
  }
}

function carregarProximoCard() {
  // Reseta elementos visuais para o estado oculto padrão
  const answerSec = document.getElementById('flashcard-answer-section') || document.getElementById('card-answer');
  const btnReveal = document.getElementById('btn-reveal-card') || document.getElementById('btn-reveal');
  const srsBox = document.getElementById('srs-buttons-box') || document.getElementById('srs-actions');

  if (answerSec) answerSec.add ? answerSec.add('hidden') : answerSec.classList.add('hidden');
  if (btnReveal) btnReveal.classList.remove('hidden');
  if (srsBox) srsBox.classList.add('hidden');

  const cards = storage.getCards() || [];
  const ativos = cards.filter(c => !c.arquivado);

  if (ativos.length > 0) {
    // Escolhe um card aleatório para renderizar
    const indiceAleatorio = Math.floor(Math.random() * ativos.length);
    cardAtual = ativos[indiceAleatorio];
    
    // Injeta os textos diretamente nos elementos do seu HTML original
    const hanziDisplay = document.getElementById('hanzi-display') || document.querySelector('.hanzi-display');
    const pinyinDisplay = document.getElementById('pinyin-display') || document.querySelector('.pinyin-display');
    const meaningDisplay = document.getElementById('meaning-display') || document.querySelector('.meaning-display');

    if (hanziDisplay) hanziDisplay.innerText = cardAtual.hanzi || cardAtual.caractere || '';
    if (pinyinDisplay) pinyinDisplay.innerText = cardAtual.pinyin || '';
    if (meaningDisplay) meaningDisplay.innerText = cardAtual.traducao || cardAtual.significado || '';
  } else {
    cardAtual = null;
    const hanziDisplay = document.getElementById('hanzi-display') || document.querySelector('.hanzi-display');
    if (hanziDisplay) hanziDisplay.innerText = "🎉 Tudo Revisado!";
    if (btnReveal) btnReveal.classList.add('hidden');
  }
}

function mostrarAba(tabId) {
  // 1. Atualiza o estado visual dos botões do menu
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btnAtivo = document.getElementById(tabId);
  if (btnAtivo) btnAtivo.classList.add('active');

  // 2. Captura o container principal onde tudo será renderizado
  const container = document.getElementById('app-container');
  if (!container) return;

  // 3. Roteamento limpo: Renderiza o módulo correto baseado na aba clicada
  switch (tabId) {
    case 'tab-study':
      // Executa o loop de renderização do flashcard direto no container
      flashcards.renderLoop(container);
      break;
    case 'tab-management':
      management.render();
      break;
    case 'tab-statistics':
      statistics.render();
      break;
    case 'tab-sync':
      importExport.render();
      break;
    default:
      container.innerHTML = `<p style="text-align:center; padding:20px;">Aba não encontrada.</p>`;
  }
}

// Registro do Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('Service Worker ativo para escuta offline.', reg.scope))
      .catch(err => console.error('Erro ao registrar Service Worker:', err));
  });
}