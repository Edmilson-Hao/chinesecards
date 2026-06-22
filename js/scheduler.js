const INTERVALS = [0, 1, 3, 7, 14, 30, 90, 180];

const getTodayString = () => new Date().toISOString().split('T')[0];

const addDays = (dateStr, days) => {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const scheduler = {
  getTodayString,

  getQueue: (cards) => {
    const today = getTodayString();
    
    const reviewCards = cards.filter(c => c.proximaRevisao && c.proximaRevisao <= today);
    const newCards = cards.filter(c => !c.ultimaRevisao);

    reviewCards.sort((a, b) => a.proximaRevisao.localeCompare(b.proximaRevisao));
    newCards.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

    return [...reviewCards, ...newCards];
  },

  processAnswer: (card, isCorrect) => {
    const today = getTodayString();
    let nextLevel = card.nivel;

    if (isCorrect) {
      nextLevel = Math.min(INTERVALS.length - 1, card.nivel + 1);
    } else {
      nextLevel = Math.max(0, card.nivel - 2);
    }

    return {
      ...card,
      nivel: nextLevel,
      acertos: card.acertos + (isCorrect ? 1 : 0),
      erros: card.erros + (isCorrect ? 0 : 1),
      ultimaRevisao: today,
      proximaRevisao: addDays(today, INTERVALS[nextLevel])
    };
  }
};