import { storage } from './storage.js';
import { scheduler } from './scheduler.js';

export const statistics = {
  render: () => {
    const cards = storage.getCards();
    const today = scheduler.getTodayString();
    
    const total = cards.length;
    const totalAcertos = cards.reduce((acc, c) => acc + (c.acertos || 0), 0);
    const totalErros = cards.reduce((acc, c) => acc + (c.erros || 0), 0);
    const taxaAcerto = totalAcertos + totalErros > 0 ? ((totalAcertos / (totalAcertos + totalErros)) * 100).toFixed(1) : 0;

    const pendentes = cards.filter(c => c.proximaRevisao && c.proximaRevisao <= today).length;
    const novas = cards.filter(c => !c.ultimaRevisao).length;

    const niveisCount = Array(8).fill(0);
    cards.forEach(c => { if(c.nivel >= 0 && c.nivel <= 7) niveisCount[c.nivel]++; });

    const container = document.getElementById('app-container');
    container.innerHTML = `
      <div class="card-panel">
        <h2>Métricas de Desempenho</h2>
        <br>
        <p>Total do Banco de Dados: <strong>${total} palavras</strong></p>
        <p>Aguardando Revisão: <strong>${pendentes}</strong></p>
        <p>Novas Inclusões: <strong>${novas}</strong></p>
        <hr style="margin:15px 0; border:0; border-top:1px solid rgba(255,255,255,0.1)">
        <p>Acertos Totais: <span style="color:var(--success)"><strong>${totalAcertos}</strong></span></p>
        <p>Erros Totais: <span style="color:var(--danger)"><strong>${totalErros}</strong></span></p>
        <p>Aproveitamento: <strong>${taxaAcerto}%</strong></p>
      </div>

      <div class="card-panel" style="text-align:center;">
        <h3>Curva de Memorização (Nível SRS)</h3>
        <canvas id="stats-canvas" width="300" height="160" style="margin-top:20px; max-width:100%"></canvas>
      </div>
    `;

    statistics.drawChart(niveisCount);
  },

  drawChart: (dataPoints) => {
    const canvas = document.getElementById('stats-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const width = canvas.width;
    const height = canvas.height;
    const maxVal = Math.max(...dataPoints, 1);
    
    ctx.clearRect(0, 0, width, height);
    const paddingLeft = 25;
    const paddingBottom = 20;
    const graphWidth = width - paddingLeft - 5;
    const graphHeight = height - paddingBottom - 10;
    const barWidth = graphWidth / dataPoints.length - 4;

    dataPoints.forEach((val, i) => {
      const barHeight = (val / maxVal) * graphHeight;
      const x = paddingLeft + i * (barWidth + 4) + 2;
      const y = height - paddingBottom - barHeight;

      ctx.fillStyle = `hsl(${10 + i * 18}, 75%, 50%)`;
      ctx.fillRect(x, y, barWidth, barHeight);

      if (val > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(val, x + barWidth / 2, y - 4);
      }

      ctx.fillStyle = '#a0aec0';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`N${i}`, x + barWidth / 2, height - 4);
    });
  }
};