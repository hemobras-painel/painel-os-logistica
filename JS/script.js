// COLE AQUI O LINK DO SEU GOOGLE APPS SCRIPT (URL do App da Web)
const API_URL = 'https://script.google.com/macros/s/AKfycbz1UXF6-SnTyPHvVgNCepPocw7uzI4ju-uju6s5hix8AvZ844VgPh4wCgO1dAgTR5j4/exec';

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

// Busca valores em colunas com nomes parecidos
function pegarValor(item, nomesPossiveis) {
    for (let nome of nomesPossiveis) {
        const chaveReal = Object.keys(item).find(k => k.toLowerCase().trim() === nome.toLowerCase().trim());
        if (chaveReal && item[chaveReal]) return String(item[chaveReal]).trim();
    }
    return '';
}

async function buscarDados() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Erro na rede");
        
        // Agora recebemos JSON puro e sem erros!
        todosDados = await response.json();
        
        popularFiltroStatus();
        atualizarPainel();
        
        document.getElementById('connIndicator').className = 'status-dot online';
        document.getElementById('connText').innerText = `Online - ${new Date().toLocaleTimeString().slice(0,5)}`;
    } catch (e) {
        console.error("Erro ao buscar dados:", e);
        document.getElementById('connIndicator').className = 'status-dot error';
        document.getElementById('connText').innerText = "Erro na Conexão";
    }
}

function atualizarPainel() {
    const filtro = document.getElementById('statusFilter').value;
    
    const filtrados = todosDados.filter(d => {
        const status = d.Status || '';
        const tipo = d.Tipo || 'Serviço';

        // Lógica de visualização
        if (abaAtual === 'Serviço') {
            const ehServico = tipo === 'Serviço';
            const compraEntregue = (tipo === 'Compra' && (status === 'Objeto Entregue' || status === 'Compra Realizada'));
            return (ehServico || compraEntregue) && (filtro === 'Todos' || status === filtro);
        }
        
        return tipo === 'Compra' && (filtro === 'Todos' || status === filtro);
    });

    renderizarKPIs(filtrados);
    renderizarTabela(filtrados);
}

function renderizarTabela(lista) {
    const head = document.getElementById('tableHead');
    const body = document.getElementById('tableBody');
    
    let htmlHead = `<tr><th>Nº OS</th><th>Descrição / Local</th><th>Status</th><th>Responsável</th>`;
    if (abaAtual === 'Compra') htmlHead += `<th>Rastreamento</th>`;
    htmlHead += `<th>Data de Abertura</th></tr>`;
    
    if (lista.length === 0) {
        head.innerHTML = htmlHead;
        body.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    let htmlBody = lista.map(item => {
        const conf = statusConfig[item.Status] || { icone: 'fa-circle', classe: 'bg-aberta' };
        
        const valorL = pegarValor(item, ['Link do Rastreio', 'Cód. Rastreio', 'Link Rastreio']);
        const codigoR = pegarValor(item, ['Cód. Rastreio', 'Codigo do Rastreio']);

        let row = `<tr>
            <td><strong>${item['Nº OS'] || '-'}</strong></td>
            <td>${item['Descrição do Serviço'] || '-'}<br><small><i class="fa-solid fa-location-dot"></i> ${item.Local || ''}</small></td>
            <td><span class="badge ${conf.classe}"><i class="fa-solid ${conf.icone}"></i> ${item.Status}</span></td>
            <td>${item.Responsável || '-'}</td>`;
        
        if (abaAtual === 'Compra') {
            const ehLink = valorL.toLowerCase().startsWith('http');
            const botao = ehLink 
                ? `<a href="${valorL}" target="_blank" class="btn-rastreio"><i class="fa-solid fa-location-arrow"></i> Rastrear</a>` 
                : `<span style="color:#9ca3af;">${codigoR || 'Aguardando Link'}</span>`;
            row += `<td>${botao}</td>`;
        }
        
        // Pega qualquer data disponível na planilha
        const dataExibicao = pegarValor(item, ['Data de Abertura', 'Data']);
        row += `<td><i class="fa-regular fa-calendar"></i> ${dataExibicao || '-'}</td></tr>`;
        return row;
    }).join('');

    head.innerHTML = htmlHead;
    body.innerHTML = htmlBody;
}

function renderizarKPIs(lista) {
    const total = lista.length;
    const concluido = lista.filter(d => d.Status && (d.Status.includes('Concluído') || d.Status.includes('Entregue'))).length;
    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card"><div class="kpi-icon" style="background:#e0e7ff;color:#3b82f6;"><i class="fa-solid fa-layer-group"></i></div><div class="kpi-info"><h3>Total</h3><p>${total}</p></div></div>
        <div class="kpi-card"><div class="kpi-icon" style="background:#d1fae5;color:#10b981;"><i class="fa-solid fa-check"></i></div><div class="kpi-info"><h3>Concluídos</h3><p>${concluido}</p></div></div>
        <div class="kpi-card"><div class="kpi-icon" style="background:#fef3c7;color:#d97706;"><i class="fa-solid fa-clock"></i></div><div class="kpi-info"><h3>Pendentes</h3><p>${total - concluido}</p></div></div>`;
}

function popularFiltroStatus() {
    const select = document.getElementById('statusFilter');
    const statusUnicos = [...new Set(todosDados.map(d => d.Status))].filter(s => s);
    select.innerHTML = '<option value="Todos">Todos os Status</option>';
    statusUnicos.forEach(s => select.innerHTML += `<option value="${s}">${s}</option>`);
}

function mudarAba(tipo) {
    abaAtual = tipo;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.innerText.includes(tipo === 'Serviço' ? 'Ordens' : 'Logística')));
    document.getElementById('pageTitle').innerText = tipo === 'Serviço' ? 'Gestão de Serviços' : 'Gestão de Logística & Compras';
    atualizarPainel();
}

buscarDados();
setInterval(buscarDados, 60000); // Atualiza a cada 1 minuto