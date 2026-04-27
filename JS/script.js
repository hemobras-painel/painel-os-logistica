// === ARQUIVO: script.js ===

// 1. COLE O SEU LINK DO GOOGLE APPS SCRIPT AQUI DENTRO DAS ASPAS:
const API_URL = 'COLE_AQUI_O_SEU_LINK_QUE_TERMINA_EM_EXEC';

let todosDados = [];
let abaAtual = 'Serviço';

// Função para formatar a data de ISO para DD-MM-YYYY
function formatarData(dataOriginal) {
    if (!dataOriginal || dataOriginal === '-') return '-';
    
    const d = new Date(dataOriginal);
    
    // Verifica se a data é válida
    if (!isNaN(d.getTime())) {
        const dia = String(d.getUTCDate()).padStart(2, '0');
        const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
        const ano = d.getUTCFullYear();
        return `${dia}-${mes}-${ano}`;
    }
    
    return dataOriginal; 
}

function obterConfigStatus(statusReal) {
    const s = String(statusReal || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    
    if (s.includes('aberta')) return { icone: 'fa-file-lines', classe: 'bg-aberta' };
    if (s.includes('iniciado')) return { icone: 'fa-person-digging', classe: 'bg-iniciado' };
    if (s.includes('aprovacao')) return { icone: 'fa-hourglass-half', classe: 'bg-aprovacao' };
    if (s.includes('manutencao')) return { icone: 'fa-wrench', classe: 'bg-aprovacao' };
    if (s.includes('compras')) return { icone: 'fa-cart-shopping', classe: 'bg-aprovacao' };
    if (s.includes('realizada')) return { icone: 'fa-check', classe: 'bg-concluido' };
    if (s.includes('transito')) return { icone: 'fa-plane', classe: 'bg-transito' };
    if (s.includes('entregue')) return { icone: 'fa-box-open', classe: 'bg-concluido' };
    if (s.includes('concluido')) return { icone: 'fa-flag-checkered', classe: 'bg-concluido' };
    return { icone: 'fa-circle-dot', classe: 'bg-aberta' };
}

function pegarValor(item, nomesPossiveis) {
    for (let nome of nomesPossiveis) {
        const chaveReal = Object.keys(item).find(k => k.toLowerCase().trim() === nome.toLowerCase().trim());
        if (chaveReal && item[chaveReal]) return item[chaveReal];
    }
    return '';
}

async function buscarDados() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Erro na rede');
        
        todosDados = await response.json(); 
        
        document.getElementById('connIndicator').className = 'status-dot online';
        document.getElementById('connText').innerText = `Sincronizado: ${new Date().toLocaleTimeString().slice(0,5)}`;
        
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
        const tipoBruto = String(d.Tipo || 'SERVICO').toUpperCase().trim();

        const ehServico = tipoBruto.includes('SERVI');
        const ehCompra = tipoBruto.includes('COMPRA');

        if (abaAtual.includes('Servi')) {
            const compraEntregue = (ehCompra && (status.includes('Entregue') || status.includes('Realizada')));
            return (ehServico || compraEntregue) && (filtro === 'Todos' || status === filtro);
        }
        
        return ehCompra && (filtro === 'Todos' || status === filtro);
    });

    renderizarKPIs(filtrados);
    renderizarTabela(filtrados);
}

function renderizarTabela(lista) {
    const head = document.getElementById('tableHead');
    const body = document.getElementById('tableBody');
    
    if(lista.length === 0) {
        head.innerHTML = '';
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color:#6b7280;">Nenhum registro encontrado.</td></tr>';
        return;
    }

    let htmlHead = `<tr><th>Nº OS</th><th>Descrição / Local</th><th>Status</th><th>Responsável</th>`;
    if (abaAtual.includes('Compra')) htmlHead += `<th>Rastreamento</th>`;
    htmlHead += `<th>Data de Abertura</th></tr>`;
    
    let htmlBody = lista.map(item => {
        const conf = obterConfigStatus(item.Status);
        
        const obs = item.Observações ? `<span class="obs-text" style="display:block; font-size:12px; color:#ef4444; margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> ${item.Observações.replace(/^- /, '')}</span>` : '';
        
        const linkR = pegarValor(item, ['Link do Rastreio', 'Cód. Rastreio', 'Link Rastreio']);
        const codR = pegarValor(item, ['Cód. Rastreio', 'Codigo do Rastreio']);
        
        // Aqui aplicamos a formatação da data solicitada
        const dataBruta = pegarValor(item, ['Data de Abertura', 'Data']);
        const dataFormatada = formatarData(dataBruta);

        let row = `<tr>
            <td><strong>${item['Nº OS'] || '-'}</strong></td>
            <td style="max-width: 300px;">
                ${item['Descrição do Serviço'] || '-'}
                <br><small style="color:#6b7280;"><i class="fa-solid fa-location-dot"></i> ${item.Local || ''}</small>
                ${obs}
            </td>
            <td><span class="badge ${conf.classe}"><i class="fa-solid ${conf.icone}"></i> ${item.Status || 'O.S Aberta'}</span></td>
            <td>${item.Responsável || '-'}</td>`;
        
        if (abaAtual.includes('Compra')) {
            const ehLink = linkR && String(linkR).toLowerCase().startsWith('http');
            if(ehLink) {
                row += `<td><a href="${linkR}" target="_blank" class="btn-rastreio" style="background-color: #3b82f6; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none;"><i class="fa-solid fa-location-arrow"></i> Rastrear</a> <br><small style="color:#6b7280; margin-top:4px; display:block;">Cód: ${codR === linkR ? '-' : codR}</small></td>`;
            } else {
                row += `<td><span style="color:#9ca3af;">${codR || 'Aguardando Link'}</span></td>`;
            }
        }
        
        row += `<td><i class="fa-regular fa-calendar"></i> ${dataFormatada}</td></tr>`;
        
        return row;
    }).join('');

    head.innerHTML = htmlHead;
    body.innerHTML = htmlBody;
}

function renderizarKPIs(lista) {
    const grid = document.getElementById('kpiGrid');
    const total = lista.length;
    const concluidos = lista.filter(d => {
        const s = String(d.Status || '');
        return s.includes('Conclu') || s.includes('Entregue') || s.includes('Realizada');
    }).length;
    const emAndamento = total - concluidos;

    grid.innerHTML = `
        <div class="kpi-card" style="background: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 15px;">
            <div class="kpi-icon" style="background: #e0e7ff; color: #3b82f6; width: 45px; height: 45px; border-radius: 10px; display: flex; justify-content: center; align-items: center; font-size: 20px;"><i class="fa-solid fa-layer-group"></i></div>
            <div><h3 style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Total Registros</h3><p style="margin: 0; font-size: 24px; font-weight: bold; color: #111827;">${total}</p></div>
        </div>
        <div class="kpi-card" style="background: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 15px;">
            <div class="kpi-icon" style="background: #fef3c7; color: #d97706; width: 45px; height: 45px; border-radius: 10px; display: flex; justify-content: center; align-items: center; font-size: 20px;"><i class="fa-solid fa-spinner"></i></div>
            <div><h3 style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Pendente</h3><p style="margin: 0; font-size: 24px; font-weight: bold; color: #111827;">${emAndamento}</p></div>
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
        if(btn.innerText.includes(tipo.includes('Servi') ? 'Ordens' : 'Logística')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    document.getElementById('pageTitle').innerText = tipo.includes('Servi') ? 'Gestão de Serviços' : 'Gestão de Logística & Compras';
    atualizarPainel();
}

buscarDados();
setInterval(buscarDados, 60000);