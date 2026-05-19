// === ARQUIVO: script.js ===

// 1. O SEU LINK DO GOOGLE APPS SCRIPT:
const API_URL = 'https://script.google.com/macros/s/AKfycbyt9ZEFqSyBwY_lGfxO6dbQupf52X44D1Lg9dkYAYRiNaxBemtuqCGTg5sfXCbcKxaePg/exec';

let todosDados = [];
let abaAtual = 'Serviço';
let chartStatusInstancia = null;
let chartBarInstancia = null;

Chart.register(ChartDataLabels);

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
    
    if (s.includes('certificado aprovado')) return { icone: 'fa-certificate', classe: 'bg-concluido' };
    if (s.includes('aguardando certificado')) return { icone: 'fa-hourglass-half', classe: 'bg-alerta' };

    if (s.includes('solicitado') || s.includes('aberta')) return { icone: 'fa-hand-pointer', classe: 'bg-solicitado' };
    if (s.includes('cotacao')) return { icone: 'fa-file-invoice-dollar', classe: 'bg-cotacao' };
    if (s.includes('aguardando') || s.includes('aprovacao') || s.includes('iniciado') || s.includes('manutencao') || s.includes('pendente')) return { icone: 'fa-hourglass-half', classe: 'bg-alerta' };
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
        
        popularTodosOsFiltros(); 
        atualizarPainel();
    } catch (erro) {
        console.error("Erro de conexão:", erro);
        document.getElementById('connIndicator').className = 'status-dot error';
        document.getElementById('connText').innerText = "Erro de conexão API!";
    }
}

function popularTodosOsFiltros() {
    const dadosAba = todosDados.filter(d => {
        const abaPlanilha = String(d.AbaOrigem || '').toUpperCase().trim();
        if (abaAtual === 'Serviço' && abaPlanilha.includes('SERVI')) return true;
        if (abaAtual === 'Compra' && (abaPlanilha.includes('COMPRA') || abaPlanilha.includes('LOGISTICA'))) return true;
        if (abaAtual === 'Calibração' && abaPlanilha.includes('CALIBRA')) return true;
        return false;
    });

    const preencherSelect = (idSelect, listaValores, labelPadrao) => {
        const select = document.getElementById(idSelect);
        if (!select) return;
        const valorAtual = select.value;
        const unicos = [...new Set(listaValores)].filter(v => v !== '' && v !== '-').sort();
        select.innerHTML = `<option value="Todos">${labelPadrao}</option>`;
        unicos.forEach(val => { select.innerHTML += `<option value="${val}">${val}</option>`; });
        if (unicos.includes(valorAtual)) select.value = valorAtual;
    };

    const sistemas = dadosAba.map(d => pegarValor(d, ['Sistema', 'Sistema/quadro', 'Tipo de Sistema']));
    const status = dadosAba.map(d => d.Status ? d.Status.trim() : '');
    const responsaveis = dadosAba.map(d => pegarValor(d, ['Responsável', 'Solicitante']));
    const equipes = dadosAba.map(d => pegarValor(d, ['Equipe', 'Time', 'Grupo']));
    const prioridades = dadosAba.map(d => pegarValor(d, ['Prioridade (alta/média/baixa)', 'Prioridade']));

    preencherSelect('filterSistema', sistemas, 'Todos os Sistemas');
    preencherSelect('statusFilter', status, 'Todos os Status');
    preencherSelect('filterResponsavel', responsaveis, abaAtual === 'Compra' ? 'Todos Solicitantes' : 'Todos Responsáveis');
    preencherSelect('filterEquipe', equipes, 'Todas Equipes');
    preencherSelect('filterPrioridade', prioridades, 'Todas Prioridades');
}

// Retorna os dados que estão passando pelos filtros selecionados no momento
function obterDadosFiltradosAtuais() {
    const fSistema = document.getElementById('filterSistema')?.value || 'Todos';
    const fStatus = document.getElementById('statusFilter')?.value || 'Todos';
    const fResp = document.getElementById('filterResponsavel')?.value || 'Todos';
    const fEquipe = document.getElementById('filterEquipe')?.value || 'Todos';
    const fPrioridade = document.getElementById('filterPrioridade')?.value || 'Todos';

    return todosDados.filter(d => {
        const abaPlanilha = String(d.AbaOrigem || '').toUpperCase().trim();
        let pertenceAAba = false;
        if (abaAtual === 'Serviço' && abaPlanilha.includes('SERVI')) pertenceAAba = true;
        else if (abaAtual === 'Compra' && (abaPlanilha.includes('COMPRA') || abaPlanilha.includes('LOGISTICA'))) pertenceAAba = true;
        else if (abaAtual === 'Calibração' && abaPlanilha.includes('CALIBRA')) pertenceAAba = true;

        if (!pertenceAAba) return false;

        const sys = pegarValor(d, ['Sistema', 'Sistema/quadro', 'Tipo de Sistema']);
        const st = d.Status ? d.Status.trim() : '';
        const rsp = pegarValor(d, ['Responsável', 'Solicitante']);
        const eqp = pegarValor(d, ['Equipe', 'Time', 'Grupo']);
        const prio = pegarValor(d, ['Prioridade (alta/média/baixa)', 'Prioridade']);

        return (fSistema === 'Todos' || sys === fSistema) &&
               (fStatus === 'Todos' || st === fStatus) &&
               (fResp === 'Todos' || rsp === fResp) &&
               (fEquipe === 'Todos' || eqp === fEquipe) &&
               (fPrioridade === 'Todos' || prio === fPrioridade);
    });
}

function atualizarPainel() {
    const filtrados = obterDadosFiltradosAtuais();
    
    if (abaAtual === 'Calibração') {
        renderizarCalibracoes(filtrados);
        renderizarGraficos(filtrados);
    } else {
        renderizarKPIs(filtrados);
        renderizarTabela(filtrados);
        renderizarGraficos(filtrados);
    }
}

function ajustarVisibilidadeDosFiltros() {
    const boxResp = document.getElementById('filterResponsavel');
    const boxEquipe = document.getElementById('filterEquipe');
    const boxPrio = document.getElementById('filterPrioridade');
    const boxSistema = document.getElementById('filterSistema');
    const boxStatus = document.getElementById('statusFilter');

    if (!boxResp || !boxEquipe || !boxPrio) return;

    boxSistema.style.display = 'inline-block';
    boxStatus.style.display = 'inline-block';

    if (abaAtual === 'Serviço') {
        boxResp.style.display = 'inline-block';
        boxEquipe.style.display = 'inline-block';
        boxPrio.style.display = 'none';
    } else if (abaAtual === 'Compra') {
        boxResp.style.display = 'inline-block';
        boxEquipe.style.display = 'none';
        boxPrio.style.display = 'inline-block';
    } else if (abaAtual === 'Calibração') {
        boxResp.style.display = 'none';
        boxEquipe.style.display = 'none';
        boxPrio.style.display = 'none';
        boxStatus.style.display = 'none';
    }
}

function mudarAba(tipo) {
    abaAtual = tipo;
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (tipo === 'Serviço' && btn.innerText.includes('Ordens')) btn.classList.add('active');
        if (tipo === 'Compra' && btn.innerText.includes('Logística')) btn.classList.add('active');
        if (tipo === 'Calibração' && btn.innerText.includes('Calibrações')) btn.classList.add('active');
    });

    const titulos = { 'Serviço': 'Gestão de Serviços', 'Compra': 'Gestão de Logística & Compras', 'Calibração': 'Progresso de Calibrações & Certificados' };
    document.getElementById('pageTitle').innerText = titulos[tipo];
    
    const isCalib = (tipo === 'Calibração');
    document.getElementById('kpiGrid').style.display = isCalib ? 'none' : 'grid';
    document.getElementById('tableContainer').style.display = isCalib ? 'none' : 'block';
    document.getElementById('calibracaoContainer').style.display = isCalib ? 'grid' : 'none';

    document.querySelectorAll('.filters-container select').forEach(s => s.value = 'Todos');

    ajustarVisibilidadeDosFiltros();
    popularTodosOsFiltros(); 
    atualizarPainel();
}

function renderizarCalibracoes(lista) {
    const container = document.getElementById('calibracaoContainer');
    if(lista.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 60px; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e1; color:#64748b; font-weight: 500;">Nenhum dado encontrado para os filtros selecionados.</div>';
        return;
    }
    let html = '';
    lista.forEach(item => {
        const sistema = pegarValor(item, ['Sistema', 'Sistema/quadro']) || 'Não Definido';
        const total = parseInt(pegarValor(item, ['Total'])) || 0;
        const calibrados = parseInt(pegarValor(item, ['Calibrados'])) || 0;
        const certAprovados = parseInt(pegarValor(item, ['Certificados Aprovados'])) || 0;
        const certPendentes = parseInt(pegarValor(item, ['Certificados Pendentes'])) || 0;
        
        let porcentagem = total > 0 ? Math.round((calibrados / total) * 100) : 0;
        if (porcentagem > 100) porcentagem = 100;

        let cor = '#ef4444'; if (porcentagem >= 30) cor = '#f59e0b'; if (porcentagem >= 75) cor = '#3b82f6'; if (porcentagem === 100) cor = '#10b981'; 

        html += `
            <div class="prog-card">
                <div class="prog-header"><div class="prog-title"><i class="fa-solid fa-cube" style="color: ${cor}"></i> ${sistema}</div><div class="prog-pct" style="color: ${cor}">${porcentagem}%</div></div>
                <div class="prog-bg"><div class="prog-fill" style="width: 0%; background-color: ${cor};" data-target="${porcentagem}%"></div></div>
                <div class="prog-details"><span>Qtd. Total: ${total}</span><span>Calibrados: ${calibrados}</span></div>
                <div class="cert-stats">
                    <span class="badge bg-concluido"><i class="fa-solid fa-certificate"></i> ${certAprovados} Aprovados</span>
                    <span class="badge bg-alerta"><i class="fa-solid fa-hourglass-half"></i> ${certPendentes} Pendentes</span>
                </div>
            </div>
        `;
    });
    container.className = 'calibracao-grid animate-fade'; container.innerHTML = html;
    setTimeout(() => { container.querySelectorAll('.prog-fill').forEach(b => b.style.width = b.getAttribute('data-target')); }, 100);
}

function renderizarGraficos(lista) {
    if (lista.length === 0) {
        document.getElementById('chartsContainer').style.display = 'none'; return;
    } else document.getElementById('chartsContainer').style.display = 'grid';

    const ctxStatus = document.getElementById('chartStatus').getContext('2d');
    const ctxBar = document.getElementById('chartBar').getContext('2d');
    if (chartStatusInstancia) chartStatusInstancia.destroy();
    if (chartBarInstancia) chartBarInstancia.destroy();

    if (abaAtual === 'Calibração') {
        document.getElementById('chartTitlePie').innerText = 'Status Global de Certificados';
        document.getElementById('chartTitleBar').innerText = 'Avanço de Calibração (%)';
        let totApr = 0; let totPend = 0; const sysLabels = []; const progData = [];
        lista.forEach(item => {
            totApr += parseInt(pegarValor(item, ['Certificados Aprovados'])) || 0;
            totPend += parseInt(pegarValor(item, ['Certificados Pendentes'])) || 0;
            sysLabels.push(pegarValor(item, ['Sistema', 'Sistema/quadro']) || 'Outros');
            const t = parseInt(pegarValor(item, ['Total'])) || 0; const c = parseInt(pegarValor(item, ['Calibrados'])) || 0;
            progData.push(t > 0 ? Math.min(Math.round((c/t)*100), 100) : 0);
        });
        chartStatusInstancia = new Chart(ctxStatus, {
            type: 'doughnut', data: { labels: ['Aprovados', 'Pendentes'], datasets: [{ data: [totApr, totPend], backgroundColor: ['#10b981', '#f59e0b'], borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } }, datalabels: { color: '#ffffff', font: { weight: 'bold', size: 14, family: 'Inter' }, formatter: v => v > 0 ? v : '' } } }
        });
        chartBarInstancia = new Chart(ctxBar, {
            type: 'bar', data: { labels: sysLabels, datasets: [{ label: '% Concluído', data: progData, backgroundColor: '#3b82f6', borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { color: '#0f172a', anchor: 'end', align: 'top', font: { weight: 'bold', size: 13, family: 'Inter' }, formatter: v => v > 0 ? v + '%' : '' } }, scales: { y: { beginAtZero: true, suggestedMax: 110, ticks: { stepSize: 25 } }, x: { grid: { display: false } } } }
        });
    } else {
        document.getElementById('chartTitlePie').innerText = 'Gargalos da Operação (Por Status)';
        document.getElementById('chartTitleBar').innerText = abaAtual.includes('Compra') ? 'Atrasos por Prioridade Crítica' : 'Pendências por Responsável / Equipe';
        const pends = lista.filter(d => !String(d.Status || '').toLowerCase().match(/conclu|entregue|realizada|aprovado/));
        const cStatus = {}; pends.forEach(d => { const s = d.Status ? d.Status.trim() : 'Sem Status'; cStatus[s] = (cStatus[s] || 0) + 1; });
        chartStatusInstancia = new Chart(ctxStatus, {
            type: 'doughnut', data: { labels: Object.keys(cStatus), datasets: [{ data: Object.values(cStatus), backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#64748b'], borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } }, datalabels: { color: '#ffffff', font: { weight: 'bold', size: 14, family: 'Inter' }, formatter: v => v > 0 ? v : '' } } }
        });
        const cBar = {}; pends.forEach(d => {
            const k = abaAtual.includes('Compra') ? (pegarValor(d, ['Prioridade (alta/média/baixa)', 'Prioridade']).toUpperCase() || 'NÃO DEFINIDA') : (pegarValor(d, ['Equipe', 'Responsável', 'Time']) || 'SEM EQUIPE');
            cBar[k] = (cBar[k] || 0) + 1;
        });
        const bLabels = Object.keys(cBar); const bData = bLabels.map(l => cBar[l]);
        const bCores = bLabels.map(l => l.includes('ALTA') ? '#ef4444' : (l.includes('MÉD') ? '#f59e0b' : (l.includes('BAIXA') ? '#10b981' : '#3b82f6')));
        chartBarInstancia = new Chart(ctxBar, {
            type: 'bar', data: { labels: bLabels, datasets: [{ label: 'Qtd. Pendente', data: bData, backgroundColor: bCores, borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { color: '#0f172a', anchor: 'end', align: 'top', font: { weight: 'bold', size: 13, family: 'Inter' }, formatter: v => v > 0 ? v : '' } }, scales: { y: { beginAtZero: true, suggestedMax: Math.max(...bData, 0) + 2, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } }
        });
    }
}

function renderizarTabela(lista) {
    const head = document.getElementById('tableHead'); const body = document.getElementById('tableBody');
    body.classList.remove('animate-fade'); void body.offsetWidth; body.classList.add('animate-fade');
    if(lista.length === 0) {
        head.innerHTML = ''; body.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 40px; color:#64748b; font-weight: 500;">Nenhum registro encontrado para os filtros aplicados.</td></tr>'; return;
    }
    if (abaAtual === 'Compra') {
        head.innerHTML = `<tr><th style="width: 80px;">Nº / Status</th><th>Descrição do Item</th><th style="text-align:center;">Qtd</th><th>Prioridade</th><th>Solicitante</th><th title="Data de Solicitação">Solicitado</th><th title="Data de Cotação enviada a HB">Cotação</th><th title="Aprovado HB">Aprovado</th><th title="Previsão de entrega">Previsão</th><th title="Data de entrega no Site">Entregue</th></tr>`;
        body.innerHTML = lista.map(item => {
            const conf = obterConfigStatus(item.Status); const num = item['Nº'] || item['Nº OS'] || '-';
            const desc = pegarValor(item, ['Descrição do item', 'Descrição']); const qtd = pegarValor(item, ['Qtd Solicitada', 'Qtde. Solicitada', 'Qtd']);
            const prio = pegarValor(item, ['Prioridade (alta/média/baixa)', 'Prioridade']); const sol = pegarValor(item, ['Solicitante']);
            const dtSol = formatarData(pegarValor(item, ['Solicitado? Data', 'Data de solicitação', 'Data Solicitação']));
            const dtCot = formatarData(pegarValor(item, ['Cotação enviada HB? Data', 'Data de Cotação enviada a HB', 'Cotação enviada HB']));
            const dtApr = formatarData(pegarValor(item, ['Aprovado HB? Data', 'Aprovado HB']));
            const dtPrev = formatarData(pegarValor(item, ['Previsão de Entrega', 'Previsão de entrega', 'Previsão']));
            const dtEnt = formatarData(pegarValor(item, ['Data Entregue', 'Data de entrega no Site', 'Entregue']));
            const sys = pegarValor(item, ['Sistema/quadro', 'Sistema', 'Tipo de Sistema']);
            const pLower = prio.toLowerCase(); let cPrio = '#64748b'; let bgPrio = '#f1f5f9';
            if(pLower.includes('alta')) { cPrio = '#dc2626'; bgPrio = '#fef2f2'; } else if(pLower.includes('méd') || pLower.includes('med')) { cPrio = '#d97706'; bgPrio = '#fffbeb'; } else if(pLower.includes('baix')) { cPrio = '#059669'; bgPrio = '#ecfdf5'; }
            const pill = prio ? `<span style="font-size: 9px; background: ${bgPrio}; color: ${cPrio}; padding: 3px 6px; border-radius: 6px; font-weight: 700; white-space: nowrap; border: 1px solid ${cPrio}30;">${prio.toUpperCase()}</span>` : '-';
            const osVinc = pegarValor(item, ['O.S Vinculada', 'OS Relacionada', 'OS Serviço']);
            const bRef = osVinc ? `<div style="margin-top: 4px;"><span style="font-size:8px; background:#f1f5f9; color:#475569; padding:2px 5px; border-radius:4px; font-weight: 600; border: 1px solid #e2e8f0;"><i class="fa-solid fa-link"></i> OS ${osVinc}</span></div>` : '';
            const bSys = sys ? `<div style="margin-top: 6px;"><span style="font-size: 9px; font-weight: 600; color: #475569; background: #e2e8f0; padding: 3px 6px; border-radius: 4px;"><i class="fa-solid fa-cube"></i> Sist: ${sys}</span></div>` : '';
            const imgLink = pegarValor(item, ['Anexo', 'Foto', 'Link', 'Link da Foto']);
            const bImg = imgLink ? `<br><a href="${imgLink}" target="_blank" class="btn-anexo"><i class="fa-solid fa-image"></i> Ver Foto</a>` : '';
            return `<tr><td style="vertical-align: top;"><div style="font-weight: 700; font-size: 12px; margin-bottom: 4px; color: #0f172a;">${num}</div><span class="badge ${conf.classe}"><i class="fa-solid ${conf.icone}"></i> ${item.Status || 'Status Vazio'}</span>${bRef}</td><td style="font-size: 12px; vertical-align: top; max-width: 180px; word-wrap: break-word; color: #334155;">${desc || '-'}${bSys}${bImg}</td><td style="font-size: 13px; font-weight: 700; text-align: center; color: #0f172a;">${qtd || '-'}</td><td style="vertical-align: middle;">${pill}</td><td style="font-size: 12px; font-weight: 500; color: #334155;">${sol || '-'}</td><td style="font-size: 11px; white-space: nowrap; color: #64748b;">${dtSol !== '-' ? `<i class="fa-regular fa-calendar-plus"></i> `+dtSol : '-'}</td><td style="font-size: 11px; white-space: nowrap; color: #64748b;">${dtCot !== '-' ? `<i class="fa-regular fa-envelope"></i> `+dtCot : '-'}</td><td style="font-size: 11px; white-space: nowrap; color: #0284c7; font-weight: 500;">${dtApr !== '-' ? `<i class="fa-solid fa-thumbs-up"></i> `+dtApr : '-'}</td><td style="font-size: 11px; white-space: nowrap; color: #d97706; font-weight: 500;">${dtPrev !== '-' ? `<i class="fa-regular fa-clock"></i> `+dtPrev : '-'}</td><td style="font-size: 11px; white-space: nowrap; color: #059669; font-weight: 700;">${dtEnt !== '-' ? `<i class="fa-solid fa-box-open"></i> `+dtEnt : '-'}</td></tr>`;
        }).join('');
    } else {
        head.innerHTML = `<tr><th style="width: 90px;">Nº OS / Ref</th><th>Descrição / Local</th><th>Sistema</th><th>Status</th><th>Responsável</th><th>Equipe</th><th>Abertura</th><th>Conclusão</th></tr>`;
        body.innerHTML = lista.map(item => {
            const conf = obterConfigStatus(item.Status); const num = String(item['Nº OS'] || item['Nº'] || '').trim();
            const obs = item.Observações ? `<span class="obs-text" style="display:block; font-size:10px; color:#ef4444; margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> ${item.Observações.replace(/^- /, '')}</span>` : '';
            const sys = pegarValor(item, ['Sistema', 'Tipo de Sistema']); const eqp = pegarValor(item, ['Equipe', 'Time', 'Grupo']);
            const dtAbe = formatarData(pegarValor(item, ['Data de Abertura', 'Data'])); const dtCon = formatarData(pegarValor(item, ['Data de Conclusão', 'Conclusão', 'Data Fim']));
            const vincs = todosDados.filter(d => String(d.AbaOrigem || '').toUpperCase().match(/COMPRA|LOGISTICA/) && String(pegarValor(d, ['O.S Vinculada', 'OS Relacionada', 'OS Serviço'])).trim() === num && num !== '');
            const bVinc = vincs.length > 0 ? `<div style="margin-top: 6px;"><span style="font-size:9px; background:#eff6ff; color:#2563eb; padding:2px 5px; border-radius:4px; border: 1px solid #bfdbfe; font-weight: 600;"><i class="fa-solid fa-link"></i> ${vincs.length} Compra(s) Vinculada(s)</span></div>` : '';
            const anexo = pegarValor(item, ['Anexo', 'Foto', 'Link', 'Link da Foto', 'Evidência']);
            const bAnexo = anexo ? `<br><a href="${anexo}" target="_blank" class="btn-anexo"><i class="fa-solid fa-camera"></i> Ver Anexo</a>` : '';
            return `<tr><td style="vertical-align: top;"><strong style="font-size: 12px;">${num || '-'}</strong>${bVinc}</td><td style="max-width: 180px; vertical-align: top;"><span style="font-size: 12px;">${pegarValor(item, ['Descrição do Serviço', 'Descrição']) || '-'}</span><br><small style="color:#64748b; font-size: 10px;"><i class="fa-solid fa-location-dot"></i> ${item.Local || 'N/A'}</small>${obs}${bAnexo}</td><td><span style="font-size: 10px; font-weight: 600; color: #475569; background: #f1f5f9; padding: 3px 6px; border-radius: 6px;">${sys || 'N/A'}</span></td><td><span class="badge ${conf.classe}"><i class="fa-solid ${conf.icone}"></i> ${item.Status || 'Pendente'}</span></td><td style="font-size: 12px; font-weight: 500; color: #334155;">${item.Responsável || '-'}</td><td style="font-size: 12px; font-weight: 500; color: #334155;">${eqp || '-'}</td><td style="font-size: 11px; white-space: nowrap; color: #64748b;"><i class="fa-regular fa-calendar"></i> ${dtAbe}</td><td style="font-size: 11px; white-space: nowrap; color: #059669; font-weight: 600;">${dtCon !== '-' ? `<i class="fa-solid fa-check-circle"></i> `+dtCon : '-'}</td></tr>`;
        }).join('');
    }
}

function renderizarKPIs(lista) {
    const grid = document.getElementById('kpiGrid'); const total = lista.length;
    const concs = lista.filter(d => String(d.Status || '').toLowerCase().match(/conclu|entregue|realizada|certificado aprovado|aprovado/)).length;
    grid.innerHTML = `<div class="kpi-card"><div class="kpi-icon" style="background: #eff6ff; color: #3b82f6;"><i class="fa-solid fa-layer-group"></i></div><div><h3 style="margin:0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Total Filtrado</h3><p style="margin:0; font-size: 24px; font-weight: 800; color: #0f172a;">${total}</p></div></div><div class="kpi-card"><div class="kpi-icon" style="background: #fffbeb; color: #d97706;"><i class="fa-solid fa-spinner"></i></div><div><h3 style="margin:0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Em Andamento</h3><p style="margin:0; font-size: 24px; font-weight: 800; color: #0f172a;">${total - concs}</p></div></div><div class="kpi-card"><div class="kpi-icon" style="background: #ecfdf5; color: #10b981;"><i class="fa-solid fa-check-double"></i></div><div><h3 style="margin:0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Finalizados</h3><p style="margin:0; font-size: 24px; font-weight: 800; color: #0f172a;">${concs}</p></div></div>`;
}

// ==========================================
// 🚀 NOVAS FUNÇÕES DE EXPORTAR (EXCEL E PDF)
// ==========================================
function exportarParaPDF() {
    window.print(); // Dispara o motor de impressão nativo com o CSS ocultando o desnecessário
}

function exportarParaExcel() {
    const dadosFiltrados = obterDadosFiltradosAtuais();
    if(dadosFiltrados.length === 0) {
        alert("Não há dados na tela para exportar!");
        return;
    }

    let csvContent = "";
    let headers = [];

    // Define os cabeçalhos das colunas com base na aba ativa
    if (abaAtual === 'Calibração') {
        headers = ["Sistema", "Total", "Calibrados", "Certificados Aprovados", "Certificados Pendentes"];
        csvContent += headers.join(";") + "\n";
        dadosFiltrados.forEach(d => {
            const linha = [
                `"${pegarValor(d, ['Sistema', 'Sistema/quadro'])}"`,
                `"${parseInt(pegarValor(d, ['Total'])) || 0}"`,
                `"${parseInt(pegarValor(d, ['Calibrados'])) || 0}"`,
                `"${parseInt(pegarValor(d, ['Certificados Aprovados'])) || 0}"`,
                `"${parseInt(pegarValor(d, ['Certificados Pendentes'])) || 0}"`
            ];
            csvContent += linha.join(";") + "\n";
        });
    } else if (abaAtual === 'Compra') {
        headers = ["Nº", "Descrição do Item", "Qtd Solicitada", "Prioridade", "Solicitante", "Status", "Sistema/Quadro", "O.S Vinculada", "Solicitado Data", "Cotação Data", "Aprovado Data", "Previsão", "Entregue"];
        csvContent += headers.join(";") + "\n";
        dadosFiltrados.forEach(d => {
            const linha = [
                `"${d['Nº'] || d['Nº OS'] || '-'}"`,
                `"${pegarValor(d, ['Descrição do item', 'Descrição']).replace(/"/g, '""')}"`,
                `"${pegarValor(d, ['Qtd Solicitada', 'Qtde. Solicitada', 'Qtd'])}"`,
                `"${pegarValor(d, ['Prioridade (alta/média/baixa)', 'Prioridade'])}"`,
                `"${pegarValor(d, ['Solicitante'])}"`,
                `"${d.Status || ''}"`,
                `"${pegarValor(d, ['Sistema/quadro', 'Sistema'])}"`,
                `"${pegarValor(d, ['O.S Vinculada', 'OS Relacionada'])}"`,
                `"${formatarData(pegarValor(d, ['Solicitado? Data', 'Data de solicitação']))}"`,
                `"${formatarData(pegarValor(d, ['Cotação enviada HB? Data', 'Data de Cotação enviada a HB']))}"`,
                `"${formatarData(pegarValor(d, ['Aprovado HB? Data', 'Aprovado HB']))}"`,
                `"${formatarData(pegarValor(d, ['Previsão de Entrega', 'Previsão']))}"`,
                `"${formatarData(pegarValor(d, ['Data Entregue', 'Data de entrega no Site']))}"`
            ];
            csvContent += linha.join(";") + "\n";
        });
    } else {
        // Serviços
        headers = ["Nº OS", "Descrição", "Local", "Sistema", "Status", "Responsável", "Equipe", "Data Abertura", "Data Conclusão", "Observações"];
        csvContent += headers.join(";") + "\n";
        dadosFiltrados.forEach(d => {
            const linha = [
                `"${d['Nº OS'] || d['Nº'] || '-'}"`,
                `"${pegarValor(d, ['Descrição do Serviço', 'Descrição']).replace(/"/g, '""')}"`,
                `"${d.Local || '-'}"`,
                `"${pegarValor(d, ['Sistema', 'Tipo de Sistema'])}"`,
                `"${d.Status || ''}"`,
                `"${d.Responsável || '-'}"`,
                `"${pegarValor(d, ['Equipe', 'Time', 'Grupo'])}"`,
                `"${formatarData(pegarValor(d, ['Data de Abertura', 'Data']))}"`,
                `"${formatarData(pegarValor(d, ['Data de Conclusão', 'Conclusão']))}"`,
                `"${(d.Observações || '').replace(/"/g, '""')}"`
            ];
            csvContent += linha.join(";") + "\n";
        });
    }

    // 🧮 O truque de mestre: Adiciona o caractere BOM UTF-8 (\uFEFF) no início para o Excel ler o português perfeito
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_${abaAtual}_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

ajustarVisibilidadeDosFiltros();
buscarDados();
setInterval(buscarDados, 60000);