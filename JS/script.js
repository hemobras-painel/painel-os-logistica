// === ARQUIVO: script.js ===

// 1. O SEU LINK DO GOOGLE APPS SCRIPT:
const API_URL = 'https://script.google.com/macros/s/AKfycbyt9ZEFqSyBwY_lGfxO6dbQupf52X44D1Lg9dkYAYRiNaxBemtuqCGTg5sfXCbcKxaePg/exec';

let todosDados = [];
let abaAtual = 'Serviço';

function formatarData(dataOriginal) {
    if (!dataOriginal || dataOriginal === '-' || dataOriginal === '') return '-';
    const d = new Date(dataOriginal);
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
        body.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 40px; color:#6b7280;">Nenhum registro encontrado.</td></tr>';
        return;
    }

    // CABEÇALHO ATUALIZADO
    let htmlHead = `<tr>
        <th>Nº OS</th>
        <th>Descrição / Local</th>
        <th>Sistema</th>
        <th>Status</th>
        <th>Responsável</th>
        <th>Equipe</th>
        <th>Abertura</th>
        <th>Conclusão</th>`;
    
    if (abaAtual.includes('Compra')) htmlHead += `<th>Rastreamento</th>`;
    htmlHead += `</tr>`;
    
    let htmlBody = lista.map(item => {
        const conf = obterConfigStatus(item.Status);
        const obs = item.Observações ? `<span class="obs-text" style="display:block; font-size:11px; color:#ef4444; margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> ${item.Observações.replace(/^- /, '')}</span>` : '';
        
        const linkR = pegarValor(item, ['Link do Rastreio', 'Cód. Rastreio', 'Link Rastreio']);
        const codR = pegarValor(item, ['Cód. Rastreio', 'Codigo do Rastreio']);
        
        // BUSCANDO NOVAS COLUNAS
        const sistema = pegarValor(item, ['Sistema', 'Tipo de Sistema']);
        const equipe = pegarValor(item, ['Equipe', 'Time', 'Grupo']);
        
        // DATAS
        const dataAbertura = formatarData(pegarValor(item, ['Data de Abertura', 'Data']));
        const dataConclusao = formatarData(pegarValor(item, ['Data de Conclusão', 'Conclusão', 'Data Fim']));

        let row = `<tr>
            <td><strong>${item['Nº OS'] || '-'}</strong></td>
            <td style="max-width: 200px;">
                ${item['Descrição do Serviço'] || '-'}
                <br><small style="color:#6b7280;"><i class="fa-solid fa-location-dot"></i> ${item.Local || ''}</small>
                ${obs}
            </td>
            <td><span style="font-size: 11px; font-weight: 500; color: #4b5563; background: #f3f4f6; padding: 3px 6px; border-radius: 4px;">${sistema || 'N/A'}</span></td>
            <td><span class="badge ${conf.classe}" style="font-size: 10px;"><i class="fa-solid ${conf.icone}"></i> ${item.Status || 'Aberto'}</span></td>
            <td style="font-size: 13px;">${item.Responsável || '-'}</td>
            
            <td style="font-size: 13px; font-weight: 500;">${equipe || '-'}</td>
            
            <td style="font-size: 12px; white-space: nowrap;"><i class="fa-regular fa-calendar" style="font-size: 10px;"></i> ${dataAbertura}</td>
            <td style="font-size: 12px; white-space: nowrap; color: #059669; font-weight: 500;">${dataConclusao !== '-' ? `<i class="fa-solid fa-check-circle" style="font-size: 10px;"></i> ${dataConclusao}` : '-'}</td>`;
        
        if (abaAtual.includes('Compra')) {
            const ehLink = linkR && String(linkR).toLowerCase().startsWith('http');
            if(ehLink) {
                row += `<td><a href="${linkR}" target="_blank" class="btn-rastreio" style="padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-location-arrow"></i> Rastrear</a></td>`;
            } else {
                row += `<td><span style="color:#9ca3af; font-size: 11px;">${codR || '-'}</span></td>`;
            }
        }
        
        row += `</tr>`;
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
        <div class="kpi-card" style="padding: 15px;">
            <div class="kpi-icon" style="background: #e0e7ff; color: #3b82f6; width: 40px; height: 40px; font-size: 18px;"><i class="fa-solid fa-layer-group"></i></div>
            <div><h3 style="font-size: 11px;">Total</h3><p style="font-size: 22px;">${total}</p></div>
        </div>
        <div class="kpi-card" style="padding: 15px;">
            <div class="kpi-icon" style="background: #fef3c7; color: #d97706; width: 40px; height: 40px; font-size: 18px;"><i class="fa-solid fa-spinner"></i></div>
            <div><h3 style="font-size: 11px;">Pendente</h3><p style="font-size: 22px;">${emAndamento}</p></div>
        </div>
        <div class="kpi-card" style="padding: 15px;">
            <div class="kpi-icon" style="background: #d1fae5; color: #10b981; width: 40px; height: 40px; font-size: 18px;"><i class="fa-solid fa-check-double"></i></div>
            <div><h3 style="font-size: 11px;">Finalizados</h3><p style="font-size: 22px;">${concluidos}</p></div>
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