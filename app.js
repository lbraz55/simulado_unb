/* =====================================================================
   app.js — Simulado UnB (padrão Cebraspe)
   ---------------------------------------------------------------------
   JavaScript puro (Vanilla JS). Responsável por:
     • Banco de questões (padrão + importadas via JSON)
     • Montagem da sessão de prova (1º dia, 2º dia, simulado rápido)
     • Interface da prova (split-screen, itens A/B/C/D, cartão-resposta)
     • Cronômetro regressivo com alertas e encerramento automático
     • Persistência total em localStorage
     • Correção oficial Cebraspe e relatório de desempenho
   ===================================================================== */
'use strict';

/* =====================================================================
   1. CONSTANTES E REGRAS OFICIAIS
   ===================================================================== */

/** Chaves usadas no localStorage. */
const CHAVES = {
  sessao: 'simuladoUnB.sessao.v1',
  importadas: 'simuladoUnB.bancoImportado.v1',
  tema: 'simuladoUnB.tema',
  historico: 'simuladoUnB.historico.v1',
  fonte: 'simuladoUnB.fonteTexto',
  form: 'simuladoUnB.ultimaConfig'
};

/** Pontuação oficial de cada tipo de item (Cebraspe / UnB). */
const REGRAS = {
  A: { nome: 'Certo ou Errado', acerto: 1, erro: -1, max: 1 },
  B: { nome: 'Numérica (000–999)', acerto: 2, erro: 0, max: 2 },
  C: { nome: 'Múltipla escolha', acerto: 2, erro: -2 / 3, max: 2 },
  D: { nome: 'Discursiva', acerto: 3, erro: 0, max: 3 }
};

const LETRAS = ['A', 'B', 'C', 'D'];
const LINGUAS = { ingles: 'Inglês', espanhol: 'Espanhol', frances: 'Francês' };
/** Aproximação de caracteres por linha do caderno de respostas definitivo. */
const CHARS_POR_LINHA = 70;
/** Limites de alerta do cronômetro (segundos). */
const ALERTA_30 = 30 * 60;
const ALERTA_10 = 10 * 60;

/* =====================================================================
   2. ESTADO GLOBAL
   ===================================================================== */
let sessao = null;          // sessão de prova atual (persistida)
let timerId = null;         // id do setInterval do cronômetro
let ultimoTick = 0;         // timestamp do último tick (robusto a abas em segundo plano)
let filtroRevisao = 'todos';
let indiceItens = new Map(); // n → item (cache para a sessão atual)

/* =====================================================================
   3. UTILITÁRIOS
   ===================================================================== */
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Escapa texto para inserção segura em HTML. */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Sanitiza HTML vindo do banco de questões (inclusive JSON importado):
 * remove scripts, iframes, atributos on* e URLs javascript:.
 */
function sanitizar(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html ?? '');
  tpl.content.querySelectorAll('script,iframe,object,embed,link,meta,style,form').forEach(el => el.remove());
  tpl.content.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => {
      const nome = a.name.toLowerCase();
      const val = a.value.trim().toLowerCase();
      if (nome.startsWith('on') || (['href', 'src', 'xlink:href', 'action'].includes(nome) && val.startsWith('javascript:'))) {
        el.removeAttribute(a.name);
      }
    });
  });
  return tpl.innerHTML;
}

/** Formata pontuação em pt-BR com até 3 casas decimais. */
function fmtPts(n) {
  const v = Math.round(n * 1000) / 1000;
  return (Object.is(v, -0) ? 0 : v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
/** Pontuação com sinal explícito (+2, −1, 0). */
function fmtSinal(n) {
  const v = Math.round(n * 1000) / 1000;
  if (v > 0) return '+' + fmtPts(v);
  if (v < 0) return '−' + fmtPts(-v);
  return '0';
}
/** Segundos → HH:MM:SS. */
function fmtTempo(seg) {
  seg = Math.max(0, Math.floor(seg));
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  return [h, m, s].map(x => String(x).padStart(2, '0')).join(':');
}
/** Segundos → "5h00min" / "45min". */
function fmtDuracao(seg) {
  const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}min` : `${m}min`;
}
const pad3 = v => String(v).padStart(3, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmtData = ts => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Leitura/gravação segura no localStorage. */
function lerLS(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; }
}
function gravarLS(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (e) { console.warn('localStorage:', e); return false; }
}
function removerLS(chave) { try { localStorage.removeItem(chave); } catch { /* ignora */ } }

/** Notificação flutuante. tipo: info | sucesso | alerta | erro */
function toast(msg, tipo = 'info', ms = 3800) {
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 350); }, ms);
}

/**
 * Modal genérico baseado em <dialog>. Retorna Promise com o "valor"
 * do botão clicado (ou null se fechado com Esc).
 */
function modal({ titulo, html, botoes = [{ texto: 'OK', valor: true, classe: 'btn-primario' }] }) {
  return new Promise(resolve => {
    const dlg = $('#modal');
    $('#modal-titulo').textContent = titulo;
    $('#modal-corpo').innerHTML = html;
    const rodape = $('#modal-rodape');
    rodape.innerHTML = '';
    const fechar = valor => { dlg.close(); dlg.oncancel = null; resolve(valor); };
    botoes.forEach(b => {
      const bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'btn ' + (b.classe || 'btn-sec');
      bt.textContent = b.texto;
      bt.addEventListener('click', () => fechar(b.valor));
      rodape.appendChild(bt);
    });
    dlg.oncancel = e => { e.preventDefault(); fechar(null); };
    dlg.showModal();
    rodape.lastElementChild?.focus();
  });
}

/** Faz o download de um objeto como arquivo .json. */
function baixarJSON(obj, nomeArquivo) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* =====================================================================
   4. BANCO DE QUESTÕES (padrão + importadas)
   ===================================================================== */

/** Retorna todas as provas disponíveis (importadas substituem ids iguais). */
function obterProvas() {
  const padrao = (window.BANCO_PADRAO && window.BANCO_PADRAO.provas) || [];
  const importadas = lerLS(CHAVES.importadas, []);
  const mapa = new Map();
  padrao.forEach(p => mapa.set(p.id, { ...p, origem: 'padrao' }));
  importadas.forEach(p => mapa.set(p.id, { ...p, origem: 'importada' }));
  return [...mapa.values()];
}

/** Conta itens de uma prova por tipo. */
function contarItens(prova, lingua) {
  const cont = { total: 0, A: 0, B: 0, C: 0, D: 0 };
  prova.blocos.forEach(b => {
    if (lingua && b.lingua && b.lingua !== lingua) return;
    b.itens.forEach(it => { cont.total++; cont[it.tipo] = (cont[it.tipo] || 0) + 1; });
  });
  return cont;
}

/**
 * Valida e normaliza o JSON importado. Aceita:
 *   { provas: [...] }  |  [ prova, prova ]  |  prova
 * Lança Error com a lista de problemas encontrados.
 */
function normalizarImportacao(dados) {
  let provas;
  if (Array.isArray(dados)) provas = dados;
  else if (dados && Array.isArray(dados.provas)) provas = dados.provas;
  else if (dados && Array.isArray(dados.blocos)) provas = [dados];
  else throw new Error('Formato não reconhecido. Use { "provas": [ ... ] }, uma lista de provas ou um único objeto de prova com "blocos".');

  const erros = [];
  provas.forEach((p, i) => {
    const ref = `Prova ${i + 1}${p && p.titulo ? ` ("${p.titulo}")` : ''}`;
    if (!p || typeof p !== 'object') { erros.push(`${ref}: não é um objeto.`); return; }
    p.id = String(p.id || `importada-${Date.now().toString(36)}-${i}`);
    if (!p.titulo) erros.push(`${ref}: campo "titulo" ausente.`);
    p.dia = [0, 1, 2].includes(Number(p.dia)) ? Number(p.dia) : 0;
    p.duracaoMin = Number(p.duracaoMin) > 0 ? Number(p.duracaoMin) : 300;
    if (!Array.isArray(p.blocos) || !p.blocos.length) { erros.push(`${ref}: "blocos" deve ser uma lista não vazia.`); return; }

    p.blocos.forEach((b, j) => {
      const refB = `${ref}, bloco ${j + 1}`;
      if (!b || typeof b !== 'object') { erros.push(`${refB}: não é um objeto.`); return; }
      b.id = String(b.id || `${p.id}-b${j + 1}`);
      if (!b.disciplina) erros.push(`${refB}: campo "disciplina" ausente.`);
      if (b.lingua && !LINGUAS[b.lingua]) erros.push(`${refB}: "lingua" deve ser ingles, espanhol ou frances.`);
      if (!Array.isArray(b.itens) || !b.itens.length) { erros.push(`${refB}: "itens" deve ser uma lista não vazia.`); return; }

      b.itens.forEach((it, k) => {
        const r = `${refB}, item ${k + 1}`;
        if (!it || typeof it !== 'object') { erros.push(`${r}: não é um objeto.`); return; }
        it.tipo = String(it.tipo || '').toUpperCase();
        if (!REGRAS[it.tipo]) { erros.push(`${r}: "tipo" deve ser A, B, C ou D.`); return; }
        if (!it.enunciado) erros.push(`${r}: "enunciado" ausente.`);
        switch (it.tipo) {
          case 'A':
            it.gabarito = String(it.gabarito || '').toUpperCase();
            if (!['C', 'E'].includes(it.gabarito)) erros.push(`${r}: gabarito do tipo A deve ser "C" ou "E".`);
            break;
          case 'B': {
            const n = Number(it.gabarito);
            if (!Number.isInteger(n) || n < 0 || n > 999) erros.push(`${r}: gabarito do tipo B deve ser inteiro de 0 a 999.`);
            else it.gabarito = n;
            break;
          }
          case 'C':
            it.gabarito = String(it.gabarito || '').toUpperCase();
            if (!Array.isArray(it.alternativas) || it.alternativas.length !== 4) erros.push(`${r}: tipo C exige exatamente 4 "alternativas".`);
            if (!LETRAS.includes(it.gabarito)) erros.push(`${r}: gabarito do tipo C deve ser A, B, C ou D.`);
            break;
          case 'D':
            it.maxLinhas = Number(it.maxLinhas) > 0 ? Number(it.maxLinhas) : 20;
            if (!it.espelho) it.espelho = '<p>Espelho de correção não informado.</p>';
            break;
        }
      });
    });
  });

  if (erros.length) {
    const extra = erros.length > 15 ? `\n… e mais ${erros.length - 15} problema(s).` : '';
    throw new Error(erros.slice(0, 15).join('\n') + extra);
  }
  return provas;
}

/** Importa um texto JSON para o banco local. */
function importarTexto(texto) {
  try {
    const dados = JSON.parse(texto);
    const provas = normalizarImportacao(dados);
    const importadas = lerLS(CHAVES.importadas, []);
    provas.forEach(p => {
      delete p.origem;
      const i = importadas.findIndex(x => x.id === p.id);
      if (i >= 0) importadas[i] = p; else importadas.push(p);
    });
    if (!gravarLS(CHAVES.importadas, importadas)) throw new Error('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).');
    const itens = provas.reduce((s, p) => s + contarItens(p).total, 0);
    toast(`${provas.length} prova(s) importada(s) — ${itens} itens.`, 'sucesso');
    $('#txt-json').value = '';
    atualizarFormulario();
    renderBancoInfo();
  } catch (err) {
    const msg = err instanceof SyntaxError ? `JSON inválido: ${err.message}` : err.message;
    modal({ titulo: 'Não foi possível importar', html: `<pre class="erro-pre">${esc(msg)}</pre>` });
  }
}

/** Modelo de importação com os 4 tipos de item. */
function modeloImportacao() {
  return {
    formato: 'simulado-unb',
    versao: 1,
    provas: [{
      id: 'unb-2024-dia1-exemplo',
      titulo: 'UnB 2024 — 1º Dia (transcrição)',
      dia: 1,
      duracaoMin: 300,
      blocos: [{
        id: 'unb-2024-d1-texto1',
        disciplina: 'Língua Portuguesa',
        area: 'Linguagens',
        titulo: 'Texto I',
        texto: '<p>Cole aqui o texto-base. Pode usar HTML simples: &lt;p&gt;, &lt;em&gt;, &lt;strong&gt;, &lt;sub&gt;, &lt;sup&gt;, &lt;img src=...&gt;.</p>',
        fonte: 'Autor. Obra. Editora, ano (adaptado).',
        itens: [
          { tipo: 'A', enunciado: 'Enunciado de um item Certo/Errado.', gabarito: 'C', justificativa: 'Comentário opcional.' },
          { tipo: 'B', enunciado: 'Enunciado de item numérico (resposta de 000 a 999).', gabarito: 42, justificativa: 'Cálculo.' },
          { tipo: 'C', enunciado: 'Enunciado de múltipla escolha.', alternativas: ['Opção A', 'Opção B', 'Opção C', 'Opção D'], gabarito: 'B', justificativa: 'Comentário.' },
          { tipo: 'D', enunciado: 'Enunciado do item discursivo.', maxLinhas: 15, espelho: '<p>Padrão de resposta da banca.</p>' }
        ]
      }, {
        id: 'unb-2024-d1-ingles',
        disciplina: 'Língua Inglesa',
        area: 'Língua Estrangeira',
        lingua: 'ingles',
        titulo: 'Texto em inglês',
        texto: '<p>Blocos com "lingua" (ingles, espanhol, frances) só aparecem para quem escolher essa língua.</p>',
        itens: [{ tipo: 'A', enunciado: 'Item da língua estrangeira.', gabarito: 'E' }]
      }]
    }]
  };
}

/* =====================================================================
   5. SESSÃO DE PROVA
   ===================================================================== */

/** Monta uma nova sessão a partir da configuração escolhida no lobby. */
function montarSessao(cfg) {
  const provas = obterProvas();
  let fonte = [];
  let titulo = '';

  if (cfg.tipo === 'dia1' || cfg.tipo === 'dia2') {
    const prova = provas.find(p => p.id === cfg.provaId);
    if (!prova) throw new Error('Prova não encontrada no banco.');
    fonte = prova.blocos.filter(b => !b.lingua || b.lingua === cfg.lingua);
    const temLingua = prova.blocos.some(b => b.lingua);
    titulo = prova.titulo + (temLingua && cfg.lingua ? ` · ${LINGUAS[cfg.lingua]}` : '');
  } else {
    provas.forEach(p => p.blocos.forEach(b => { if (cfg.disciplinas.includes(b.disciplina)) fonte.push(b); }));
    titulo = 'Simulado rápido · ' + cfg.disciplinas.join(', ');
  }

  // Numeração sequencial dos itens, como no caderno da UnB.
  let n = 0;
  const blocos = fonte.map((b, bi) => ({
    id: b.id,
    disciplina: b.disciplina || 'Geral',
    area: b.area || '',
    titulo: b.titulo || '',
    texto: b.texto || '',
    fonte: b.fonte || '',
    itens: b.itens.map(it => ({ ...JSON.parse(JSON.stringify(it)), n: ++n, b: bi }))
  }));

  return {
    versao: 1,
    id: Date.now().toString(36),
    titulo,
    config: cfg,
    blocos,
    respostas: {},    // n → 'C'|'E' | número | 'A'..'D' | texto
    revisao: {},      // n → true (marcado para revisão "?")
    eliminadas: {},   // n → ['A','C'] alternativas riscadas (tipo C)
    conferidos: {},   // n → true (modo treino)
    notasD: {},       // n → nota 0–3 autoatribuída (tipo D)
    blocoAtual: 0,
    duracao: cfg.duracaoSeg,
    tempoRestante: cfg.duracaoSeg,
    alertas: {},
    iniciadaEm: Date.now(),
    finalizada: false,
    finalizadaEm: null,
    tela: 'prova'
  };
}

function salvarSessao() { if (sessao) gravarLS(CHAVES.sessao, sessao); }

/** Reconstrói o índice n → item. */
function indexarSessao() {
  indiceItens = new Map();
  if (!sessao) return;
  sessao.blocos.forEach((b, bi) => b.itens.forEach(it => { it.b = bi; indiceItens.set(it.n, it); }));
}
const getItem = n => indiceItens.get(Number(n));
const todosItens = () => [...indiceItens.values()];

/** Indica se o item possui resposta. */
function respondido(item) {
  const r = sessao.respostas[item.n];
  if (item.tipo === 'D') return typeof r === 'string' && r.trim().length > 0;
  return r !== undefined && r !== null && r !== '';
}

/** Representação curta da resposta (para o cartão-resposta). */
function respostaCurta(item) {
  if (!respondido(item)) return '';
  const r = sessao.respostas[item.n];
  if (item.tipo === 'B') return pad3(r);
  if (item.tipo === 'D') return '✎';
  return String(r);
}

/* =====================================================================
   6. CORREÇÃO (regras oficiais Cebraspe)
   ===================================================================== */

/**
 * Corrige um item.
 * status: certo | errado | branco | avaliado (D com nota) | pendente (D sem nota)
 * ganho: pontos positivos · perda: pontos descontados (valor positivo)
 */
function corrigirItem(item, s = sessao) {
  const r = s.respostas[item.n];
  const regra = REGRAS[item.tipo];
  const zero = { pontos: 0, ganho: 0, perda: 0 };

  if (item.tipo === 'D') {
    if (!(typeof r === 'string' && r.trim())) return { status: 'branco', ...zero };
    const nota = s.notasD[item.n];
    if (nota === undefined || nota === null || nota === '' || isNaN(Number(nota))) return { status: 'pendente', ...zero };
    const v = clamp(Number(nota), 0, 3);
    return { status: 'avaliado', pontos: v, ganho: v, perda: 0 };
  }

  if (r === undefined || r === null || r === '') return { status: 'branco', ...zero };

  const certo = item.tipo === 'B'
    ? Number(r) === Number(item.gabarito)
    : String(r).toUpperCase() === String(item.gabarito).toUpperCase();

  return certo
    ? { status: 'certo', pontos: regra.acerto, ganho: regra.acerto, perda: 0 }
    : { status: 'errado', pontos: regra.erro, ganho: 0, perda: -regra.erro };
}

/** Consolida o resultado por tipo, por disciplina e total. */
function calcularResultado(s = sessao) {
  const nova = () => ({ itens: 0, certos: 0, errados: 0, brancos: 0, pendentes: 0, ganho: 0, perda: 0, max: 0 });
  const porTipo = { A: nova(), B: nova(), C: nova(), D: nova() };
  const porDisc = {};
  const total = nova();

  s.blocos.forEach(b => b.itens.forEach(item => {
    const c = corrigirItem(item, s);
    porDisc[b.disciplina] = porDisc[b.disciplina] || nova();
    [porTipo[item.tipo], porDisc[b.disciplina], total].forEach(l => {
      l.itens++;
      l.max += REGRAS[item.tipo].max;
      if (c.status === 'certo' || c.status === 'avaliado') l.certos++;
      else if (c.status === 'errado') l.errados++;
      else if (c.status === 'branco') l.brancos++;
      else if (c.status === 'pendente') l.pendentes++;
      l.ganho += c.ganho;
      l.perda += c.perda;
    });
  }));

  return { porTipo, porDisc, total, liquido: total.ganho - total.perda };
}

/* =====================================================================
   7. NAVEGAÇÃO ENTRE TELAS
   ===================================================================== */
function mostrarTela(nome) {
  $$('.tela').forEach(t => { t.hidden = t.id !== 'tela-' + nome; });
  document.body.dataset.tela = nome;
  $('#header-prova').hidden = nome !== 'prova';
  if (sessao) { sessao.tela = nome; salvarSessao(); }
  if (nome !== 'prova') fecharMapa();
  window.scrollTo(0, 0);
  ajustarAlturaHeader();
}

/** Mantém a variável CSS --header-h igual à altura real do cabeçalho. */
function ajustarAlturaHeader() {
  const h = $('#app-header').offsetHeight;
  document.documentElement.style.setProperty('--header-h', h + 'px');
}

/* =====================================================================
   8. TELA: LOBBY
   ===================================================================== */
function renderLobby() {
  pararTimer();
  mostrarTela('lobby');
  renderBannerSessao();
  atualizarFormulario();
  renderBancoInfo();
  renderHistorico();
}

/** Banner com simulado em andamento ou último resultado. */
function renderBannerSessao() {
  const el = $('#banner-sessao');
  if (!sessao) { el.innerHTML = ''; return; }
  indexarSessao();
  if (!sessao.finalizada) {
    const total = todosItens().length;
    const resp = todosItens().filter(respondido).length;
    el.innerHTML = `
      <div class="banner banner-andamento">
        <div>
          <strong>Simulado em andamento:</strong> ${esc(sessao.titulo)}<br>
          <span class="muted">${resp}/${total} itens respondidos · tempo restante ${fmtTempo(sessao.tempoRestante)} · ${sessao.config.modo === 'real' ? 'Simulado real' : 'Modo treino'}</span>
        </div>
        <div class="grupo-botoes">
          <button type="button" class="btn btn-primario" data-acao="continuar">Continuar prova</button>
          <button type="button" class="btn btn-perigo-sec" data-acao="descartar">Descartar</button>
        </div>
      </div>`;
  } else {
    const r = calcularResultado();
    el.innerHTML = `
      <div class="banner">
        <div><strong>Último simulado:</strong> ${esc(sessao.titulo)}<br>
        <span class="muted">Nota líquida ${fmtPts(r.liquido)} de ${fmtPts(r.total.max)} · ${fmtData(sessao.finalizadaEm)}</span></div>
        <button type="button" class="btn btn-sec" data-acao="ver-resultado">Ver relatório</button>
      </div>`;
  }
}

const valorRadio = nome => ($(`input[name="${nome}"]:checked`) || {}).value;

/** Atualiza os campos dinâmicos do formulário de configuração. */
function atualizarFormulario() {
  const tipo = valorRadio('tipo');
  const provas = obterProvas();
  const campoProva = $('#campo-prova'), campoLingua = $('#campo-lingua'), campoRapido = $('#campo-rapido');

  if (tipo === 'rapido') {
    campoProva.hidden = true;
    campoLingua.hidden = true;
    campoRapido.hidden = false;
    renderDisciplinas(provas);
  } else {
    campoRapido.hidden = true;
    campoProva.hidden = false;
    const dia = tipo === 'dia1' ? 1 : 2;
    const lista = provas.filter(p => Number(p.dia) === dia);
    const sel = $('#sel-prova');
    const atual = sel.value;
    sel.innerHTML = lista.length
      ? lista.map(p => `<option value="${esc(p.id)}">${esc(p.titulo)}${p.origem === 'importada' ? ' (importada)' : ''}</option>`).join('')
      : '<option value="">Nenhuma prova disponível para este dia</option>';
    if (lista.some(p => p.id === atual)) sel.value = atual;

    const prova = lista.find(p => p.id === sel.value);
    const linguas = prova ? [...new Set(prova.blocos.filter(b => b.lingua).map(b => b.lingua))] : [];
    const selL = $('#sel-lingua');
    const atualL = selL.value;
    selL.innerHTML = linguas.map(l => `<option value="${esc(l)}">${esc(LINGUAS[l] || l)}</option>`).join('');
    if (linguas.includes(atualL)) selL.value = atualL;
    campoLingua.hidden = linguas.length === 0;
  }
  atualizarResumoConfig();
}

/** Lista de disciplinas (checkboxes) para o simulado rápido. */
function renderDisciplinas(provas) {
  const box = $('#lista-disciplinas');
  const marcadas = new Set($$('input[name="disc"]:checked', box).map(i => i.value));
  const primeiraVez = !box.dataset.pronto;
  const info = new Map(); // disciplina → { area, itens }
  provas.forEach(p => p.blocos.forEach(b => {
    const d = info.get(b.disciplina) || { area: b.area || 'Outras', itens: 0 };
    d.itens += b.itens.length;
    info.set(b.disciplina, d);
  }));
  const porArea = {};
  info.forEach((d, nome) => { (porArea[d.area] = porArea[d.area] || []).push({ nome, ...d }); });

  box.innerHTML = Object.entries(porArea).map(([area, discs]) => `
    <div class="grupo-disc">
      <span class="grupo-disc-titulo">${esc(area)}</span>
      ${discs.map(d => `
        <label class="chk">
          <input type="checkbox" name="disc" value="${esc(d.nome)}" ${(marcadas.has(d.nome) || (primeiraVez && d.nome === 'Matemática')) ? 'checked' : ''}>
          <span>${esc(d.nome)} <small>(${d.itens})</small></span>
        </label>`).join('')}
    </div>`).join('');
  box.dataset.pronto = '1';
}

/** Lê o formulário e devolve a configuração (sem validar). */
function lerConfig() {
  const tipo = valorRadio('tipo');
  const cfg = { tipo, modo: valorRadio('modo') };
  if (tipo === 'rapido') {
    cfg.disciplinas = $$('input[name="disc"]:checked').map(i => i.value);
    cfg.duracaoSeg = Number($('#sel-duracao').value) * 60;
  } else {
    cfg.provaId = $('#sel-prova').value;
    cfg.lingua = $('#campo-lingua').hidden ? null : $('#sel-lingua').value;
    const prova = obterProvas().find(p => p.id === cfg.provaId);
    cfg.duracaoSeg = ((prova && prova.duracaoMin) || 300) * 60;
  }
  return cfg;
}

/** Linha de resumo abaixo do formulário. */
function atualizarResumoConfig() {
  const cfg = lerConfig();
  const el = $('#resumo-config');
  let itens = 0;
  if (cfg.tipo === 'rapido') {
    obterProvas().forEach(p => p.blocos.forEach(b => { if (cfg.disciplinas.includes(b.disciplina)) itens += b.itens.length; }));
  } else {
    const prova = obterProvas().find(p => p.id === cfg.provaId);
    if (prova) itens = contarItens(prova, cfg.lingua).total;
  }
  $('#btn-iniciar').disabled = itens === 0;
  el.innerHTML = itens
    ? `<strong>${itens} itens</strong> · duração <strong>${fmtDuracao(cfg.duracaoSeg)}</strong> · ${cfg.modo === 'real' ? 'Simulado real' : 'Modo treino'}`
    : 'Selecione uma prova ou ao menos uma disciplina.';
}

/** Inicia um novo simulado com a configuração do formulário. */
async function iniciarSimulado() {
  const cfg = lerConfig();
  if (cfg.tipo === 'rapido' && !cfg.disciplinas.length) { toast('Selecione ao menos uma disciplina.', 'alerta'); return; }
  let nova;
  try { nova = montarSessao(cfg); } catch (e) { toast(e.message, 'erro'); return; }
  if (!nova.blocos.length) { toast('Nenhum item encontrado para essa configuração.', 'alerta'); return; }

  if (sessao && !sessao.finalizada) {
    const ok = await modal({
      titulo: 'Substituir simulado em andamento?',
      html: '<p>Há um simulado em andamento. Ao iniciar outro, o progresso atual será perdido.</p>',
      botoes: [{ texto: 'Cancelar', valor: false }, { texto: 'Iniciar novo', valor: true, classe: 'btn-perigo' }]
    });
    if (!ok) return;
  }
  gravarLS(CHAVES.form, cfg);
  sessao = nova;
  salvarSessao();
  abrirProva();
  toast(cfg.modo === 'real' ? 'Boa prova! O cronômetro já está correndo.' : 'Modo treino: use “Conferir” para ver o gabarito de cada item.', 'info');
}

/** Tabela das provas existentes no banco. */
function renderBancoInfo() {
  const provas = obterProvas();
  const nomeDia = d => d === 1 ? '1º Dia' : d === 2 ? '2º Dia' : 'Avulsa';
  $('#lista-provas').innerHTML = `
    <table class="tabela">
      <thead><tr><th>Prova</th><th>Dia</th><th>Origem</th><th>Blocos</th><th>Itens</th><th>A / B / C / D</th><th></th></tr></thead>
      <tbody>
        ${provas.map(p => {
          const c = contarItens(p);
          return `<tr>
            <td>${esc(p.titulo)}<br><small class="muted"><code>${esc(p.id)}</code></small></td>
            <td>${nomeDia(Number(p.dia))}</td>
            <td><span class="pill ${p.origem === 'importada' ? 'pill-imp' : ''}">${p.origem === 'importada' ? 'Importada' : 'Padrão'}</span></td>
            <td>${p.blocos.length}</td>
            <td><strong>${c.total}</strong></td>
            <td class="nowrap">${c.A} / ${c.B} / ${c.C} / ${c.D}</td>
            <td class="nowrap">
              <button type="button" class="btn btn-sec btn-peq" data-acao="exportar-prova" data-id="${esc(p.id)}" title="Exportar esta prova">⤓</button>
              ${p.origem === 'importada' ? `<button type="button" class="btn btn-perigo-sec btn-peq" data-acao="remover-prova" data-id="${esc(p.id)}" title="Remover">✕</button>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

/** Histórico das últimas provas finalizadas. */
function renderHistorico() {
  const hist = lerLS(CHAVES.historico, []);
  const el = $('#lista-historico');
  if (!hist.length) { el.innerHTML = '<p class="muted">Nenhum simulado finalizado ainda.</p>'; return; }
  el.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr><th>Data</th><th>Simulado</th><th>Modo</th><th>Nota líquida</th><th>Aproveitamento</th></tr></thead>
    <tbody>${hist.slice().reverse().slice(0, 15).map(h => {
      const pct = h.max ? (h.liquido / h.max) * 100 : 0;
      return `<tr>
        <td class="nowrap">${fmtData(h.data)}</td>
        <td>${esc(h.titulo)}</td>
        <td>${h.modo === 'real' ? 'Real' : 'Treino'}</td>
        <td><strong class="${h.liquido < 0 ? 'neg' : ''}">${fmtPts(h.liquido)}</strong> / ${fmtPts(h.max)}${h.pendentes ? ` <small class="muted">(${h.pendentes} D pendente)</small>` : ''}</td>
        <td>${barra(pct)}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

/** Mini barra de aproveitamento (aceita valores negativos). */
function barra(pct) {
  const largura = clamp(Math.abs(pct), 0, 100);
  return `<div class="barra-pct ${pct < 0 ? 'negativa' : ''}"><span style="width:${largura}%"></span><em>${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</em></div>`;
}

/* =====================================================================
   9. TELA: PROVA
   ===================================================================== */
function abrirProva() {
  indexarSessao();
  mostrarTela('prova');
  renderBarraProva();
  renderBloco();
  renderMapa();
  iniciarTimer();
}

/** Preenche a barra superior (título, cronômetro, progresso, ações). */
function renderBarraProva() {
  const real = sessao.config.modo === 'real';
  $('#header-prova').innerHTML = `
    <div class="hp-info">
      <span class="hp-titulo" title="${esc(sessao.titulo)}">${esc(sessao.titulo)}</span>
      <span class="badge ${real ? 'badge-real' : 'badge-treino'}">${real ? 'Simulado real' : 'Modo treino'}</span>
    </div>
    <div class="timer" id="timer" role="timer" aria-live="off" title="Tempo restante">
      <span aria-hidden="true">⏱</span><span id="timer-valor">${fmtTempo(sessao.tempoRestante)}</span>
    </div>
    <div class="hp-progresso" title="Itens respondidos">
      <span id="progresso-txt"></span>
      <div class="progresso"><span id="progresso-barra"></span></div>
    </div>
    <div class="hp-acoes">
      <button type="button" class="btn btn-sec" data-acao="abrir-mapa">▦ <span class="so-desktop">Cartão-resposta</span></button>
      <button type="button" class="btn btn-sec" data-acao="sair-prova" title="Salvar e voltar ao início">⏸<span class="so-desktop"> Pausar</span></button>
      <button type="button" class="btn btn-primario" data-acao="finalizar">Finalizar</button>
    </div>`;
  atualizarTimerUI();
  atualizarProgresso();
  ajustarAlturaHeader();
}

/** Faixa de numeração de um bloco: "1 a 5". */
function faixa(b) {
  const a = b.itens[0].n, z = b.itens[b.itens.length - 1].n;
  return a === z ? `${a}` : `${a} a ${z}`;
}

/** Abas de navegação entre blocos. */
function renderAbas() {
  $('#abas-blocos').innerHTML = sessao.blocos.map((b, i) => {
    const resp = b.itens.filter(respondido).length;
    const completo = resp === b.itens.length;
    return `<button type="button" class="aba ${i === sessao.blocoAtual ? 'ativa' : ''} ${completo ? 'completa' : ''}" data-acao="ir-bloco" data-b="${i}">
      <span class="aba-n">${faixa(b)}</span>
      <span class="aba-disc">${esc(b.disciplina)}</span>
      <span class="aba-cont">${resp}/${b.itens.length}</span>
    </button>`;
  }).join('');
  $('#abas-blocos .aba.ativa')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

/** Renderiza o bloco atual: texto-base à esquerda, itens à direita. */
function renderBloco() {
  const b = sessao.blocos[sessao.blocoAtual];
  const total = sessao.blocos.length;

  $('#painel-texto').innerHTML = `
    <div class="texto-cab">
      <div>
        ${b.area ? `<span class="area">${esc(b.area)}</span>` : ''}
        <h2>${esc(b.disciplina)}</h2>
      </div>
      <div class="ferramentas-texto">
        <button type="button" class="btn-icone" data-acao="fonte-menos" title="Diminuir fonte">A−</button>
        <button type="button" class="btn-icone" data-acao="fonte-mais" title="Aumentar fonte">A+</button>
        <button type="button" class="btn-icone so-mobile" data-acao="toggle-texto" title="Mostrar/ocultar texto">⇕</button>
      </div>
    </div>
    <p class="instrucao">${b.texto ? `Os itens de <strong>${faixa(b)}</strong> referem-se ao texto a seguir.` : `Itens de <strong>${faixa(b)}</strong>.`}</p>
    <article class="texto-base">
      ${b.titulo ? `<h3>${esc(b.titulo)}</h3>` : ''}
      ${b.texto ? sanitizar(b.texto) : '<p class="muted">Este bloco não possui texto-base.</p>'}
      ${b.fonte ? `<p class="fonte">${sanitizar(b.fonte)}</p>` : ''}
    </article>`;

  $('#painel-itens').innerHTML = `
    <div class="itens-lista">${b.itens.map(renderItem).join('')}</div>
    <nav class="nav-blocos">
      <button type="button" class="btn btn-sec" data-acao="bloco-ant" ${sessao.blocoAtual === 0 ? 'disabled' : ''}>← Bloco anterior</button>
      <span class="muted">Bloco ${sessao.blocoAtual + 1} de ${total}</span>
      ${sessao.blocoAtual < total - 1
        ? '<button type="button" class="btn btn-primario" data-acao="bloco-prox">Próximo bloco →</button>'
        : '<button type="button" class="btn btn-primario" data-acao="finalizar">Finalizar prova</button>'}
    </nav>`;

  $('#painel-texto').scrollTop = 0;
  $('#painel-itens').scrollTop = 0;
  renderAbas();
  salvarSessao();
}

/** HTML de um item conforme o tipo. */
function renderItem(item) {
  const r = sessao.respostas[item.n];
  const temResp = respondido(item);
  const rev = !!sessao.revisao[item.n];
  const treino = sessao.config.modo === 'treino';
  let controles = '';

  switch (item.tipo) {
    case 'A':
      controles = `
        <div class="ce" role="group" aria-label="Resposta do item ${item.n}">
          <button type="button" class="op-ce op-c ${r === 'C' ? 'sel' : ''}" data-acao="marcar" data-n="${item.n}" data-v="C" aria-pressed="${r === 'C'}"><b>C</b><small>Certo</small></button>
          <button type="button" class="op-ce op-e ${r === 'E' ? 'sel' : ''}" data-acao="marcar" data-n="${item.n}" data-v="E" aria-pressed="${r === 'E'}"><b>E</b><small>Errado</small></button>
          <button type="button" class="btn-limpar" data-acao="limpar" data-n="${item.n}" ${temResp ? '' : 'disabled'}>⌫ Deixar em branco</button>
        </div>`;
      break;

    case 'B': {
      const digitos = temResp ? pad3(r).split('') : ['–', '–', '–'];
      const nomes = ['Centena', 'Dezena', 'Unidade'];
      controles = `
        <div class="numerica">
          <div class="digitos" aria-label="Resposta numérica do item ${item.n}">
            ${[0, 1, 2].map(p => `
              <div class="digito">
                <button type="button" data-acao="dig" data-n="${item.n}" data-pos="${p}" data-d="1" aria-label="Aumentar ${nomes[p]}">▲</button>
                <span class="dig-val ${temResp ? '' : 'vazio'}">${digitos[p]}</span>
                <button type="button" data-acao="dig" data-n="${item.n}" data-pos="${p}" data-d="-1" aria-label="Diminuir ${nomes[p]}">▼</button>
                <small>${nomes[p]}</small>
              </div>`).join('')}
          </div>
          <div class="numerica-lado">
            <label class="rotulo" for="num-${item.n}">ou digite</label>
            <input class="num-input" id="num-${item.n}" data-n="${item.n}" type="text" inputmode="numeric" maxlength="3" placeholder="000" value="${temResp ? pad3(r) : ''}" autocomplete="off">
            <button type="button" class="btn-limpar" data-acao="limpar" data-n="${item.n}" ${temResp ? '' : 'disabled'}>⌫ Deixar em branco</button>
          </div>
        </div>`;
      break;
    }

    case 'C': {
      const elim = sessao.eliminadas[item.n] || [];
      controles = `
        <ol class="alts">
          ${item.alternativas.map((txt, i) => {
            const L = LETRAS[i];
            const riscada = elim.includes(L);
            return `<li class="alt ${r === L ? 'sel' : ''} ${riscada ? 'riscada' : ''}">
              <button type="button" class="alt-sel" data-acao="marcar" data-n="${item.n}" data-v="${L}" aria-pressed="${r === L}">
                <span class="letra">${L}</span><span class="alt-txt">${sanitizar(txt)}</span>
              </button>
              <button type="button" class="riscar" data-acao="riscar" data-n="${item.n}" data-v="${L}" title="${riscada ? 'Desfazer risco' : 'Riscar (eliminar) alternativa'}" aria-label="Riscar alternativa ${L}">${riscada ? '↺' : '✂'}</button>
            </li>`;
          }).join('')}
        </ol>
        <button type="button" class="btn-limpar" data-acao="limpar" data-n="${item.n}" ${temResp ? '' : 'disabled'}>⌫ Deixar em branco</button>`;
      break;
    }

    case 'D': {
      const texto = typeof r === 'string' ? r : '';
      const max = item.maxLinhas || 20;
      controles = `
        <div class="discursiva">
          <div class="folha-wrap" style="--linhas:${max}">
            <textarea class="folha" id="folha-${item.n}" data-n="${item.n}" rows="${max}" spellcheck="true" placeholder="Escreva sua resposta (até ${max} linhas, ≈${CHARS_POR_LINHA} caracteres por linha)…">${esc(texto)}</textarea>
          </div>
          <div class="folha-rodape">
            <span class="contador" id="cont-${item.n}">${contadorTexto(texto, max)}</span>
            <button type="button" class="btn-limpar" data-acao="limpar" data-n="${item.n}" ${temResp ? '' : 'disabled'}>⌫ Apagar resposta</button>
          </div>
        </div>`;
      break;
    }
  }

  const feedback = treino && sessao.conferidos[item.n] ? renderFeedback(item) : '';
  const botaoConferir = treino
    ? `<button type="button" class="btn btn-sec btn-peq" data-acao="conferir" data-n="${item.n}">${sessao.conferidos[item.n] ? 'Ocultar gabarito' : (item.tipo === 'D' ? 'Ver espelho' : 'Conferir')}</button>`
    : '';

  return `
    <article class="item tipo-${item.tipo} ${temResp ? 'respondido' : ''} ${rev ? 'em-revisao' : ''}" id="item-${item.n}" data-n="${item.n}">
      <header class="item-cab">
        <span class="item-num">${item.n}</span>
        <span class="tag tag-${item.tipo}" title="${esc(REGRAS[item.tipo].nome)}">Tipo ${item.tipo}</span>
        <span class="item-pts">${item.tipo === 'A' ? '+1 / −1' : item.tipo === 'B' ? '+2 / 0' : item.tipo === 'C' ? '+2 / −0,667' : 'até 3 pts'}</span>
        <span class="espaco"></span>
        ${botaoConferir}
        <button type="button" class="btn-rev ${rev ? 'ativo' : ''}" data-acao="revisao" data-n="${item.n}" aria-pressed="${rev}" title="Marcar para revisão">? Revisar</button>
      </header>
      <div class="item-enunciado">${sanitizar(item.enunciado)}</div>
      <div class="item-resposta">${controles}</div>
      ${feedback}
    </article>`;
}

/** Feedback do Modo Treino (gabarito comentado na hora). */
function renderFeedback(item) {
  if (item.tipo === 'D') {
    return `<div class="feedback fb-info"><strong>Espelho de correção</strong>${sanitizar(item.espelho)}</div>`;
  }
  const c = corrigirItem(item);
  const gab = item.tipo === 'B' ? pad3(item.gabarito) : item.gabarito;
  const rotulo = { certo: '✔ Certo', errado: '✘ Errado', branco: '○ Em branco' }[c.status];
  return `
    <div class="feedback fb-${c.status}">
      <div class="fb-linha"><strong>${rotulo}</strong> · Gabarito: <b>${esc(gab)}</b> · Pontuação: <b>${fmtSinal(c.pontos)}</b></div>
      ${item.justificativa ? `<div class="fb-just">${sanitizar(item.justificativa)}</div>` : ''}
    </div>`;
}

/** Contagem de linhas aproximada (quebras automáticas + manuais). */
function contarLinhas(txt) {
  if (!txt) return 0;
  return txt.split('\n').reduce((s, l) => s + Math.max(1, Math.ceil(l.length / CHARS_POR_LINHA)), 0);
}
function contadorTexto(txt, max) {
  const linhas = contarLinhas(txt);
  const excedeu = linhas > max;
  return `<span class="${excedeu ? 'neg' : ''}">${linhas}/${max} linhas</span> · ${txt.length} caracteres${excedeu ? ' · <strong class="neg">limite excedido: o texto além da linha ' + max + ' seria desconsiderado</strong>' : ''}`;
}

/** Re-renderiza um único item (após marcar/limpar). */
function atualizarItem(n) {
  const item = getItem(n);
  const el = document.getElementById('item-' + n);
  if (item && el) el.outerHTML = renderItem(item);
  aposAlteracao();
}

/** Atualizações comuns após qualquer mudança de resposta. */
function aposAlteracao() {
  salvarSessao();
  atualizarProgresso();
  renderAbas();
  renderMapa();
}

function atualizarProgresso() {
  const itens = todosItens();
  const resp = itens.filter(respondido).length;
  const txt = $('#progresso-txt');
  if (!txt) return;
  txt.textContent = `${resp}/${itens.length}`;
  $('#progresso-barra').style.width = (itens.length ? (resp / itens.length) * 100 : 0) + '%';
}

/** Leva a tela até um item (trocando de bloco se necessário). */
function irParaItem(n) {
  const item = getItem(n);
  if (!item) return;
  if (item.b !== sessao.blocoAtual) { sessao.blocoAtual = item.b; renderBloco(); }
  fecharMapa();
  requestAnimationFrame(() => {
    const el = document.getElementById('item-' + n);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('destaque'); void el.offsetWidth; el.classList.add('destaque');
  });
  renderMapa();
}

/* ---------- Cartão-resposta (mapa de questões) ---------- */
function renderMapa() {
  if (!sessao) return;
  const itens = todosItens();
  const resp = itens.filter(respondido).length;
  const revs = itens.filter(i => sessao.revisao[i.n]).length;
  $('#mapa').innerHTML = `
    <header class="mapa-cab">
      <h2>Cartão-resposta</h2>
      <button type="button" class="btn-icone" data-acao="fechar-mapa" aria-label="Fechar">✕</button>
    </header>
    <div class="mapa-resumo">
      <div><b>${resp}</b><small>Respondidos</small></div>
      <div><b>${itens.length - resp}</b><small>Em branco</small></div>
      <div><b>${revs}</b><small>Revisar</small></div>
    </div>
    <div class="legenda">
      <span><i class="cel-mini resp"></i>Respondido</span>
      <span><i class="cel-mini"></i>Em branco</span>
      <span><i class="cel-mini rev">?</i>Revisão</span>
    </div>
    <div class="mapa-corpo">
      ${sessao.blocos.map((b, bi) => `
        <section class="mapa-bloco ${bi === sessao.blocoAtual ? 'atual' : ''}">
          <h3>${esc(b.disciplina)} <small>${faixa(b)}</small></h3>
          <div class="mapa-grid">
            ${b.itens.map(it => `
              <button type="button" class="cel ${respondido(it) ? 'resp' : ''} ${sessao.revisao[it.n] ? 'rev' : ''}" data-acao="ir" data-n="${it.n}" title="Item ${it.n} · Tipo ${it.tipo}">
                <span class="cel-n">${it.n}</span>
                <span class="cel-r">${esc(respostaCurta(it)) || '&nbsp;'}</span>
              </button>`).join('')}
          </div>
        </section>`).join('')}
    </div>
    <footer class="mapa-rodape">
      <button type="button" class="btn btn-primario btn-bloco" data-acao="finalizar">Finalizar e entregar prova</button>
    </footer>`;
}
function abrirMapa() { $('#mapa').classList.add('aberto'); $('#mapa-fundo').classList.add('aberto'); $('#mapa').setAttribute('aria-hidden', 'false'); }
function fecharMapa() { $('#mapa')?.classList.remove('aberto'); $('#mapa-fundo')?.classList.remove('aberto'); $('#mapa')?.setAttribute('aria-hidden', 'true'); }

/* =====================================================================
   10. CRONÔMETRO
   ===================================================================== */
function iniciarTimer() {
  pararTimer();
  ultimoTick = Date.now();
  atualizarTimerUI();
  if (sessao.tempoRestante <= 0) return;
  timerId = setInterval(tick, 1000);
}
function pararTimer() { if (timerId) clearInterval(timerId); timerId = null; }

/** Um "tick": desconta o tempo real decorrido (robusto a abas em segundo plano). */
function tick() {
  if (!sessao || sessao.finalizada) { pararTimer(); return; }
  const agora = Date.now();
  const decorrido = Math.floor((agora - ultimoTick) / 1000);
  if (decorrido < 1) return;
  ultimoTick += decorrido * 1000;
  sessao.tempoRestante = Math.max(0, sessao.tempoRestante - decorrido);
  atualizarTimerUI();
  verificarAlertas();
  salvarSessao();

  if (sessao.tempoRestante === 0) {
    pararTimer();
    if (sessao.config.modo === 'real') {
      finalizarProva(true);
    } else {
      toast('Tempo esgotado! No modo treino você pode continuar respondendo.', 'alerta', 6000);
    }
  }
}

function atualizarTimerUI() {
  const el = $('#timer');
  if (!el || !sessao) return;
  $('#timer-valor').textContent = fmtTempo(sessao.tempoRestante);
  el.classList.toggle('alerta', sessao.tempoRestante <= ALERTA_30 && sessao.tempoRestante > ALERTA_10);
  el.classList.toggle('critico', sessao.tempoRestante <= ALERTA_10);
}

/** Alertas visuais nos últimos 30 e 10 minutos (uma vez cada). */
function verificarAlertas() {
  const t = sessao.tempoRestante, a = sessao.alertas;
  if (t <= ALERTA_30 && t > ALERTA_10 && !a.m30 && sessao.duracao > ALERTA_30) {
    a.m30 = true;
    toast('⚠ Restam 30 minutos. Comece a transcrever suas respostas para o cartão.', 'alerta', 7000);
  }
  if (t <= ALERTA_10 && !a.m10 && sessao.duracao > ALERTA_10) {
    a.m10 = true;
    toast('⏰ Restam 10 minutos! Revise os itens marcados com “?”.', 'erro', 8000);
  }
}

/* =====================================================================
   11. FINALIZAÇÃO
   ===================================================================== */
async function finalizarProva(automatico = false) {
  if (!sessao || sessao.finalizada) return;
  if (!automatico) {
    const itens = todosItens();
    const brancos = itens.filter(i => !respondido(i)).length;
    const revs = itens.filter(i => sessao.revisao[i.n]).length;
    const ok = await modal({
      titulo: 'Entregar a prova?',
      html: `<p>Confira o resumo do seu cartão-resposta:</p>
        <ul class="lista-modal">
          <li><b>${itens.length - brancos}</b> itens respondidos</li>
          <li><b>${brancos}</b> itens em branco</li>
          <li><b>${revs}</b> itens marcados para revisão</li>
          <li>Tempo restante: <b>${fmtTempo(sessao.tempoRestante)}</b></li>
        </ul>
        <p class="muted">Após a entrega, não será possível alterar as respostas.</p>`,
      botoes: [{ texto: 'Voltar à prova', valor: false }, { texto: 'Entregar prova', valor: true, classe: 'btn-primario' }]
    });
    if (!ok) return;
  }
  pararTimer();
  sessao.finalizada = true;
  sessao.finalizadaEm = Date.now();
  salvarSessao();
  registrarHistorico();
  filtroRevisao = 'todos';
  renderResultado();
  if (automatico) {
    modal({ titulo: '⏰ Tempo esgotado', html: '<p>O tempo de prova terminou e seu caderno foi recolhido automaticamente. Confira seu desempenho.</p>' });
  }
}

/** Grava (ou atualiza) a entrada do histórico para a sessão atual. */
function registrarHistorico() {
  const r = calcularResultado();
  const hist = lerLS(CHAVES.historico, []);
  const entrada = {
    id: sessao.id, data: sessao.finalizadaEm, titulo: sessao.titulo, modo: sessao.config.modo,
    liquido: Math.round(r.liquido * 1000) / 1000, max: r.total.max, pendentes: r.total.pendentes
  };
  const i = hist.findIndex(h => h.id === sessao.id);
  if (i >= 0) hist[i] = entrada; else hist.push(entrada);
  gravarLS(CHAVES.historico, hist.slice(-50));
}

/* =====================================================================
   12. TELA: RESULTADO
   ===================================================================== */
function renderResultado() {
  indexarSessao();
  pararTimer();
  mostrarTela('resultado');
  const usado = sessao.duracao - sessao.tempoRestante;
  $('#tela-resultado').innerHTML = `
    <div class="container">
      <div class="res-topo">
        <div>
          <span class="area">Relatório de desempenho</span>
          <h1>${esc(sessao.titulo)}</h1>
          <p class="muted">${sessao.config.modo === 'real' ? 'Simulado real' : 'Modo treino'} · entregue em ${fmtData(sessao.finalizadaEm)} · tempo utilizado ${fmtTempo(usado)} de ${fmtTempo(sessao.duracao)}</p>
        </div>
        <div class="grupo-botoes nao-imprimir">
          <button type="button" class="btn btn-sec" data-acao="imprimir">🖶 Imprimir</button>
          <button type="button" class="btn btn-sec" data-acao="exportar-resultado">⤓ Exportar</button>
          <button type="button" class="btn btn-sec" data-acao="refazer">↻ Refazer</button>
          <button type="button" class="btn btn-primario" data-acao="novo">Novo simulado</button>
        </div>
      </div>
      <div id="res-resumo"></div>
      <section class="card">
        <div class="card-cab">
          <h2>Gabarito comentado</h2>
          <div class="filtros nao-imprimir" id="filtros-revisao" role="group" aria-label="Filtrar itens"></div>
        </div>
        <div id="res-revisao"></div>
      </section>
    </div>`;
  renderResumo();
  renderRevisao();
}

/** Cartões de nota + tabelas por tipo e disciplina. */
function renderResumo() {
  const r = calcularResultado();
  const t = r.total;
  const pct = t.max ? (r.liquido / t.max) * 100 : 0;
  const perdaA = r.porTipo.A.perda, perdaC = r.porTipo.C.perda;
  const semErros = r.liquido + perdaA + perdaC;
  const respA = r.porTipo.A.certos + r.porTipo.A.errados;
  const taxaA = respA ? (r.porTipo.A.certos / respA) * 100 : null;

  const linha = (rotulo, l, extra = '') => {
    const liq = l.ganho - l.perda;
    const p = l.max ? (liq / l.max) * 100 : 0;
    return `<tr>
      <td>${rotulo}</td>
      <td>${l.itens}</td>
      <td class="pos">${l.certos}</td>
      <td class="neg">${l.errados}</td>
      <td>${l.brancos}${l.pendentes ? ` <small class="muted">(+${l.pendentes} pend.)</small>` : ''}</td>
      <td class="pos">${fmtSinal(l.ganho)}</td>
      <td class="neg">${l.perda ? '−' + fmtPts(l.perda) : '0'}</td>
      <td><strong>${fmtPts(liq)}</strong> <small class="muted">/ ${fmtPts(l.max)}</small></td>
      <td>${barra(p)}</td>
      ${extra}
    </tr>`;
  };
  const cabecalho = primeira => `<thead><tr><th>${primeira}</th><th>Itens</th><th>Certos</th><th>Errados</th><th>Em branco</th><th>Pontos +</th><th>Pontos −</th><th>Saldo líquido</th><th>Aproveitamento</th></tr></thead>`;

  $('#res-resumo').innerHTML = `
    <div class="cards-nota">
      <div class="card-nota destaque-nota">
        <small>Pontuação líquida final</small>
        <strong class="${r.liquido < 0 ? 'neg' : ''}">${fmtPts(r.liquido)}</strong>
        <span>de ${fmtPts(t.max)} pontos possíveis</span>
      </div>
      <div class="card-nota">
        <small>Pontuação bruta (acertos)</small>
        <strong class="pos">${fmtSinal(t.ganho)}</strong>
        <span>${t.certos} itens certos/avaliados</span>
      </div>
      <div class="card-nota">
        <small>Pontos perdidos por erros</small>
        <strong class="neg">${t.perda ? '−' + fmtPts(t.perda) : '0'}</strong>
        <span>Tipo A: ${fmtSinal(-perdaA)} · Tipo C: ${fmtSinal(-perdaC)}</span>
      </div>
      <div class="card-nota">
        <small>Aproveitamento</small>
        <strong>${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
        <span>${t.brancos} em branco · ${t.errados} errados</span>
      </div>
    </div>

    ${t.pendentes ? `<div class="banner banner-alerta nao-imprimir">✎ <span><strong>${t.pendentes} item(ns) discursivo(s) aguardando sua autoavaliação.</strong> Compare sua resposta com o espelho da banca no gabarito comentado e atribua uma nota de 0 a 3 — o placar é atualizado automaticamente.</span> <button type="button" class="btn btn-sec btn-peq" data-acao="filtro" data-f="D">Avaliar agora</button></div>` : ''}

    <div class="insights">
      ${(perdaA + perdaC) > 0 ? `<p>💡 Os erros em itens A e C custaram <strong>${fmtPts(perdaA + perdaC)} ponto(s)</strong>. Se esses itens tivessem ficado em branco, sua nota líquida seria <strong>${fmtPts(semErros)}</strong>.</p>` : ''}
      ${taxaA !== null ? `<p>🎯 Taxa de acerto nos itens A que você marcou: <strong>${taxaA.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>. ${taxaA > 50 ? 'Acima de 50%: marcar valeu a pena.' : 'Abaixo de 50%: deixar mais itens em branco teria aumentado sua nota.'}</p>` : ''}
      ${r.porTipo.B.brancos ? `<p>🔢 Você deixou <strong>${r.porTipo.B.brancos}</strong> item(ns) tipo B em branco. Como não há desconto, sempre vale arriscar um valor.</p>` : ''}
    </div>

    <section class="card">
      <h2>Desempenho por tipo de item</h2>
      <div class="tabela-wrap"><table class="tabela tabela-res">
        ${cabecalho('Tipo')}
        <tbody>
          ${['A', 'B', 'C', 'D'].filter(k => r.porTipo[k].itens).map(k => linha(`<span class="tag tag-${k}">${k}</span> ${REGRAS[k].nome}`, r.porTipo[k])).join('')}
        </tbody>
        <tfoot>${linha('<strong>Total</strong>', t)}</tfoot>
      </table></div>
      ${r.porTipo.D.itens ? '<p class="muted nota-tabela">Nos itens D, “certos” indica itens respondidos e já avaliados por você.</p>' : ''}
    </section>

    <section class="card">
      <h2>Desempenho por disciplina</h2>
      <div class="tabela-wrap"><table class="tabela tabela-res">
        ${cabecalho('Disciplina')}
        <tbody>${Object.entries(r.porDisc).map(([d, l]) => linha(esc(d), l)).join('')}</tbody>
      </table></div>
    </section>`;

  renderFiltros(r);
}

/** Botões de filtro do gabarito comentado. */
function renderFiltros(r = calcularResultado()) {
  const itens = todosItens();
  const cont = {
    todos: itens.length,
    certo: itens.filter(i => ['certo', 'avaliado'].includes(corrigirItem(i).status)).length,
    errado: r.total.errados,
    branco: r.total.brancos,
    D: r.porTipo.D.itens,
    revisao: itens.filter(i => sessao.revisao[i.n]).length
  };
  const nomes = { todos: 'Todos', certo: 'Certos', errado: 'Errados', branco: 'Em branco', D: 'Discursivos', revisao: 'Marcados “?”' };
  $('#filtros-revisao').innerHTML = Object.keys(nomes)
    .filter(k => k === 'todos' || cont[k] > 0 || filtroRevisao === k)
    .map(k => `<button type="button" class="filtro ${filtroRevisao === k ? 'ativo' : ''}" data-acao="filtro" data-f="${k}">${nomes[k]} <small>${cont[k]}</small></button>`).join('');
}

/** Testa se um item passa no filtro atual. */
function passaFiltro(item) {
  const st = corrigirItem(item).status;
  switch (filtroRevisao) {
    case 'certo': return st === 'certo' || st === 'avaliado';
    case 'errado': return st === 'errado';
    case 'branco': return st === 'branco';
    case 'D': return item.tipo === 'D';
    case 'revisao': return !!sessao.revisao[item.n];
    default: return true;
  }
}

/** Lista completa do gabarito comentado. */
function renderRevisao() {
  const html = sessao.blocos.map(b => {
    const itens = b.itens.filter(passaFiltro);
    if (!itens.length) return '';
    return `
      <section class="rev-bloco">
        <h3>${esc(b.disciplina)}${b.titulo ? ` — ${esc(b.titulo)}` : ''} <small class="muted">itens ${faixa(b)}</small></h3>
        ${b.texto ? `<details class="rev-texto"><summary>Texto-base</summary><div class="texto-base">${sanitizar(b.texto)}${b.fonte ? `<p class="fonte">${sanitizar(b.fonte)}</p>` : ''}</div></details>` : ''}
        ${itens.map(renderItemRevisao).join('')}
      </section>`;
  }).join('');
  $('#res-revisao').innerHTML = html || '<p class="muted">Nenhum item corresponde a este filtro.</p>';
}

/** Um item do gabarito comentado. */
function renderItemRevisao(item) {
  const c = corrigirItem(item);
  const r = sessao.respostas[item.n];
  const rotulos = { certo: '✔ Certo', errado: '✘ Errado', branco: '○ Em branco', avaliado: '✎ Avaliado', pendente: '✎ Aguardando nota' };
  let corpo = '';

  if (item.tipo === 'D') {
    const nota = sessao.notasD[item.n];
    corpo = `
      <div class="rev-d">
        <div>
          <small class="rotulo">Sua resposta</small>
          <div class="resp-d">${respondido(item) ? esc(r) : '<em class="muted">Em branco</em>'}</div>
          ${respondido(item) ? `<small class="muted">${contarLinhas(r)}/${item.maxLinhas || 20} linhas</small>` : ''}
        </div>
        <div>
          <small class="rotulo">Espelho de correção da banca</small>
          <div class="espelho">${sanitizar(item.espelho)}</div>
        </div>
      </div>
      ${respondido(item) ? `
        <div class="nota-d">
          <label for="nota-${item.n}"><strong>Sua nota para este item (0 a 3):</strong></label>
          <input type="number" id="nota-${item.n}" class="input-nota" data-n="${item.n}" min="0" max="3" step="0.1" value="${nota ?? ''}" placeholder="0,0">
          <div class="atalhos-nota nao-imprimir">${[0, 0.5, 1, 1.5, 2, 2.5, 3].map(v => `<button type="button" class="btn btn-sec btn-peq" data-acao="nota-rapida" data-n="${item.n}" data-v="${v}">${fmtPts(v)}</button>`).join('')}</div>
        </div>` : ''}`;
  } else {
    const fmtR = v => item.tipo === 'B' ? pad3(v) : v;
    corpo = `
      <div class="rev-resp">
        <div><small>Sua resposta</small><strong>${respondido(item) ? esc(fmtR(r)) : '—'}</strong></div>
        <div><small>Gabarito oficial</small><strong>${esc(fmtR(item.gabarito))}</strong></div>
        <div><small>Pontuação</small><strong class="${c.pontos > 0 ? 'pos' : c.pontos < 0 ? 'neg' : ''}">${fmtSinal(c.pontos)}</strong></div>
      </div>
      ${item.tipo === 'C' ? `<ol class="alts alts-rev">${item.alternativas.map((txt, i) => {
        const L = LETRAS[i];
        const cls = [L === item.gabarito ? 'gabarito' : '', L === r ? 'marcada' : ''].join(' ');
        return `<li class="alt ${cls}"><span class="letra">${L}</span><span class="alt-txt">${sanitizar(txt)}</span>${L === item.gabarito ? '<em>gabarito</em>' : L === r ? '<em>sua marcação</em>' : ''}</li>`;
      }).join('')}</ol>` : ''}
      ${item.justificativa ? `<div class="justificativa"><strong>Comentário:</strong> ${sanitizar(item.justificativa)}</div>` : ''}`;
  }

  return `
    <article class="rev-item st-${c.status}" id="rev-${item.n}">
      <header class="item-cab">
        <span class="item-num">${item.n}</span>
        <span class="tag tag-${item.tipo}">Tipo ${item.tipo}</span>
        <span class="status-badge">${rotulos[c.status]}</span>
        ${sessao.revisao[item.n] ? '<span class="pill">? marcado para revisão</span>' : ''}
        <span class="espaco"></span>
        ${item.tipo === 'D' ? `<strong class="pts-d" id="pts-d-${item.n}">${c.status === 'avaliado' ? fmtSinal(c.pontos) + ' / 3' : ''}</strong>` : ''}
      </header>
      <div class="item-enunciado">${sanitizar(item.enunciado)}</div>
      ${corpo}
    </article>`;
}

/** Atualiza nota autoatribuída de item D e recalcula o placar. */
function definirNotaD(n, valor) {
  const item = getItem(n);
  if (!item) return;
  if (valor === '' || valor === null || isNaN(Number(valor))) delete sessao.notasD[n];
  else sessao.notasD[n] = clamp(Math.round(Number(valor) * 100) / 100, 0, 3);
  salvarSessao();
  registrarHistorico();
  renderResumo();
  // Atualiza só o cabeçalho do item, preservando o foco no campo
  const c = corrigirItem(item);
  const art = document.getElementById('rev-' + n);
  if (art) {
    art.className = `rev-item st-${c.status}`;
    $('.status-badge', art).textContent = c.status === 'avaliado' ? '✎ Avaliado' : '✎ Aguardando nota';
    $('#pts-d-' + n).textContent = c.status === 'avaliado' ? fmtSinal(c.pontos) + ' / 3' : '';
  }
}

/* =====================================================================
   13. AÇÕES DE RESPOSTA
   ===================================================================== */
function marcar(n, v) {
  const item = getItem(n);
  if (!item || sessao.finalizada) return;
  sessao.respostas[n] = v;
  if (item.tipo === 'C') {
    // Marcar uma alternativa riscada desfaz o risco dela
    sessao.eliminadas[n] = (sessao.eliminadas[n] || []).filter(x => x !== v);
  }
  atualizarItem(n);
}

async function limpar(n) {
  const item = getItem(n);
  if (!item) return;
  if (item.tipo === 'D' && (sessao.respostas[n] || '').trim().length > 30) {
    const ok = await modal({
      titulo: 'Apagar resposta discursiva?',
      html: '<p>Todo o texto escrito neste item será apagado.</p>',
      botoes: [{ texto: 'Cancelar', valor: false }, { texto: 'Apagar', valor: true, classe: 'btn-perigo' }]
    });
    if (!ok) return;
  }
  delete sessao.respostas[n];
  atualizarItem(n);
}

/** Ajusta um dígito (centena/dezena/unidade) do item tipo B. */
function ajustarDigito(n, pos, delta) {
  const atual = sessao.respostas[n];
  const dig = (atual === undefined || atual === null || atual === '' ? '000' : pad3(atual)).split('').map(Number);
  dig[pos] = (dig[pos] + delta + 10) % 10;
  sessao.respostas[n] = Number(dig.join(''));
  atualizarItem(n);
}

function riscar(n, v) {
  const lista = new Set(sessao.eliminadas[n] || []);
  if (lista.has(v)) lista.delete(v);
  else {
    lista.add(v);
    if (sessao.respostas[n] === v) delete sessao.respostas[n];
  }
  sessao.eliminadas[n] = [...lista];
  atualizarItem(n);
}

/* =====================================================================
   14. TEMA E FONTE
   ===================================================================== */
function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  $('#btn-tema').textContent = tema === 'escuro' ? '☀' : '☾';
  gravarLS(CHAVES.tema, tema);
}
function aplicarFonte(px) {
  px = clamp(px, 14, 26);
  document.documentElement.style.setProperty('--fs-texto', px + 'px');
  gravarLS(CHAVES.fonte, px);
}

/* =====================================================================
   15. EVENTOS (delegação)
   ===================================================================== */
document.addEventListener('click', async e => {
  const alvo = e.target.closest('[data-acao]');
  if (!alvo || alvo.disabled) return;
  const acao = alvo.dataset.acao;
  const n = Number(alvo.dataset.n);
  const v = alvo.dataset.v;

  switch (acao) {
    /* ---- gerais ---- */
    case 'tema': aplicarTema(document.documentElement.dataset.theme === 'escuro' ? 'claro' : 'escuro'); break;
    case 'ir-lobby':
      if (document.body.dataset.tela === 'prova') { salvarSessao(); toast('Progresso salvo. Use “Continuar prova” para retomar.', 'info'); }
      renderLobby();
      break;

    /* ---- lobby ---- */
    case 'iniciar': iniciarSimulado(); break;
    case 'continuar': abrirProva(); break;
    case 'ver-resultado': filtroRevisao = 'todos'; renderResultado(); break;
    case 'descartar': {
      const ok = await modal({
        titulo: 'Descartar simulado?',
        html: '<p>Todas as respostas do simulado em andamento serão perdidas.</p>',
        botoes: [{ texto: 'Cancelar', valor: false }, { texto: 'Descartar', valor: true, classe: 'btn-perigo' }]
      });
      if (ok) { sessao = null; removerLS(CHAVES.sessao); renderLobby(); }
      break;
    }
    case 'exportar-banco':
      baixarJSON({ formato: 'simulado-unb', versao: 1, exportadoEm: new Date().toISOString(), provas: obterProvas().map(({ origem, ...p }) => p) }, 'banco-simulado-unb.json');
      break;
    case 'exportar-prova': {
      const p = obterProvas().find(x => x.id === alvo.dataset.id);
      if (p) { const { origem, ...limpa } = p; baixarJSON({ formato: 'simulado-unb', versao: 1, provas: [limpa] }, `${p.id}.json`); }
      break;
    }
    case 'baixar-modelo': baixarJSON(modeloImportacao(), 'modelo-prova-unb.json'); break;
    case 'importar-texto': {
      const txt = $('#txt-json').value.trim();
      if (!txt) { toast('Cole o conteúdo JSON na caixa de texto.', 'alerta'); break; }
      importarTexto(txt);
      break;
    }
    case 'remover-prova': {
      const id = alvo.dataset.id;
      const ok = await modal({ titulo: 'Remover prova importada?', html: `<p>A prova <code>${esc(id)}</code> será removida do banco local.</p>`, botoes: [{ texto: 'Cancelar', valor: false }, { texto: 'Remover', valor: true, classe: 'btn-perigo' }] });
      if (ok) { gravarLS(CHAVES.importadas, lerLS(CHAVES.importadas, []).filter(p => p.id !== id)); renderBancoInfo(); atualizarFormulario(); toast('Prova removida.', 'sucesso'); }
      break;
    }
    case 'remover-importadas': {
      if (!lerLS(CHAVES.importadas, []).length) { toast('Não há provas importadas.', 'info'); break; }
      const ok = await modal({ titulo: 'Remover todas as provas importadas?', html: '<p>O banco padrão será mantido.</p>', botoes: [{ texto: 'Cancelar', valor: false }, { texto: 'Remover todas', valor: true, classe: 'btn-perigo' }] });
      if (ok) { removerLS(CHAVES.importadas); renderBancoInfo(); atualizarFormulario(); toast('Provas importadas removidas.', 'sucesso'); }
      break;
    }
    case 'limpar-historico': {
      const ok = await modal({ titulo: 'Limpar histórico?', html: '<p>O registro de notas anteriores será apagado.</p>', botoes: [{ texto: 'Cancelar', valor: false }, { texto: 'Limpar', valor: true, classe: 'btn-perigo' }] });
      if (ok) { removerLS(CHAVES.historico); renderHistorico(); }
      break;
    }

    /* ---- prova ---- */
    case 'marcar': marcar(n, v); break;
    case 'limpar': limpar(n); break;
    case 'dig': ajustarDigito(n, Number(alvo.dataset.pos), Number(alvo.dataset.d)); break;
    case 'riscar': riscar(n, v); break;
    case 'revisao':
      if (sessao.revisao[n]) delete sessao.revisao[n]; else sessao.revisao[n] = true;
      atualizarItem(n);
      break;
    case 'conferir':
      if (sessao.config.modo !== 'treino') break;
      if (sessao.conferidos[n]) delete sessao.conferidos[n]; else sessao.conferidos[n] = true;
      atualizarItem(n);
      break;
    case 'ir-bloco': sessao.blocoAtual = Number(alvo.dataset.b); renderBloco(); renderMapa(); break;
    case 'bloco-ant': if (sessao.blocoAtual > 0) { sessao.blocoAtual--; renderBloco(); renderMapa(); } break;
    case 'bloco-prox': if (sessao.blocoAtual < sessao.blocos.length - 1) { sessao.blocoAtual++; renderBloco(); renderMapa(); } break;
    case 'abrir-mapa': renderMapa(); abrirMapa(); break;
    case 'fechar-mapa': fecharMapa(); break;
    case 'ir': irParaItem(n); break;
    case 'finalizar': finalizarProva(false); break;
    case 'sair-prova':
      pararTimer(); salvarSessao();
      toast('Prova pausada e salva. O cronômetro foi interrompido.', 'info');
      renderLobby();
      break;
    case 'fonte-mais': aplicarFonte(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-texto')) + 1); break;
    case 'fonte-menos': aplicarFonte(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-texto')) - 1); break;
    case 'toggle-texto': $('#painel-texto').classList.toggle('recolhido'); break;

    /* ---- resultado ---- */
    case 'filtro': filtroRevisao = alvo.dataset.f; renderFiltros(); renderRevisao(); $('#res-revisao').scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    case 'nota-rapida': {
      definirNotaD(n, Number(v));
      const inp = $('#nota-' + n); if (inp) inp.value = v;
      break;
    }
    case 'novo': renderLobby(); break;
    case 'refazer': {
      try { sessao = montarSessao(sessao.config); salvarSessao(); abrirProva(); }
      catch (err) { toast(err.message, 'erro'); }
      break;
    }
    case 'imprimir': $$('#res-revisao details').forEach(d => { d.open = true; }); window.print(); break;
    case 'exportar-resultado':
      baixarJSON({ sessao, resultado: calcularResultado() }, `resultado-simulado-unb-${sessao.id}.json`);
      break;
  }
});

/* Entradas de texto: número (tipo B), discursiva (tipo D), nota de D */
let timeoutSalvar = null;
document.addEventListener('input', e => {
  const el = e.target;

  if (el.classList.contains('num-input')) {
    const n = Number(el.dataset.n);
    const limpo = el.value.replace(/\D/g, '').slice(0, 3);
    if (el.value !== limpo) el.value = limpo;
    if (limpo === '') delete sessao.respostas[n]; else sessao.respostas[n] = Number(limpo);
    // Atualiza visor de dígitos sem re-renderizar (preserva o foco)
    const art = document.getElementById('item-' + n);
    const dig = limpo === '' ? ['–', '–', '–'] : pad3(Number(limpo)).split('');
    $$('.dig-val', art).forEach((s, i) => { s.textContent = dig[i]; s.classList.toggle('vazio', limpo === ''); });
    art.classList.toggle('respondido', limpo !== '');
    $$('.btn-limpar', art).forEach(b => { b.disabled = limpo === ''; });
    aposAlteracao();
    return;
  }

  if (el.classList.contains('folha')) {
    const n = Number(el.dataset.n);
    const item = getItem(n);
    sessao.respostas[n] = el.value;
    if (!el.value.trim()) delete sessao.respostas[n];
    $('#cont-' + n).innerHTML = contadorTexto(el.value, item.maxLinhas || 20);
    const art = document.getElementById('item-' + n);
    art.classList.toggle('respondido', !!el.value.trim());
    $('.btn-limpar', art).disabled = !el.value.trim();
    // Debounce: salva e atualiza mapa sem travar a digitação
    clearTimeout(timeoutSalvar);
    timeoutSalvar = setTimeout(aposAlteracao, 400);
    return;
  }

  if (el.classList.contains('input-nota')) {
    definirNotaD(Number(el.dataset.n), el.value);
  }
});

/* Ao sair do campo numérico, mostra com zeros à esquerda */
document.addEventListener('focusout', e => {
  const el = e.target;
  if (el.classList && el.classList.contains('num-input') && el.value !== '') el.value = pad3(Number(el.value));
});

/* Formulário do lobby e importação de arquivo */
document.addEventListener('change', e => {
  const el = e.target;
  if (el.name === 'tipo' || el.id === 'sel-prova') atualizarFormulario();
  else if (el.name === 'modo' || el.name === 'disc' || el.id === 'sel-duracao' || el.id === 'sel-lingua') atualizarResumoConfig();
  else if (el.id === 'arquivo-json' && el.files.length) lerArquivo(el.files[0], el);
});

function lerArquivo(arquivo, input) {
  const leitor = new FileReader();
  leitor.onload = () => { importarTexto(String(leitor.result)); if (input) input.value = ''; };
  leitor.onerror = () => toast('Não foi possível ler o arquivo.', 'erro');
  leitor.readAsText(arquivo, 'utf-8');
}

/* Arrastar e soltar arquivo JSON */
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => {
  const dz = e.target.closest && e.target.closest('#dropzone');
  if (dz) { e.preventDefault(); dz.classList.add('sobre'); }
}));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => {
  const dz = e.target.closest && e.target.closest('#dropzone');
  if (!dz) return;
  e.preventDefault();
  dz.classList.remove('sobre');
  if (ev === 'drop' && e.dataTransfer.files.length) lerArquivo(e.dataTransfer.files[0]);
}));

/* Fechar mapa com Esc */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#mapa').classList.contains('aberto')) fecharMapa();
});

/* Garante persistência ao fechar/ocultar a página */
window.addEventListener('beforeunload', salvarSessao);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') salvarSessao();
  else if (timerId) tick(); // recupera o tempo decorrido em segundo plano
});
window.addEventListener('resize', ajustarAlturaHeader);

/* =====================================================================
   16. INICIALIZAÇÃO
   ===================================================================== */
function init() {
  const temaSalvo = lerLS(CHAVES.tema, null);
  aplicarTema(temaSalvo || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'));
  aplicarFonte(lerLS(CHAVES.fonte, 18));

  // Restaura a última configuração usada no formulário
  const cfg = lerLS(CHAVES.form, null);
  if (cfg) {
    const rTipo = $(`input[name="tipo"][value="${cfg.tipo}"]`); if (rTipo) rTipo.checked = true;
    const rModo = $(`input[name="modo"][value="${cfg.modo}"]`); if (rModo) rModo.checked = true;
  }
  atualizarFormulario();
  if (cfg) {
    if (cfg.provaId && $(`#sel-prova option[value="${CSS.escape(cfg.provaId)}"]`)) $('#sel-prova').value = cfg.provaId;
    atualizarFormulario();
    if (cfg.lingua && $(`#sel-lingua option[value="${CSS.escape(cfg.lingua)}"]`)) $('#sel-lingua').value = cfg.lingua;
    if (cfg.duracaoSeg && cfg.tipo === 'rapido') $('#sel-duracao').value = String(cfg.duracaoSeg / 60);
    if (cfg.disciplinas) $$('input[name="disc"]').forEach(i => { i.checked = cfg.disciplinas.includes(i.value); });
    atualizarResumoConfig();
  }

  // Restaura a sessão salva
  sessao = lerLS(CHAVES.sessao, null);
  if (sessao && (!Array.isArray(sessao.blocos) || !sessao.blocos.length)) { sessao = null; removerLS(CHAVES.sessao); }
  indexarSessao();

  if (sessao && !sessao.finalizada && sessao.tela === 'prova') {
    abrirProva();
    toast('Progresso restaurado. Você pode continuar de onde parou.', 'sucesso');
  } else if (sessao && sessao.finalizada && sessao.tela === 'resultado') {
    renderResultado();
  } else {
    renderLobby();
  }
}

init();
