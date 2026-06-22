// js/importExport.js
import { storage } from './storage.js';

let localPeer = null;

// Garante a injeção da biblioteca PeerJS exatamente como feito no projeto do Cubo
async function garantirPeerJS() {
    if (typeof Peer === 'undefined') {
        console.log("Injetando PeerJS dinamicamente via CDN estável...");
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
            script.onload = () => {
                console.log("PeerJS carregado e pronto para uso.");
                resolve();
            };
            script.onerror = () => reject(new Error("Falha ao carregar os scripts do PeerJS. Verifique a internet."));
            document.head.appendChild(script);
        });
    }
}

// Função de Toast interna e isolada (Não depende mais do ui.js)
function exibirAvisoRapido(mensagem) {
    let toast = document.getElementById('p2p-toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'p2p-toast-notification';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #3182ce;
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 0.9rem;
            z-index: 9999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    toast.innerText = mensagem;
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2500);
}

export const importExport = {
  render: () => {
    const container = document.getElementById('section-sync') || document.getElementById('app-container');
    if (!container) return;

    container.innerHTML = `
      <div class="card-panel">
        <span class="p2p-badge" style="background:#3182ce; color:white; padding:2px 8px; border-radius:4px; font-size:0.75rem;">Sincronização Numérica</span>
        <h2>Transferência Rápida</h2>
        <p style="color:var(--text-muted); font-size:0.85rem; margin-top:5px; margin-bottom:15px;">
          Use o código numérico de 5 dígitos para parear os dispositivos e transferir os dados diretamente.
        </p>

        <div id="p2p-monitor" style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; font-family: monospace; font-size: 0.8rem; color: #4299e1; margin-bottom: 15px; border-left: 3px solid #4299e1;">
          Status: Aguardando comando...
        </div>

        <!-- DISPOSITIVO 1: ENVIAR -->
        <div style="background:var(--bg-primary); padding:15px; border-radius:8px; margin-bottom:15px;">
          <h4 style="color:#4299e1;">Dispositivo 1: ENVIAR dados</h4>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:10px;">Gere o código para enviar deste aparelho.</p>
          <button id="btn-p2p-generate" class="btn">Gerar Código de 5 Dígitos</button>
          <div id="p2p-code-box" class="hidden">
            <div class="code-display" id="p2p-code-target" style="font-size:2rem; font-weight:bold; color:var(--accent); text-align:center; padding:10px; letter-spacing:5px;">-----</div>
            <p style="font-size:0.8rem; text-align:center; color:var(--text-muted);">Digite este número no aparelho que vai receber.</p>
          </div>
        </div>

        <!-- DISPOSITIVO 2: RECEBER -->
        <div style="background:var(--bg-primary); padding:15px; border-radius:8px;">
          <h4 style="color:#48bb78;">Dispositivo 2: RECEBER dados</h4>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:10px;">Insira o código numérico gerado no outro dispositivo.</p>
          <input type="number" id="p2p-input-code" class="input-field" placeholder="Ex: 48293" style="text-align:center; font-size:1.5rem; letter-spacing:4px; width:100%; margin-bottom:10px;">
          <button id="btn-p2p-sync" class="btn" style="background-color:#48bb78; width:100%;">Sincronizar 📥</button>
        </div>
      </div>
    `;

    document.getElementById('btn-p2p-generate').addEventListener('click', importExport.startAsSender);
    document.getElementById('btn-p2p-sync').addEventListener('click', importExport.startAsReceiver);
    
    importExport.disconnect();
  },

  log: (msg) => {
    const monitor = document.getElementById('p2p-monitor');
    if (monitor) monitor.innerText = `Status: ${msg}`;
  },

  disconnect: () => {
    if (localPeer) {
        try { localPeer.destroy(); } catch (e) {}
        localPeer = null;
    }
  },

  // 🚀 DISPOSITIVO 1: Abre a porta e espera a conexão
  startAsSender: async () => {
    importExport.log("Preparando servidor de sincronização...");
    
    try {
        await garantirPeerJS();
    } catch (err) {
        importExport.log(`❌ Erro: ${err.message}`);
        return;
    }

    importExport.disconnect();

    const codigoNumerico = Math.floor(10000 + Math.random() * 90000).toString();
    localPeer = new Peer(`mandarim-srs-${codigoNumerico}`);

    localPeer.on('open', (id) => {
        const codigoLimpo = id.replace('mandarim-srs-', '');
        document.getElementById('p2p-code-target').innerText = codigoLimpo;
        document.getElementById('p2p-code-box').classList.remove('hidden');
        document.getElementById('btn-p2p-generate').classList.add('hidden');
        importExport.log("Conectado à sala de pareamento. Pronto.");
    });

    localPeer.on('connection', (conn) => {
        importExport.log("Receptor detectado! Enviando chaves de rede...");
        
        conn.on('open', () => {
            importExport.log("⚡ CONECTADO! Transferindo dados...");
            exibirAvisoRapido("⚡ Aparelhos pareados!");

            conn.send(storage.getCards());
            
            importExport.log("Dados enviados com sucesso!");
            exibirAvisoRapido("Envio concluído!");
            setTimeout(() => importExport.disconnect(), 2000);
        });
    });

    localPeer.on('error', (err) => {
        console.error(err);
        if (err.type === 'unavailable-id') {
            importExport.log("Código em uso. Tentando gerar outro...");
            setTimeout(() => importExport.startAsSender(), 1000);
        } else {
            importExport.log("Erro ao abrir canal de transmissão.");
        }
    });
  },

  // 📱 DISPOSITIVO 2: Digita o código e puxa os dados
  startAsReceiver: async () => {
    const code = document.getElementById('p2p-input-code').value.trim();
    if (code.length !== 5) {
      exibirAvisoRapido("O código deve ter 5 dígitos.");
      return;
    }

    importExport.log("Verificando dependências de rede...");

    try {
        await garantirPeerJS();
    } catch (err) {
        importExport.log(`❌ Erro: ${err.message}`);
        return;
    }

    importExport.disconnect();
    importExport.log("Localizando par na rede...");

    localPeer = new Peer();

    localPeer.on('open', () => {
        const conn = localPeer.connect(`mandarim-srs-${code}`);

        conn.on('open', () => {
            importExport.log("Sala acessada! Sincronizando chaves remotas...");
        });

        conn.on('data', (incomingCards) => {
            importExport.log("Sincronizando registros no banco...");
            
            try {
                if (Array.isArray(incomingCards)) {
                    let merged = 0;
                    if (storage.mergeDatabase) {
                        merged = storage.mergeDatabase(incomingCards);
                    } else if (storage.saveCards) {
                        storage.saveCards(incomingCards);
                        merged = incomingCards.length;
                    }
                    
                    importExport.log(`Sucesso! ${merged} itens mesclados.`);
                    exibirAvisoRapido(`Concluído! ${merged} itens importados.`);
                    
                    setTimeout(() => {
                        importExport.disconnect();
                        // Recarrega a página para atualizar os cards na tela e zerar o app de forma limpa
                        window.location.reload(); 
                    }, 1500);
                }
            } catch (err) {
                importExport.log("Falha ao ler dados recebidos.");
            }
        });

        conn.on('error', (err) => {
            console.error(err);
            importExport.log("Erro na conexão com o par.");
        });
    });

    localPeer.on('error', (err) => {
        console.error(err);
        importExport.log("Não foi possível conectar. Verifique o código.");
    });
  }
};