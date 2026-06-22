const STORAGE_KEY = 'mandarim_srs_cards';

export const storage = {
  getCards: () => JSON.parse(localStorage.getItem(STORAGE_KEY)) || [],
  
  saveCards: (cards) => localStorage.setItem(STORAGE_KEY, JSON.stringify(cards)),
  
  upsertCard: (card) => {
    const cards = storage.getCards();
    const index = cards.findIndex(c => c.id === card.id || c.hanzi.trim() === card.hanzi.trim());
    if (index !== -1) {
      cards[index] = { ...cards[index], ...card };
    } else {
      cards.push(card);
    }
    storage.saveCards(cards);
  },

  deleteCard: (id) => {
    const cards = storage.getCards().filter(c => c.id !== id);
    storage.saveCards(cards);
  },

  mergeDatabase: (incomingCards) => {
    const localCards = storage.getCards();
    let mergedCount = 0;

    incomingCards.forEach(incoming => {
      const matchIndex = localCards.findIndex(l => l.hanzi.trim() === incoming.hanzi.trim());
      
      if (matchIndex === -1) {
        // Palavra totalmente nova, insere no histórico
        localCards.push(incoming);
        mergedCount++;
      } else {
        // Palavra concorrente, mescla inteligência mantendo a de maior progresso/revisão recente
        const local = localCards[matchIndex];
        const incomingTime = incoming.ultimaRevisao ? new Date(incoming.ultimaRevisao).getTime() : 0;
        const localTime = local.ultimaRevisao ? new Date(local.ultimaRevisao).getTime() : 0;

        if (incomingTime > localTime || (incoming.nivel > local.nivel)) {
          localCards[matchIndex] = { ...local, ...incoming };
          mergedCount++;
        }
      }
    });

    storage.saveCards(localCards);
    return mergedCount;
  }
};