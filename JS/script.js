// === ARQUIVO: script.js ===

// 1. O SEU LINK DO GOOGLE APPS SCRIPT:
const API_URL = 'https://script.google.com/macros/s/AKfycbyt9ZEFqSyBwY_lGfxO6dbQupf52X44D1Lg9dkYAYRiNaxBemtuqCGTg5sfXCbcKxaePg/exec';

let todosDados = [];
let abaAtual = 'Serviço';

function formatarData(dataOriginal) {
    if (!dataOriginal || dataOriginal === '-' || String(dataOriginal).trim() === '') return '-';
    const d = new Date(dataOriginal);
    if (!isNaN(d.getTime())) {
        const dia = String(d.getUTCDate()).padStart(2, '0');
        const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
        const ano = d.getUTCFullYear();
        return `${dia}/${mes}/${ano}`;
    }
    return dataOriginal; 
}

function obterConfigStatus(statusReal) {
    const s = String(statusReal || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    
    if (s.includes('solicitado') || s.includes('aberta')) return { icone: 'fa-hand-pointer', classe: 'bg-solicitado' };
    if (s.includes('cotacao')) return { icone: 'fa-file-invoice-dollar', classe: 'bg-cotacao' };
    if (s.includes('aguardando') || s.includes('aprovacao') || s.includes('iniciado') || s.includes('manutencao')) return { icone: 'fa-hourglass-half', classe: 'bg-alerta' };
    if (s.includes('aprovado')) return { icone: 'fa-thumbs-up', classe: 'bg-aprovado' };
    if (s.includes('transito') || s.includes('enviada')) return { icone: 'fa-truck-fast', classe: 'bg-transito' };
    if (s.includes('entregue') || s.includes('recebido') || s.includes('concluido') || s.includes('realizada')) return { icone: 'fa-check-double', classe: 'bg-concluido' };
    
    return { icone: 'fa-circle-dot', classe: 'bg-padrao' };
}

function pegarValor(item, nomesPossiveis) {
    for (let nome of nomesPossiveis) {
        const chaveReal = Object.keys(item).find(k => k.toLowerCase().trim() === nome.toLowerCase().trim());
        if (chaveReal && item[chaveReal]) return item[chaveReal];
    }
    return '';
}

async function forcarSincronizacao() {
    const icon = document.getElementById('syncIcon');
    icon.classList.add('fa-spin');
    await buscarDados();
    icon.classList.remove('fa-spin');
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
        const abaPlanilha = String(d.AbaOrigem || '').toUpperCase().trim();

        let pertenceAAba = false;
        if (abaAtual.includes('Servi') && abaPlanilha.includes('SERVI')) {
            pertenceAAba = true;
        } else if (abaAtual.includes('Compra') && (abaPlanilha.includes('COMPRA') || abaPlanilha.includes('LOGISTICA'))) {
            pertenceAAba = true;
        }

        return pertenceAAba && (filtro === 'Todos' || status === filtro);
    });
    
    renderizarKPIs(filtrados);
    renderizarTabela(filtrados);
}

function renderizarTabela(lista) {
    const head = document.getElementById('tableHead');
    const body = document.getElementById('tableBody');
    
    body.classList.remove('animate-fade');
    void body.offsetWidth; 
    body.classList.add('animate-fade');
    
    if(lista.length === 0) {
        head.innerHTML = '';
        body.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 40px; color:#64748b; font-weight: 500;">Nenhum registro encontrado nesta aba.</td></tr>';
        return;
    }

    let htmlHead = '';
    let htmlBody = '';

    if (abaAtual.includes('Servi')) {
        htmlHead = `<tr>
            <th style="width: 90px;">Nº OS</th>
            <th>Descrição / Local</th>
            <th>Sistema</th>
            <th>Status</th>
            <th>Responsável</th>
            <th>Equipe</th>
            <th>Abertura</th>
            <th>Conclusão</th>
        </tr>`;

        htmlBody = lista.map(item => {
            const conf = obterConfigStatus(item.Status);
            const obs = item.Observações ? `<span class="obs-text" style="display:block; font-size:10px; color:#ef4444; margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> ${item.Observações.replace(/^- /, '')}</span>` : '';
            const sistema = pegarValor(item, ['Sistema', 'Tipo de Sistema']);
            const equipe = pegarValor(item, ['Equipe', 'Time', 'Grupo']);
            const dataAbertura = formatarData(pegarValor(item, ['Data de Abertura', 'Data']));
            const dataConclusao = formatarData(pegarValor(item, ['Data de Conclusão', 'Conclusão', 'Data Fim']));
            const numeroOS = String(item['Nº OS'] || item['Nº'] || '').trim();

            const comprasVinculadas = todosDados.filter(d => {
                const abaPlanilha = String(d.AbaOrigem || '').toUpperCase();
                if (abaPlanilha.includes('COMPRA') || abaPlanilha.includes('LOGISTICA')) {
                    const osDestaCompra = String(pegarValor(d, ['O.S Vinculada', 'OS Relacionada', 'OS Serviço'])).trim();
                    return osDestaCompra === numeroOS && numeroOS !== '';
                }
                return false;
            });

            let badgeVinculo = '';
            if (comprasVinculadas.length > 0) {
                badgeVinculo = `<div style="margin-top: 6px;"><span style="font-size:9px; background:#eff6ff; color:#2563eb; padding:2px 5px; border-radius:4px; border: 1px solid #bfdbfe; font-weight: 600;"><i class="fa-solid fa-link"></i> ${comprasVinculadas.length} Compra(s) Vinculada(s)</span></div>`;
            }

            return `<tr>
                <td style="vertical-align: top;">
                    <strong style="font-size: 12px;">${numeroOS || '-'}</strong>
                    ${badgeVinculo}
                </td>
                <td style="max-width: 180px; vertical-align: top;">
                    <span style="font-size: 12px;">${pegarValor(item, ['Descrição do Serviço', 'Descrição']) || '-'}</span>
                    <br><small style="color:#64748b; font-size: 10px;"><i class="fa-solid fa-location-dot"></i> ${item.Local || 'N/A'}</small>
                    ${obs}
                </td>
                <td><span style="font-size: 10px; font-weight: 600; color: #475569; background: #f1f5f9; padding: 3px 6px; border-radius: 6px;">${sistema || 'N/A'}</span></td>
                <td><span class="badge ${conf.classe}"><i class="fa-solid ${conf.icone}"></i> ${item.Status || 'Aberto'}</span></td>
                <td style="font-size: 12px; font-weight: 500; color: #334155;">${item.Responsável || '-'}</td>
                <td style="font-size: 12px; font-weight: 500; color: #334155;">${equipe || '-'}</td>
                <td style="font-size: 11px; white-space: nowrap; color: #64748b;"><i class="fa-regular fa-calendar"></i> ${dataAbertura}</td>
                <td style="font-size: 11px; white-space: nowrap; color: #059669; font-weight: 600;">${dataConclusao !== '-' ? `<i class="fa-solid fa-check-circle"></i> ${dataConclusao}` : '-'}</td>
            </tr>`;
        }).join('');
    } 
    // === TABELA DE COMPRAS / LOGÍSTICA (COMPRIMIDA) ===
    else {
        htmlHead = `<tr>
            <th style="width: 80px;">Nº / Status</th>
            <th>Descrição do Item</th>
            <th style="text-align:center;">Qtd</th>
            <th>Prioridade</th>
            <th>Solicitante</th>
            <th title="Data de Solicitação">Solicitado</th>
            <th title="Data de Cotação enviada a HB">Cotação</th>
            <th title="Aprovado HB">Aprovado</th>
            <th title="Previsão de entrega">Previsão</th>
            <th title="Data de entrega no Site">Entregue</th>
        </tr>`;

        htmlBody = lista.map(item => {
            const conf = obterConfigStatus(item.Status);
            
            const numeroCompra = item['Nº'] || item['Nº OS'] || '-';
            const descricao = pegarValor(item, ['Descrição do item', 'Descrição']);
            const qtd = pegarValor(item, ['Qtd Solicitada', 'Qtde. Solicitada', 'Qtd']);
            const prioridade = pegarValor(item, ['Prioridade (alta/média/baixa)', 'Prioridade']);
            const solicitante = pegarValor(item, ['Solicitante']);
            
            const dtSolicitado = formatarData(pegarValor(item, ['Solicitado? Data', 'Data de solicitação', 'Data Solicitação']));
            const dtCotacao = formatarData(pegarValor(item, ['Cotação enviada HB? Data', 'Data de Cotação enviada a HB', 'Cotação enviada HB']));
            const dtAprovado = formatarData(pegarValor(item, ['Aprovado HB? Data', 'Aprovado HB']));
            const dtPrevisao = formatarData(pegarValor(item, ['Previsão de Entrega', 'Previsão de entrega', 'Previsão']));
            const dtEntregue = formatarData(pegarValor(item, ['Data Entregue', 'Data de entrega no Site', 'Entregue']));

            let corPrioridade = '#64748b'; let bgPrioridade = '#f1f5f9';
            if(prioridade.toLowerCase().includes('alta')) { corPrioridade = '#dc2626'; bgPrioridade = '#fef2f2'; }
            else if(prioridade.toLowerCase().includes('méd') || prioridade.toLowerCase().includes('med')) { corPrioridade = '#d97706'; bgPrioridade = '#fffbeb'; }
            else if(prioridade.toLowerCase().includes('baix')) { corPrioridade = '#059669'; bgPrioridade = '#ecfdf5'; }

            const pillPrioridade = prioridade ? `<span style="font-size: 9px; background: ${bgPrioridade}; color: ${corPrioridade}; padding: 3px 6px; border-radius: 6px; font-weight: 700; white-space: nowrap; border: 1px solid ${corPrioridade}30;">${prioridade.toUpperCase()}</span>` : '-';

            const osVinculada = pegarValor(item, ['O.S Vinculada', 'OS Relacionada', 'OS Serviço']);
            let badgeRef = osVinculada ? `<div style="margin-top: 4px;"><span style="font-size:8px; background:#f1f5f9; color:#475569; padding:2px 5px; border-radius:4px; font-weight: 600; border: 1px solid #e2e8f0;"><i class="fa-solid fa-link"></i> OS ${osVinculada}</span></div>` : '';

            return `<tr>
                <td style="vertical-align: top;">
                    <div style="font-weight: 700; font-size: 12px; margin-bottom: 4px; color: #0f172a;">${numeroCompra}</div>
                    <span class="badge ${conf.classe}" style="padding: 2px 5px;"><i class="fa-solid ${conf.icone}"></i> ${item.Status || 'Status Vazio'}</span>
                    ${badgeRef}
                </td>
                <td style="font-size: 12px; vertical-align: top; max-width: 180px; word-wrap: break-word; color: #334155;">
                    ${descricao || '-'}
                </td>
                <td style="font-size: 13px; font-weight: 700; text-align: center; color: #0f172a;">${qtd || '-'}</td>
                <td style="vertical-align: middle;">${pillPrioridade}</td>
                <td style="font-size: 12px; font-weight: 500; color: #334155;">${solicitante || '-'}</td>
                
                <td style="font-size: 11px; white-space: nowrap; color: #64748b;">${dtSolicitado !== '-' ? `<i class="fa-regular fa-calendar-plus"></i> ${dtSolicitado}` : '-'}</td>
                <td style="font-size: 11px; white-space: nowrap; color: #64748b;">${dtCotacao !== '-' ? `<i class="fa-regular fa-envelope"></i> ${dtCotacao}` : '-'}</td>
                <td style="font-size: 11px; white-space: nowrap; color: #0284c7; font-weight: 500;">${dtAprovado !== '-' ? `<i class="fa-solid fa-thumbs-up"></i> ${dtAprovado}` : '-'}</td>
                <td style="font-size: 11px; white-space: nowrap; color: #d97706; font-weight: 500;">${dtPrevisao !== '-' ? `<i class="fa-regular fa-clock"></i> ${dtPrevisao}` : '-'}</td>
                <td style="font-size: 11px; white-space: nowrap; color: #059669; font-weight: 700;">${dtEntregue !== '-' ? `<i class="fa-solid fa-box-open"></i> ${dtEntregue}` : '-'}</td>
            </tr>`;
        }).join('');
    }

    head.innerHTML = htmlHead;
    body.innerHTML = htmlBody;
}

function renderizarKPIs(lista) {
    const grid = document.getElementById('kpiGrid');
    const total = lista.length;
    const concluidos = lista.filter(d => {
        const s = String(d.Status || '').toLowerCase();
        return s.includes('conclu') || s.includes('entregue') || s.includes('realizada') || s.includes('aprovado');
    }).length;
    const emAndamento = total - concluidos;

    grid.innerHTML = `
        <div class="kpi-card">
            <div class="kpi-icon" style="background: #eff6ff; color: #3b82f6;"><i class="fa-solid fa-layer-group"></i></div>
            <div><h3 style="margin:0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Total</h3><p style="margin:0; font-size: 24px; font-weight: 800; color: #0f172a;">${total}</p></div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background: #fffbeb; color: #d97706;"><i class="fa-solid fa-spinner"></i></div>
            <div><h3 style="margin:0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Em Andamento</h3><p style="margin:0; font-size: 24px; font-weight: 800; color: #0f172a;">${emAndamento}</p></div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background: #ecfdf5; color: #10b981;"><i class="fa-solid fa-check-double"></i></div>
            <div><h3 style="margin:0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Finalizados</h3><p style="margin:0; font-size: 24px; font-weight: 800; color: #0f172a;">${concluidos}</p></div>
        </div>
    `;
}

function popularFiltroStatus() {
    const select = document.getElementById('statusFilter');
    const valorAtual = select.value; 

    const filtradosAba = todosDados.filter(d => {
        const abaPlanilha = String(d.AbaOrigem || '').toUpperCase().trim();
        if (abaAtual.includes('Servi')) return abaPlanilha.includes('SERVI');
        return abaPlanilha.includes('COMPRA') || abaPlanilha.includes('LOGISTICA');
    });
    const statusUnicos = [...new Set(filtradosAba.map(d => d.Status))].filter(s => s);
    
    select.innerHTML = '<option value="Todos">Todos os Status</option>';
    statusUnicos.forEach(s => select.innerHTML += `<option value="${s}">${s}</option>`);

    if(statusUnicos.includes(valorAtual)) {
        select.value = valorAtual;
    }
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
    
    document.getElementById('statusFilter').value = 'Todos'; 
    popularFiltroStatus(); 
    atualizarPainel();
}

buscarDados();
setInterval(buscarDados, 60000);