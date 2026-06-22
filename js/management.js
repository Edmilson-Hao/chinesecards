import { storage } from './storage.js';
import { scheduler } from './scheduler.js';
import { ui } from './ui.js';

export const management = {
  render: () => {
    const container = document.getElementById('app-container');
    container.innerHTML = `
      <div class="card-panel">
        <h2 id="form-title">Inserir Nova Palavra</h2>
        <form id="crud-form" style="margin-top:15px;">
          <input type="hidden" id="card-id">
          <input type="text" id="form-hanzi" class="input-field" placeholder="Caracteres (Ex: 老师)" required>
          <input type="text" id="form-pinyin" class="input-field" placeholder="Pinyin (Ex: lǎoshī)" required>
          <input type="text" id="form-traducao" class="input-field" placeholder="Tradução (Ex: professor)" required>
          <div style="display:flex; gap:10px;">
            <button type="submit" class="btn" id="btn-form-save">Adicionar</button>
            <button type="button" class="btn btn-secondary hidden" id="btn-form-cancel" style="margin-top:0;">Cancelar</button>
          </div>
        </form>
      </div>

      <div class="card-panel">
        <h2>Importação Rápida em Lote</h2>
        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:10px;">Insira um bloco de texto contendo a estrutura JSON das palavras.</p>
        <textarea id="import-bulk-area" class="textarea-field" rows="4" placeholder='[\n  {"hanzi": "我", "pinyin": "wǒ", "traducao": "eu"}\n]'></textarea>
        <button id="btn-import-bulk" class="btn btn-secondary" style="width:auto; padding:10px 20px;">Processar JSON</button>
      </div>

      <div class="card-panel">
        <h2>Manutenção do Sistema</h2>
        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:15px;">Controles globais de cache e armazenamento local.</p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button id="btn-update-cache" class="btn btn-secondary" style="margin-top:0; border-color:#4299e1; color:#4299e1;">
            🔄 Atualizar Arquivos do Sistema (Limpar Cache)
          </button>
          <button id="btn-clear-all" class="btn" style="background-color:var(--danger);">
            ⚠️ Apagar Todos os Dados do Sistema
          </button>
        </div>
      </div>

      <div class="card-panel">
        <h2>Dicionário de Termos</h2>
        <input type="text" id="search-bar" class="input-field" style="margin-top:15px;" placeholder="Pesquisar por Hanzi, Pinyin ou Tradução...">
        <div id="words-list" style="max-height:300px; overflow-y:auto; margin-top:10px;"></div>
      </div>
    `;

    // Eventos antigos mantidos
    document.getElementById('crud-form').addEventListener('submit', management.handleSave);
    document.getElementById('btn-form-cancel').addEventListener('click', management.resetForm);
    document.getElementById('search-bar').addEventListener('input', management.updateList);
    document.getElementById('btn-import-bulk').addEventListener('click', management.handleBulkTextImport);

    // Novos Eventos de Manutenção do Sistema
    document.getElementById('btn-update-cache').addEventListener('click', management.forceSystemUpdate);
    document.getElementById('btn-clear-all').addEventListener('click', management.clearAllDatabase);

    management.updateList();
  },

  handleBulkTextImport: () => {
    const textarea = document.getElementById('import-bulk-area');
    try {
      const dataArray = JSON.parse(textarea.value.trim());
      if (!Array.isArray(dataArray)) throw new Error();

      const existingCards = storage.getCards();
      let importedCount = 0;
      const today = scheduler.getTodayString();

      dataArray.forEach(item => {
        if (!item.hanzi || !item.pinyin || !item.traducao) return;
        if (existingCards.some(c => c.hanzi.trim() === item.hanzi.trim())) return;

        existingCards.push({
          id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
          hanzi: item.hanzi.trim(),
          pinyin: item.pinyin.trim(),
          traducao: item.traducao.trim(),
          nivel: 0,
          acertos: 0,
          erros: 0,
          ultimaRevisao: null,
          proximaRevisao: null,
          criadoEm: today
        });
        importedCount++;
      });

      storage.saveCards(existingCards);
      ui.showToast(`${importedCount} palavras importadas!`);
      textarea.value = '';
      management.updateList();
    } catch (e) {
      ui.showToast('Erro: Estrutura de texto JSON inválida.');
    }
  },

  forceSystemUpdate: () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      ui.showToast("Buscando novas atualizações...");
      
      // Comunica ao SW ativo para pular o estado de espera imediatamente
      navigator.serviceWorker.ready.then((registration) => {
        registration.update().then(() => {
          caches.keys().then((names) => {
            return Promise.all(names.map(name => caches.delete(name)));
          }).then(() => {
            ui.showToast("Sistema atualizado com sucesso!");
            setTimeout(() => window.location.reload(), 1000);
          });
        });
      });
    } else {
      // Fallback para navegadores sem SW/PWA ativo no momento
      window.location.reload();
    }
  },

  clearAllDatabase: () => {
    const confirm1 = confirm("⚠️ ATENÇÃO: Isso apagará permanentemente todas as suas palavras inseridas e seu histórico de progresso e repetição espaçada!");
    if (!confirm1) return;

    const confirm2 = confirm("CONFIRMAÇÃO FINAL: Deseja mesmo deletar o banco de dados local? Essa ação não pode ser desfeita.");
    if (confirm2) {
      localStorage.clear();
      ui.showToast("Todos os dados foram excluídos.");
      setTimeout(() => window.location.reload(), 1200);
    }
  },

  updateList: () => {
    const listContainer = document.getElementById('words-list');
    const searchVal = document.getElementById('search-bar')?.value.toLowerCase() || '';
    const cards = storage.getCards();

    const filtered = cards.filter(c => 
      c.hanzi.toLowerCase().includes(searchVal) ||
      c.pinyin.toLowerCase().includes(searchVal) ||
      c.traducao.toLowerCase().includes(searchVal)
    );

    if (filtered.length === 0) {
      listContainer.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:20px;">Nenhum registro.</p>`;
      return;
    }

    listContainer.innerHTML = filtered.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
        <div>
          <div style="font-weight:bold; color:var(--accent);">${c.hanzi} <span style="font-weight:normal; color:var(--text-main); font-size:0.85rem;">(${c.pinyin})</span></div>
          <div style="font-size:0.85rem; color:var(--text-muted);">${c.traducao}</div>
        </div>
        <div style="display:flex; gap:12px; font-size:0.85rem;">
          <span class="edit-btn" data-id="${c.id}" style="color:#4299e1; cursor:pointer;">Editar</span>
          <span class="delete-btn" data-id="${c.id}" style="color:var(--danger); cursor:pointer;">Excluir</span>
        </div>
      </div>
    `).join('');

    listContainer.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => management.loadToEdit(b.dataset.id)));
    listContainer.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', () => management.handleDelete(b.dataset.id)));
  },

  handleSave: (e) => {
    e.preventDefault();
    const id = document.getElementById('card-id').value;
    const hanzi = document.getElementById('form-hanzi').value.trim();
    const pinyin = document.getElementById('form-pinyin').value.trim();
    const traducao = document.getElementById('form-traducao').value.trim();

    const cards = storage.getCards();
    if (!id && cards.some(c => c.hanzi === hanzi)) {
      ui.showToast('Esta palavra já existe!');
      return;
    }

    const base = id ? cards.find(c => c.id === id) : {};
    storage.upsertCard({
      ...base,
      id: id || Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
      hanzi, pinyin, traducao,
      nivel: base.nivel ?? 0,
      acertos: base.acertos ?? 0,
      erros: base.erros ?? 0,
      ultimaRevisao: base.ultimaRevisao ?? null,
      proximaRevisao: base.proximaRevisao ?? null,
      criadoEm: base.criadoEm ?? scheduler.getTodayString()
    });

    ui.showToast('Dados salvos!');
    management.resetForm();
    management.updateList();
  },

  loadToEdit: (id) => {
    const card = storage.getCards().find(c => c.id === id);
    if (!card) return;
    document.getElementById('card-id').value = card.id;
    document.getElementById('form-hanzi').value = card.hanzi;
    document.getElementById('form-pinyin').value = card.pinyin;
    document.getElementById('form-traducao').value = card.traducao;
    document.getElementById('form-title').innerText = "Editar Palavra";
    document.getElementById('btn-form-save').innerText = "Salvar";
    document.getElementById('btn-form-cancel').classList.remove('hidden');
  },

  handleDelete: (id) => {
    if (confirm('Excluir palavra?')) {
      storage.deleteCard(id);
      management.updateList();
      ui.showToast('Removido.');
    }
  },

  resetForm: () => {
    document.getElementById('crud-form').reset();
    document.getElementById('card-id').value = '';
    document.getElementById('form-title').innerText = "Inserir Nova Palavra";
    document.getElementById('btn-form-save').innerText = "Adicionar";
    document.getElementById('btn-form-cancel').classList.add('hidden');
  }
};