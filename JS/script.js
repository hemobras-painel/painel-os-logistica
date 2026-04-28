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
        return `${dia}-${mes}-${ano}`;
    }
    return dataOriginal; 
}

function obterConfigStatus(statusReal) {
    const s = String(statusReal || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (s.includes('aberta')) return { icone: 'fa-file-lines', classe: 'bg-aberta' };
    if (s.includes('iniciado')) return { icone: 'fa-person-digging', classe: 'bg-iniciado' };
    if (s.includes('aprovacao') || s.includes('cotacao') || s.includes('aguardando')) return { icone: 'fa-hourglass-half', classe: 'bg-aprovacao' };
    if (s.includes('manutencao')) return { icone: 'fa-wrench', classe: 'bg-aprovacao' };
    if (s.includes('compras')) return { icone: 'fa-cart-shopping', classe: 'bg-aprovacao' };
    if (s.includes('realizada') || s.includes('aprovado')) return { icone: 'fa-check', classe: 'bg-concluido' };
    if (s.includes('transito') || s.includes('enviada')) return { icone: 'fa-plane', classe: 'bg-transito' };
    if (s.includes('entregue') || s.includes('recebido')) return { icone: 'fa-box-open', classe: 'bg-concluido' };
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
    
    if(lista.length === 0) {
        head.innerHTML = '';
        body.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 40px; color:#6b7280;">Nenhum registro encontrado nesta aba.</td></tr>';
        return;
    }

    let htmlHead = '';
    let htmlBody = '';

    // ==========================================
    // TABELA DE ORDEM DE SERVIÇO
    // ==========================================
    if (abaAtual.includes('Servi')) {
        htmlHead = `<tr>
            <th>Nº OS</th>
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
            const obs = item.Observações ? `<span class="obs-text" style="display:block; font-size:11px; color:#ef4444; margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> ${item.Observações.replace(/^- /, '')}</span>` : '';
            const sistema = pegarValor(item, ['Sistema', 'Tipo de Sistema']);
            const equipe = pegarValor(item, ['Equipe', 'Time', 'Grupo']);
            const dataAbertura = formatarData(pegarValor(item, ['Data de Abertura', 'Data']));
            const dataConclusao = formatarData(pegarValor(item, ['Data de Conclusão', 'Conclusão', 'Data Fim']));

            const numeroOS = String(item['Nº OS'] || item['Nº'] || '').trim();

            // INTELIGÊNCIA DE VÍNCULO: Procura se existe alguma compra para essa OS
            const comprasVinculadas = todosDados.filter(d => {
                const abaPlanilha = String(d.AbaOrigem || '').toUpperCase();
                if (abaPlanilha.includes('COMPRA') || abaPlanilha.includes('LOGISTICA')) {
                    const osDestaCompra = String(pegarValor(d, ['O.S Vinculada', 'OS Relacionada', 'OS Serviço'])).trim();
                    return osDestaCompra === numeroOS && numeroOS !== '';
                }
                return false;
            });

            // Se achar, cria o selo azul
            let badgeVinculo = '';
            if (comprasVinculadas.length > 0) {
                badgeVinculo = `<div style="margin-top: 6px;"><span style="font-size:10px; background:#eff6ff; color:#2563eb; padding:3px 6px; border-radius:4px; border: 1px solid #bfdbfe; font-weight: 500;"><i class="fa-solid fa-link"></i> ${comprasVinculadas.length} Compra(s) Vinculada(s)</span></div>`;
            }

            return `<tr>
                <td style="vertical-align: top;">
                    <strong>${numeroOS || '-'}</strong>
                    ${badgeVinculo}
                </td>
                <td style="max-width: 200px; vertical-align: top;">
                    ${pegarValor(item, ['Descrição do Serviço', 'Descrição']) || '-'}
                    <br><small style="color:#6b7280;"><i class="fa-solid fa-location-dot"></i> ${item.Local || 'N/A'}</small>
                    ${obs}
                </td>
                <td><span style="font-size: 11px; font-weight: 500; color: #4b5563; background: #f3f4f6; padding: 3px 6px; border-radius: 4px;">${sistema || 'N/A'}</span></td>
                <td><span class="badge ${conf.classe}" style="font-size: 10px;"><i class="fa-solid ${conf.icone}"></i> ${item.Status || 'Aberto'}</span></td>
                <td style="font-size: 13px;">${item.Responsável || '-'}</td>
                <td style="font-size: 13px; font-weight: 500;">${equipe || '-'}</td>
                <td style="font-size: 12px; white-space: nowrap;"><i class="fa-regular fa-calendar" style="font-size: 10px;"></i> ${dataAbertura}</td>
                <td style="font-size: 12px; white-space: nowrap; color: #059669; font-weight: 500;">${dataConclusao !== '-' ? `<i class="fa-solid fa-check-circle" style="font-size: 10px;"></i> ${dataConclusao}` : '-'}</td>
            </tr>`;
        }).join('');
    } 
    // ==========================================
    // TABELA DE COMPRAS / LOGÍSTICA
    // ==========================================
    else {
        htmlHead = `<tr>
            <th>Nº / Ref.</th>
            <th>Item / Detalhes</th>
            <th>Fabricante</th>
            <th>Status</th>
            <th>Solicitante</th>
            <th>Previsão Entrega</th>
            <th>Data Entregue</th>
        </tr>`;

        htmlBody = lista.map(item => {
            const conf = obterConfigStatus(item.Status);
            
            const numeroCompra = item['Nº'] || item['Nº OS'] || '-';
            const osVinculada = pegarValor(item, ['O.S Vinculada', 'OS Relacionada', 'OS Serviço']);
            
            const descricao = pegarValor(item, ['Descrição do item', 'Descrição']);
            const qtd = pegarValor(item, ['Qtd Solicitada', 'Qtd']);
            const tag = pegarValor(item, ['TAG']);
            const fabricante = pegarValor(item, ['Fabricante']);
            const solicitante = pegarValor(item, ['Solicitante']);
            
            const previsao = formatarData(pegarValor(item, ['Previsão de Entrega', 'Previsão']));
            const entregue = formatarData(pegarValor(item, ['Data Entregue', 'Entregue']));

            // Selo cinza indicando de qual O.S esse item é
            let badgeRef = '';
            if (osVinculada) {
                badgeRef = `<div style="margin-top: 6px;"><span style="font-size:10px; background:#f3f4f6; color:#4b5563; padding:3px 6px; border-radius:4px; font-weight: 500;"><i class="fa-solid fa-link"></i> Ref: OS ${osVinculada}</span></div>`;
            }

            return `<tr>
                <td style="vertical-align: top;">
                    <strong>${numeroCompra}</strong>
                    ${badgeRef}
                </td>
                <td style="max-width: 250px; vertical-align: top;">
                    <span style="font-weight: 500;">${descricao || '-'}</span>
                    <br><small style="color:#6b7280;"><b>Qtd:</b> ${qtd || '-'} &nbsp;|&nbsp; <b>TAG:</b> ${tag || '-'}</small>
                </td>
                <td style="font-size: 13px;">${fabricante || '-'}</td>
                <td><span class="badge ${conf.classe}" style="font-size: 10px;"><i class="fa-solid ${conf.icone}"></i> ${item.Status || 'Em Cotação'}</span></td>
                <td style="font-size: 13px;">${solicitante || '-'}</td>
                <td style="font-size: 12px; white-space: nowrap;"><i class="fa-regular fa-calendar" style="font-size: 10px;"></i> ${previsao}</td>
                <td style="font-size: 12px; white-space: nowrap; color: #059669; font-weight: 500;">${entregue !== '-' ? `<i class="fa-solid fa-box-open" style="font-size: 10px;"></i> ${entregue}` : '-'}</td>
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
        const s = String(d.Status || '');
        return s.includes('Conclu') || s.includes('Entregue') || s.includes('Realizada') || s.includes('Aprovado');
    }).length;
    const emAndamento = total - concluidos;

    grid.innerHTML = `
        <div class="kpi-card" style="padding: 15px;">
            <div class="kpi-icon" style="background: #e0e7ff; color: #3b82f6; width: 40px; height: 40px; font-size: 18px;"><i class="fa-solid fa-layer-group"></i></div>
            <div><h3 style="font-size: 11px;">Total</h3><p style="font-size: 22px;">${total}</p></div>
        </div>
        <div class="kpi-card" style="padding: 15px;">
            <div class="kpi-icon" style="background: #fef3c7; color: #d97706; width: 40px; height: 40px; font-size: 18px;"><i class="fa-solid fa-spinner"></i></div>
            <div><h3 style="font-size: 11px;">Pendente / Em Andamento</h3><p style="font-size: 22px;">${emAndamento}</p></div>
        </div>
        <div class="kpi-card" style="padding: 15px;">
            <div class="kpi-icon" style="background: #d1fae5; color: #10b981; width: 40px; height: 40px; font-size: 18px;"><i class="fa-solid fa-check-double"></i></div>
            <div><h3 style="font-size: 11px;">Finalizados / Entregues</h3><p style="font-size: 22px;">${concluidos}</p></div>
        </div>
    `;
}

function popularFiltroStatus() {
    const select = document.getElementById('statusFilter');
    const filtradosAba = todosDados.filter(d => {
        const abaPlanilha = String(d.AbaOrigem || '').toUpperCase().trim();
        if (abaAtual.includes('Servi')) return abaPlanilha.includes('SERVI');
        return abaPlanilha.includes('COMPRA') || abaPlanilha.includes('LOGISTICA');
    });
    const statusUnicos = [...new Set(filtradosAba.map(d => d.Status))].filter(s => s);
    
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
    
    popularFiltroStatus(); 
    atualizarPainel();
}

buscarDados();
setInterval(buscarDados, 60000);