// === ARQUIVO: script.js ===

// 1. COLE O SEU LINK DO GOOGLE APPS SCRIPT AQUI DENTRO DAS ASPAS:
const API_URL = 'https://script.google.com/macros/s/AKfycbyt9ZEFqSyBwY_lGfxO6dbQupf52X44D1Lg9dkYAYRiNaxBemtuqCGTg5sfXCbcKxaePg/exec';

let todosDados = [];
let abaAtual = 'Serviço';

const statusConfig = {
    'O.S Aberta': { icone: 'fa-file-lines', classe: 'bg-aberta' },
    'Serviço Iniciado': { icone: 'fa-person-digging', classe: 'bg-iniciado' },
    'Aguardando Aprovação': { icone: 'fa-hourglass-half', classe: 'bg-aprovacao' },
    'Aguardando Manutenção': { icone: 'fa-wrench', classe: 'bg-aprovacao' },
    'Aguardando Compras': { icone: 'fa-cart-shopping', classe: 'bg-aprovacao' },
    'Compra Realizada': { icone: 'fa-check', classe: 'bg-concluido' },
    'Em Trânsito': { icone: 'fa-plane', classe: 'bg-transito' },
    'Objeto Entregue': { icone: 'fa-box-open', classe: 'bg-concluido' },
    'Serviço Concluído': { icone: 'fa-flag-checkered', classe: 'bg-concluido' }
};

function pegarValor(item, nomesPossiveis) {
    for (let nome of nomesPossiveis) {
        const chaveReal = Object.keys(item).find(k => k.toLowerCase().trim() === nome.toLowerCase().trim());
        if (chaveReal && item[chaveReal]) return item[chaveReal];
    }
    return '';
}

async function buscarDados() {
    try {
        console.log("Iniciando busca de dados na API...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Erro na rede');
        
        todosDados = await response.json(); 
        console.log(`Dados carregados com sucesso: ${todosDados.length} itens.`);
        
        document.getElementById('connIndicator').className = 'status-dot online';
        document.getElementById('connText').innerText = `Atualizado: ${new Date().toLocaleTimeString().slice(0,5)}`;
        
        popularFiltroStatus();
        atualizarPainel();

    } catch (erro) {
        console.error("Erro de conexão:", erro);
        document.getElementById('connIndicator').className = 'status-dot error';
        document.getElementById('connText').innerText = "Erro de conexão API!";
    }
}

function atualizarPainel() {
    const filtro = document.getElementById('statusFilter').value;
    
    const filtrados = todosDados.filter(d => {
        const status = (d.Status || '').trim();
        // Converte o Tipo para MAIÚSCULAS para ignorar erros de digitação na planilha
        const tipo = String(d.Tipo || 'SERVIÇO').toUpperCase().trim();

        if (abaAtual === 'Serviço') {
            const ehServico = tipo === 'SERVIÇO';
            const compraEntregue = (tipo === 'COMPRA' && (status === 'Objeto Entregue' || status === 'Compra Realizada'));
            return (ehServico || compraEntregue) && (filtro === 'Todos' || status === filtro);
        }
        
        // Aba Logística (Compra)
        return tipo === 'COMPRA' && (filtro === 'Todos' || status === filtro);
    });

    renderizarKPIs(filtrados);
    renderizarTabela(filtrados);
}

function renderizarTabela(lista) {
    const head = document.getElementById('tableHead');
    const body = document.getElementById('tableBody');
    
    if(lista.length === 0) {
        head.innerHTML = '';
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color:#6b7280;">Nenhum registro encontrado para esta aba.</td></tr>';
        return;
    }

    let htmlHead = `<tr><th>Nº OS</th><th>Descrição / Local</th><th>Status</th><th>Responsável</th>`;
    if (abaAtual === 'Compra') htmlHead += `<th>Rastreamento</th>`;
    htmlHead += `<th>Data de Abertura</th></tr>`;
    
    let htmlBody = lista.map(item => {
        const conf = statusConfig[item.Status] || { icone: 'fa-circle-dot', classe: 'bg-aberta' };
        
        const obs = item.Observações ? `<span class="obs-text" style="display:block; font-size:12px; color:#ef4444; margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> ${item.Observações.replace(/^- /, '')}</span>` : '';
        
        const linkR = pegarValor(item, ['Link do Rastreio', 'Cód. Rastreio', 'Link Rastreio']);
        const codR = pegarValor(item, ['Cód. Rastreio', 'Codigo do Rastreio']);
        const dataExibicao = pegarValor(item, ['Data de Abertura', 'Data']);

        let row = `<tr>
            <td><strong>${item['Nº OS'] || '-'}</strong></td>
            <td style="max-width: 300px;">
                ${item['Descrição do Serviço'] || '-'}
                <br><small style="color:#6b7280;"><i class="fa-solid fa-location-dot"></i> ${item.Local || ''}</small>
                ${obs}
            </td>
            <td><span class="badge ${conf.classe}"><i class="fa-solid ${conf.icone}"></i> ${item.Status}</span></td>
            <td>${item.Responsável || '-'}</td>`;
        
        if (abaAtual === 'Compra') {
            const ehLink = linkR && String(linkR).toLowerCase().startsWith('http');
            if(ehLink) {
                row += `<td><a href="${linkR}" target="_blank" class="btn-rastreio" style="background-color: #3b82f6; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none;"><i class="fa-solid fa-location-arrow"></i> Rastrear</a> <br><small style="color:#6b7280; margin-top:4px; display:block;">Cód: ${codR === linkR ? '-' : codR}</small></td>`;
            } else {
                row += `<td><span style="color:#9ca3af;">${codR || 'Aguardando Link'}</span></td>`;
            }
        }
        
        row += `<td>
            <i class="fa-regular fa-calendar"></i> ${dataExibicao || '-'}
        </td></tr>`;
        
        return row;
    }).join('');

    head.innerHTML = htmlHead;
    body.innerHTML = htmlBody;
}

function renderizarKPIs(lista) {
    const grid = document.getElementById('kpiGrid');
    const total = lista.length;
    const concluidos = lista.filter(d => d.Status === 'Serviço Concluído' || d.Status === 'Objeto Entregue' || d.Status === 'Compra Realizada').length;
    const emAndamento = total - concluidos;

    grid.innerHTML = `
        <div class="kpi-card" style="background: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 15px;">
            <div class="kpi-icon" style="background: #e0e7ff; color: #3b82f6; width: 45px; height: 45px; border-radius: 10px; display: flex; justify-content: center; align-items: center; font-size: 20px;"><i class="fa-solid fa-layer-group"></i></div>
            <div><h3 style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Total Registros</h3><p style="margin: 0; font-size: 24px; font-weight: bold; color: #111827;">${total}</p></div>
        </div>
        <div class="kpi-card" style="background: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 15px;">
            <div class="kpi-icon" style="background: #fef3c7; color: #d97706; width: 45px; height: 45px; border-radius: 10px; display: flex; justify-content: center; align-items: center; font-size: 20px;"><i class="fa-solid fa-spinner"></i></div>
            <div><h3 style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Em Andamento</h3><p style="margin: 0; font-size: 24px; font-weight: bold; color: #111827;">${emAndamento}</p></div>
        </div>
        <div class="kpi-card" style="background: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 15px;">
            <div class="kpi-icon" style="background: #d1fae5; color: #10b981; width: 45px; height: 45px; border-radius: 10px; display: flex; justify-content: center; align-items: center; font-size: 20px;"><i class="fa-solid fa-check-double"></i></div>
            <div><h3 style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Finalizados</h3><p style="margin: 0; font-size: 24px; font-weight: bold; color: #111827;">${concluidos}</p></div>
        </div>
    `;
}

function popularFiltroStatus() {
    const select = document.getElementById('statusFilter');
    const statusUnicos = [...new Set(todosDados.map(d => d.Status))].filter(s => s);
    select.innerHTML = '<option value="Todos">Todos os Status</option>';
    statusUnicos.forEach(s => select.innerHTML += `<option value="${s}">${s}</option>`);
}

function mudarAba(tipo) {
    abaAtual = tipo;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if(btn.innerText.includes(tipo === 'Serviço' ? 'Ordens' : 'Logística')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    document.getElementById('pageTitle').innerText = tipo === 'Serviço' ? 'Gestão de Serviços' : 'Gestão de Logística & Compras';
    atualizarPainel();
}

// Inicia e atualiza a cada 60 segundos automaticamente
buscarDados();
setInterval(buscarDados, 60000);