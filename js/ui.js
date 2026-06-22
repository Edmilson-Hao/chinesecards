// js/ui.js

export const ui = {
  /**
   * Exibe uma notificação temporária (Toast) na tela.
   * Utiliza a estrutura existente no seu index.html (<div id="toast" class="toast hidden"></div>)
   * @param {string} mensagem - Texto a ser exibido
   * @param {string} tipo - 'success' ou 'danger' para estilização opcional
   */
  showToast: (mensagem, tipo = 'success') => {
    const toast = document.getElementById('toast');
    if (!toast) {
      console.warn(`Elemento #toast não encontrado para exibir: ${mensagem}`);
      return;
    }

    toast.innerText = mensagem;
    toast.className = `toast visible ${tipo === 'danger' ? 'toast-danger' : ''}`;
    
    // Remove o comportamento de ocultar se houver um clique rápido ou timeout ativo
    if (toast.timeoutId) clearTimeout(toast.timeoutId);

    toast.timeoutId = setTimeout(() => {
      toast.className = 'toast hidden';
    }, 3000);
  }
};