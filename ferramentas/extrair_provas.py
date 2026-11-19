#!/usr/bin/env python3
"""
extrair_provas.py — Converte os cadernos oficiais do Vestibular UnB (Cebraspe)
em arquivos de dados do Simulado UnB.

Uso:
    pip install pymupdf
    python3 ferramentas/extrair_provas.py PASTA_DOS_PDFS

A pasta deve conter, para cada ano, os cadernos e gabaritos definitivos com os
nomes  AAAA_pN.pdf  (caderno N) e  AAAA_gN.pdf  (gabarito do caderno N),
como baixados de https://cdn.cebraspe.org.br/vestibulares/VESTUNB_AA/.

Gera:
    provas/unb-AAAA.js      (dados das provas, carregados pelo index.html)
    provas/img/AAAA/*.png   (figuras, gráficos e tabelas recortados do PDF)

Como funciona:
  • Lê cada página por colunas (esquerda e depois direita).
  • O número do item usa fonte menor que o texto e fica na margem da coluna;
    o enunciado vem recuado. Tudo o que não é item é texto-base.
  • Figuras (imagens e desenhos vetoriais) viram PNG recortados da página.
  • O gabarito definitivo define o tipo de cada item: C/E → tipo A,
    número → tipo B, A–D com alternativas → tipo C, "TipoD" → tipo D.
    Itens anulados (X) ficam de fora.
"""
import html
import json
import os
import re
import sys
from collections import defaultdict

import pymupdf as fitz

relatorio_global = []
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL_BASE = {
    2026: 'https://cdn.cebraspe.org.br/vestibulares/VESTUNB_26/',
    2025: 'https://cdn.cebraspe.org.br/vestibulares/VESTUNB_25/',
    2024: 'https://cdn.cebraspe.org.br/vestibulares/VESTUNB_24/',
    2023: 'https://cdn.cebraspe.org.br/vestibulares/VESTUNB_23/',
    2022: 'https://cdn.cebraspe.org.br/vestibulares/VESTUNB_22/',
}
LINGUAS = [('ESPANHOLA', 'espanhol', 'Língua Espanhola'),
           ('FRANCESA', 'frances', 'Língua Francesa'),
           ('INGLESA', 'ingles', 'Língua Inglesa')]

# ----------------------------------------------------------------------------
# Gabarito
# ----------------------------------------------------------------------------

def ler_gabarito(caminho):
    """Retorna lista de 'seções', cada uma um dict {numero: resposta}.
    Uma nova seção começa quando a numeração volta a 1."""
    txt = os.popen(f'pdftotext -layout "{caminho}" -').read()
    linhas = txt.splitlines()
    secoes, atual, ultimo = [], {}, 0
    for i, l in enumerate(linhas):
        m = re.match(r'\s*Item\s+(.*)$', l)
        if not m or i + 1 >= len(linhas):
            continue
        g = re.match(r'\s*Gabarito\s+(.*)$', linhas[i + 1])
        if not g:
            continue
        nums = m.group(1).split()
        resps = re.sub(r'Tipo\s*D', 'TipoD', g.group(1), flags=re.I).split()
        if len(nums) != len(resps):
            raise ValueError(f'{caminho}: linha de gabarito desalinhada: {nums} / {resps}')
        for n, r in zip(nums, resps):
            n = int(n)
            if n == 0:
                continue
            if n <= ultimo and n == 1:
                secoes.append(atual)
                atual = {}
            atual[n] = r
            ultimo = n
    if atual:
        secoes.append(atual)
    return secoes

# ----------------------------------------------------------------------------
# Leitura do caderno
# ----------------------------------------------------------------------------

LIXO = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\ue000-\uf8ff\ufffd]')


def tem_lixo(texto):
    """Fórmulas em fontes sem mapeamento Unicode viram caracteres de controle."""
    return bool(LIXO.search(texto))


def gravar_imagem(pix, pasta, base):
    """Salva o recorte de forma compacta: foto → JPEG; desenho/texto → PNG com paleta."""
    from PIL import Image
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples) if pix.n < 4 else \
        Image.frombytes('RGBA', (pix.width, pix.height), pix.samples).convert('RGB')
    cores = img.getcolors(maxcolors=4096)
    if cores is None:  # muitas cores: fotografia
        nome = base + '.jpg'
        img.save(os.path.join(pasta, nome), 'JPEG', quality=78, optimize=True, progressive=True)
    else:
        nome = base + '.png'
        img.quantize(colors=min(64, max(2, len(cores))), method=Image.Quantize.MEDIANCUT) \
           .save(os.path.join(pasta, nome), 'PNG', optimize=True)
    return nome


def eh_italico(span):
    return bool(span['flags'] & 2) or 'Italic' in span['font'] or 'Oblique' in span['font']


def eh_negrito(span):
    return bool(span['flags'] & 16) or 'Bold' in span['font']


def spans_para_html(spans, tamanho_base):
    """Converte spans de uma linha em HTML, marcando itálico, negrito,
    sobrescrito e subscrito (fonte menor deslocada)."""
    partes = []
    base_y = max((s['origin'][1] for s in spans if s['size'] >= tamanho_base - 0.6), default=None)
    for s in spans:
        t = html.escape(s['text'])
        if not t:
            continue
        if base_y is not None and s['size'] < tamanho_base * 0.85 and t.strip():
            if s['origin'][1] < base_y - 1:
                t = f'<sup>{t}</sup>'
            elif s['origin'][1] > base_y + 0.5:
                t = f'<sub>{t}</sub>'
        if eh_italico(s) and t.strip():
            t = f'<em>{t}</em>'
        partes.append(t)
    h = ''.join(partes)
    h = re.sub(r'</em>(\s*)<em>', r'\1', h)
    h = re.sub(r'</sub><sub>', '', h)
    h = re.sub(r'</sup><sup>', '', h)
    return h


def agrupar_retangulos(rects, folga=6):
    """Une retângulos que se tocam (com folga)."""
    grupos = [fitz.Rect(r) for r in rects]
    mudou = True
    while mudou:
        mudou = False
        novos = []
        while grupos:
            r = grupos.pop()
            exp = fitz.Rect(r.x0 - folga, r.y0 - folga, r.x1 + folga, r.y1 + folga)
            i = 0
            while i < len(grupos):
                if exp.intersects(grupos[i]):
                    r |= grupos.pop(i)
                    exp = fitz.Rect(r.x0 - folga, r.y0 - folga, r.x1 + folga, r.y1 + folga)
                    mudou = True
                else:
                    i += 1
            novos.append(r)
        grupos = novos
    return grupos


def elementos_da_pagina(pagina, num_pagina):
    """Lista de elementos em ordem de leitura: ('linha', dados) e ('figura', rect)."""
    W, H = pagina.rect.width, pagina.rect.height
    meio = W / 2
    dic = pagina.get_text('dict')

    # --- regiões de figura: imagens + desenhos vetoriais ---
    rects = []
    for b in dic['blocks']:
        if b['type'] == 1:
            r = fitz.Rect(b['bbox'])
            if r.width > 8 and r.height > 8:
                rects.append(r)
    for d in pagina.get_drawings():
        r = d['rect']
        if r.y1 < 48 or r.y0 > H - 20:            # cabeçalho/rodapé
            continue
        if r.height > H * 0.6 or r.width > W * 0.8:  # moldura e divisória de colunas
            continue
        if r.width < 1 and r.height < 1:
            continue
        # Retângulos brancos sem contorno são invisíveis (fundo de texto)
        fill = d.get('fill')
        if d.get('color') is None and fill is not None and min(fill) > 0.97:
            continue
        rects.append(fitz.Rect(r))
    # Divide desenhos que atravessam o meio da página apenas se forem estreitos
    figuras = []
    for g in agrupar_retangulos(rects):
        if g.width < 30 or g.height < 18:
            continue
        figuras.append(g)

    # --- linhas de texto ---
    linhas = []
    for b in dic['blocks']:
        if b['type'] != 0:
            continue
        for l in b['lines']:
            spans = [s for s in l['spans'] if s['text'] != '']
            texto = ''.join(s['text'] for s in spans)
            if not texto.strip():
                continue
            x0, y0, x1, y1 = l['bbox']
            if y1 < 46 and 'CEBRASPE' in texto or y0 > H - 22:
                continue
            if 'CEBRASPE' in texto and y0 < 60:
                continue
            if re.fullmatch(r'\s*\d{6}_\d{2}N\d+\s*', texto):   # código de controle do caderno
                continue
            if re.fullmatch(r'\s*(Espaço livre|RASCUNHO|Rascunho)\s*', texto):
                continue
            if re.match(r'^\s*--\s*PROVA DE CONHECIMENTOS', texto) or re.search(r'PROVA DE CONHECIMENTOS [IV]+\s*--', texto):
                continue
            linhas.append({'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'spans': spans,
                           'texto': texto, 'pagina': num_pagina})

    # Junta pedaços da mesma linha (texto justificado sai palavra por palavra)
    linhas.sort(key=lambda l: (0 if (l['x0'] + l['x1']) / 2 < meio else 1, round(l['y1'] * 2) / 2, l['x0']))
    unidas = []
    for l in linhas:
        lcol = 0 if (l['x0'] + l['x1']) / 2 < meio else 1
        if unidas:
            u = unidas[-1]
            ucol = 0 if (u['x0'] + u['x1']) / 2 < meio else 1
            if ucol == lcol and abs(u['y1'] - l['y1']) < 2.2 and 0 <= l['x0'] - u['x1'] < 40:
                espaco = [] if u['texto'].endswith(' ') or l['texto'].startswith(' ') else \
                    [dict(l['spans'][0], text=' ', size=u['spans'][-1]['size'], origin=u['spans'][-1]['origin'], flags=0)]
                u['spans'] = u['spans'] + espaco + l['spans']
                u['texto'] = ''.join(sp['text'] for sp in u['spans'])
                u['x1'] = max(u['x1'], l['x1']); u['y0'] = min(u['y0'], l['y0'])
                continue
        unidas.append(l)
    linhas = unidas

    # Linhas dentro de figuras pertencem à figura (rótulos, tabelas)
    def dentro(l, f):
        cx, cy = (l['x0'] + l['x1']) / 2, (l['y0'] + l['y1']) / 2
        return f.x0 - 2 <= cx <= f.x1 + 2 and f.y0 - 2 <= cy <= f.y1 + 2

    TITULO = re.compile(r'^\s*(L[ÍI]NGUA (ESPANHOLA|FRANCESA|INGLESA)|-*\s*PROVA DE CONHECIMENTOS)', re.I)
    figuras_validas = []
    for f in figuras:
        internas = [l for l in linhas if dentro(l, f)]
        if internas and all(TITULO.match(l['texto']) for l in internas):
            continue
        internas = [l for l in internas if not TITULO.match(l['texto'])]
        # Espaço de resposta de item D (linhas numeradas 1..30): descarta
        nums = [l for l in internas if re.fullmatch(r'\s*\d{1,2}\s*', l['texto'])]
        if len(nums) >= 5 and len(nums) >= len(internas) * 0.6:
            for l in internas:
                l['descartar'] = True
            continue
        # Caixa que envolve só texto corrido (moldura de texto): mantém o texto
        texto_interno = sum(len(l['texto']) for l in internas)
        tem_imagem = any(b['type'] == 1 and fitz.Rect(b['bbox']).intersects(f) for b in dic['blocks'])
        if not tem_imagem and texto_interno > 0 and len(internas) >= 3 and f.width > 150:
            # caixa ou tabela? se houver muitos desenhos internos (linhas de tabela), vira figura
            n_des = sum(1 for d in pagina.get_drawings() if f.contains(d['rect'])
                        and not (d.get('color') is None and d.get('fill') is not None and min(d['fill']) > 0.97))
            if n_des <= 2:
                continue
        for l in internas:
            l['descartar'] = True
        f.letras = {l['texto'].strip() for l in internas if re.fullmatch(r'\s*[ABCD]\s*', l['texto'])}
        figuras_validas.append(f)

    # Faixa de largura total (ex.: partitura com itens embaixo): lida depois das colunas
    largas = [l for l in linhas if not l.get('descartar') and l['x0'] < meio - 40 and l['x1'] > meio + 40 and l['x1'] - l['x0'] > 300]
    y_faixa = min((l['y0'] for l in largas), default=None) if len(largas) >= 2 else None
    if y_faixa is not None:
        figs_largas = [f for f in figuras_validas if f.x0 < meio - 40 and f.x1 > meio + 40 and f.y1 <= y_faixa + 5]
        # a figura larga logo acima dos itens largos também pertence à faixa
        for f in figs_largas:
            if y_faixa - f.y1 < 60:
                y_faixa = min(y_faixa, f.y0)

    def chave(col, y):
        if y_faixa is not None and y >= y_faixa - 1:
            return (1, 0, y)
        return (0, col, y)

    elementos = []
    for l in linhas:
        if l.get('descartar'):
            continue
        col = 0 if (l['x0'] + l['x1']) / 2 < meio else 1
        if l['x0'] < meio - 40 and l['x1'] > meio + 40:
            col = 0 if l['x0'] < meio else 1
        k = chave(col, l['y0'])
        elementos.append((k, 0 if k[0] else col, 'linha', l))
    for f in figuras_validas:
        col = 0 if (f.x0 + f.x1) / 2 < meio else 1
        if f.x0 < meio - 40 and f.x1 > meio + 40:
            col = 0
        k = chave(col, f.y0)
        elementos.append((k, 0 if k[0] else col, 'figura', {'rect': f, 'pagina': num_pagina, 'x0': f.x0,
                                                            'letras': getattr(f, 'letras', set())}))
    elementos.sort(key=lambda e: e[0])
    elementos = [(e[1], None, e[2], e[3]) for e in elementos]
    return [(e[2], e[3], e[0]) for e in elementos]

# ----------------------------------------------------------------------------
# Segmentação em blocos (texto-base + itens)
# ----------------------------------------------------------------------------

def segmentar(pdf_path, ano, parte, pasta_img, prefixo_img):
    doc = fitz.open(pdf_path)
    elementos = []
    for i, pg in enumerate(doc):
        for tipo, dado, col in elementos_da_pagina(pg, i):
            elementos.append((tipo, dado, col, i))

    # Tamanho de fonte do texto corrido (o mais frequente)
    contagem = defaultdict(int)
    for tipo, d, _, _ in elementos:
        if tipo == 'linha':
            for s in d['spans']:
                contagem[round(s['size'])] += len(s['text'])
    corpo = max(contagem, key=contagem.get) if contagem else 10

    secoes = []          # cada seção: {'lingua':..., 'blocos': [...]}
    secao = {'lingua': None, 'blocos': []}
    bloco = None
    item = None
    esperado = 1
    n_fig = 0
    col_x = {}

    def novo_bloco():
        nonlocal bloco
        bloco = {'texto': [], 'itens': [], 'paginas': set()}
        secao['blocos'].append(bloco)

    # Margem esquerda de cada coluna em cada página
    # (posição mais frequente do início das linhas em cada coluna, no caderno todo)
    freq = {0: defaultdict(int), 1: defaultdict(int)}
    for tipo, d, col, pg in elementos:
        if tipo == 'linha':
            freq[col][round(d['x0'])] += 1
    # Margem = menor posição entre as frequentes (a mais frequente pode ser o recuo dos itens)
    margem_col = {}
    for c in freq:
        if not freq[c]:
            margem_col[c] = 0
            continue
        topo = max(freq[c].values())
        margem_col[c] = min(x for x, n in freq[c].items() if n >= topo * 0.15)
    margem = defaultdict(lambda: None)
    for pg in range(len(doc)):
        for c in (0, 1):
            margem[(pg, c)] = margem_col[c]

    def eh_numero_item(l, col=None, pg=None):
        s0 = l['spans'][0]
        m = re.match(r'^\s*(\d{1,3})\b', s0['text'])
        if not m:
            return None
        # número do item: fonte um pouco menor que o corpo (verso numerado usa fonte bem menor)
        if not (corpo - 1.8 <= s0['size'] <= corpo - 0.4):
            return None
        if col is not None and abs(l['x0'] - margem.get((pg, col), l['x0'])) > 6:
            return None
        return int(m.group(1))

    def salvar_figura(dado):
        nonlocal n_fig
        n_fig += 1
        pg = doc[dado['pagina']]
        r = fitz.Rect(dado['rect'])
        r = fitz.Rect(r.x0 - 3, r.y0 - 3, r.x1 + 3, r.y1 + 3) & pg.rect
        pix = pg.get_pixmap(clip=r, dpi=160)
        nome = gravar_imagem(pix, pasta_img, f'{prefixo_img}-{n_fig:03d}')
        return nome, round(r.width), round(r.height)

    def eh_continuacao(l, it):
        """A linha l continua o item it? (recuo do item; recuo de parágrafo só no meio de frase)"""
        if it is None or l['x0'] <= it['x_num'] + 8 or l['x0'] - it['x_num'] >= 60:
            return False
        xt = it['x_texto'] or it['x_num'] + 18
        if abs(l['x0'] - xt) <= 4:
            return True
        if l['x0'] < xt - 4:
            return False
        # recuo de primeira linha de parágrafo do texto-base (≈ margem + 29)
        ultima = next((x for x in reversed(it['linhas']) if x.get('texto')), None)
        depois_de_figura = bool(it['linhas']) and it['linhas'][-1].get('texto') == ''
        if abs(l['x0'] - (it['x_num'] + 29)) <= 2.5 and (
                ultima is None or depois_de_figura or re.search(r'[.?!:)]\s*$', ultima['texto'])
                or re.fullmatch(r'\s*[ABCD]\s*', ultima['texto'])):
            return False
        return True

    def salvar_recorte(pg_idx, bbox):
        nonlocal n_fig
        n_fig += 1
        pgp = doc[pg_idx]
        r = fitz.Rect(bbox[0] - 2, bbox[1] - 0.5, bbox[2] + 2, bbox[3] + 0.5) & pgp.rect
        nome = gravar_imagem(pgp.get_pixmap(clip=r, dpi=170), pasta_img, f'{prefixo_img}-{n_fig:03d}')
        return nome, round(r.width), round(r.height)

    # A numeração pode não começar em 1 (ex.: Parte II de 2026 começa no item 21)
    for tipo, d, col, pg in elementos:
        if tipo == 'linha':
            n0 = eh_numero_item(d, col, pg)
            if n0 is not None and not re.fullmatch(r'L[ÍI]NGUA.*', d['texto'].strip()):
                esperado = n0
                break

    novo_bloco()
    for idx, (tipo, d, col, pg) in enumerate(elementos):
        if tipo == 'linha':
            texto = d['texto'].strip()
            # Cabeçalho de língua estrangeira: inicia nova seção
            mL = re.fullmatch(r'L[ÍI]NGUA (ESPANHOLA|FRANCESA|INGLESA)', texto)
            if mL:
                if secao['blocos'] and any(b['itens'] for b in secao['blocos']):
                    secoes.append(secao)
                    secao = {'lingua': None, 'blocos': []}
                    novo_bloco()
                secao['lingua'] = mL.group(1)
                esperado = 1
                item = None
                continue
            if re.fullmatch(r'PROVA DE CONHECIMENTOS [IV]+', texto) or texto in ('--', '-'):
                continue
            n = eh_numero_item(d, col, pg)
            # Seção nova sem cabeçalho (numeração recomeça em 1)
            if n == 1 and esperado > 5:
                secoes.append(secao)
                secao = {'lingua': None, 'blocos': []}
                novo_bloco()
                esperado = 1
            if n is not None and esperado < n <= esperado + 2:
                relatorio_global.append(f'    aviso: {os.path.basename(pdf_path)} pág. {pg + 1}: item {esperado} não localizado, seguindo do {n}')
                esperado = n
            if n is not None and n == esperado:
                if bloco is None or (item is None and bloco['itens'] and bloco['texto']):
                    pass
                resto = d['spans'][0]['text']
                resto = re.sub(r'^\s*\d{1,3}\s*', '', resto, count=1)
                spans = ([dict(d['spans'][0], text=resto)] if resto else []) + d['spans'][1:]
                item = {'numero': n, 'linhas': [], 'x_texto': None, 'x_num': d['x0'], 'figuras': [], 'pagina': pg, 'letras': set()}
                spans = [sp for sp in spans if sp['text'].strip()] and spans[next(i for i, sp in enumerate(spans) if sp['text'].strip()):]
                if spans:
                    item['linhas'].append({'html': spans_para_html(spans, corpo), 'x0': spans[0]['bbox'][0], 'texto': ''.join(s['text'] for s in spans),
                                           'bbox': (spans[0]['bbox'][0], d['y0'], d['x1'], d['y1']), 'pg': pg})
                    item['x_texto'] = spans[0]['bbox'][0]
                # Item novo depois de texto-base novo: o bloco atual já é o certo.
                bloco['itens'].append(item)
                bloco['paginas'].add(pg)
                esperado += 1
                continue
            # Continuação do item atual: linha recuada em relação ao número
            letra_solta = re.fullmatch(r'\s*([ABCD])\s*', d['texto'])
            if item is not None and letra_solta and abs(d['x0'] - item['x_num']) < 280 and d['x0'] > item['x_num'] + 8:
                item['letras'].add(letra_solta.group(1))
                item['linhas'].append({'html': html.escape(texto), 'x0': d['x0'], 'texto': texto,
                                       'bbox': (d['x0'], d['y0'], d['x1'], d['y1']), 'pg': pg})
                continue
            if eh_continuacao(d, item):
                ml = re.match(r'^\s*([ABCD])\s', d['texto'])
                if ml:
                    item['letras'].add(ml.group(1))
                if item['x_texto'] is None:
                    item['x_texto'] = d['x0']
                item['linhas'].append({'html': spans_para_html(d['spans'], corpo), 'x0': d['x0'], 'texto': texto,
                                       'bbox': (d['x0'], d['y0'], d['x1'], d['y1']), 'pg': pg})
                continue
            # Caso contrário: texto-base. Se havia itens no bloco, começa outro bloco.
            if bloco['itens']:
                novo_bloco()
            item = None
            html_linha = spans_para_html(d['spans'], corpo)
            tam = max(s['size'] for s in d['spans'])
            if tem_lixo(d['texto']):
                nome, w, h = salvar_recorte(pg, (d['x0'], d['y0'], d['x1'], d['y1']))
                html_linha = f'<img class="formula" src="provas/img/{ano}/{nome}" alt="fórmula (ver prova original)" style="height:{max(1.0, h / 11):.2f}em">'
                tam = corpo
            bloco['texto'].append({'tipo': 'linha', 'html': html_linha, 'x1': d['x1'], 'pg': pg,
                                   'x0': d['x0'], 'col': col, 'tam': tam,
                                   'negrito': all(eh_negrito(s) for s in d['spans'] if s['text'].strip()),
                                   'texto': texto, 'y0': d['y0'], 'y1': d['y1']})
            bloco['paginas'].add(pg)
        else:  # figura
            # Pertence ao item se a próxima linha é continuação recuada do mesmo item
            prox = next((e for e in elementos[idx + 1: idx + 4] if e[0] == 'linha'), None)
            anexar_item = False
            texto_item = ' '.join(l['texto'] for l in item['linhas']) if item else ''
            if item is not None and re.search(r'Assinale|opção|alternativa|Señale|Choose|Choisissez', texto_item) \
                    and len(item['letras']) < 4:
                # Próximo elemento: outra figura (ainda são alternativas) ou linha?
                seguinte = elementos[idx + 1] if idx + 1 < len(elementos) else None
                linha_seg = next((e for e in elementos[idx + 1:] if e[0] == 'linha'), None)
                texto_base_depois = False
                if linha_seg is not None and (seguinte is None or seguinte[0] == 'linha'):
                    ls = linha_seg[1]
                    texto_base_depois = (eh_numero_item(ls, linha_seg[2], linha_seg[3]) is None
                                         and not re.fullmatch(r'\s*[ABCD]\s*', ls['texto'])
                                         and len(ls['texto'].strip()) > 3
                                         and abs(ls['x0'] - (item['x_texto'] or item['x_num'] + 18)) > 4
                                         and not re.match(r'^\s*[ABCD]\s', ls['texto']))
                if d.get('letras') or not texto_base_depois:
                    anexar_item = True
                    item['letras'] |= d.get('letras', set())
            elif item is not None and d['x0'] > item['x_num'] + 8 and prox is not None:
                pl = prox[1]
                if eh_numero_item(pl, prox[2], prox[3]) is None and eh_continuacao(pl, item):
                    anexar_item = True
            nome, w, h = salvar_figura(d)
            if anexar_item:
                item['figuras'].append((nome, w, h))
                item['linhas'].append({'html': f'@@FIG:{nome}:{w}:{h}@@', 'x0': d['x0'], 'texto': '',
                                       'bbox': tuple(d['rect']), 'pg': d['pagina']})
            else:
                if bloco['itens']:
                    novo_bloco()
                item = None
                bloco['texto'].append({'tipo': 'figura', 'nome': nome, 'w': w, 'h': h})
                bloco['paginas'].add(pg)
    secoes.append(secao)

    # Itens com fórmulas em fontes especiais, ou com alternativas em figura:
    # recorta o item inteiro como imagem (preserva letras e diagramação)
    def alternativas_em_texto(it):
        letras = [re.match(r'^\s*([ABCD])(\s|$)', l['texto']) for l in it['linhas']]
        return [m.group(1) for m in letras if m] == ['A', 'B', 'C', 'D']

    for sec in secoes:
        for b in sec['blocos']:
            for it in b['itens']:
                com_formula = any(tem_lixo(l['texto']) for l in it['linhas'])
                alt_figura = bool(it['figuras']) and not alternativas_em_texto(it) and \
                    re.search(r'Assinale|opção|Señale|Choose|Choisissez', ' '.join(l['texto'] for l in it['linhas']))
                if not (com_formula or alt_figura):
                    continue
                # remove figuras já salvas deste item (serão parte do recorte)
                for nome, _, _ in it['figuras']:
                    try:
                        os.remove(os.path.join(pasta_img, nome))
                    except OSError:
                        pass
                it['figuras'] = []
                x_ini = (it['x_texto'] or it['x_num'] + 16) - 2
                grupos = {}
                for l in it['linhas']:
                    if 'bbox' not in l:
                        continue
                    chave_g = (l['pg'], 0 if (l['bbox'][0] + l['bbox'][2]) / 2 < doc[l['pg']].rect.width / 2 else 1)
                    r = fitz.Rect(l['bbox'])
                    if r.x1 - x_ini < 4:
                        continue
                    r.x0 = max(r.x0, x_ini)
                    grupos[chave_g] = grupos[chave_g] | r if chave_g in grupos else r
                novas = []
                for (pgi, _), r in sorted(grupos.items()):
                    nome, w, h = salvar_recorte(pgi, (r.x0, r.y0, r.x1, r.y1))
                    novas.append({'html': f'@@FIG:{nome}:{w}:{h}@@', 'x0': r.x0, 'texto': ''})
                    it['figuras'].append((nome, w, h))
                it['linhas'] = novas
                it['recortado'] = True
    return secoes

# ----------------------------------------------------------------------------
# Montagem do HTML
# ----------------------------------------------------------------------------

def img_html(nome, w, h, ano):
    largura = min(100, round(w / 2.6))  # aprox. % da coluna
    return (f'<figure class="fig-prova"><img src="provas/img/{ano}/{nome}" alt="Figura da prova original" '
            f'loading="lazy" style="width:{max(largura, 35)}%"></figure>')


def texto_para_html(partes, ano):
    """Junta linhas em parágrafos. Novo parágrafo quando a linha começa recuada,
    quando a anterior é curta (fim de parágrafo) ou quando muda o estilo."""
    saida = []
    par = []
    curtas = 0
    estilo = None
    ultima = None
    col_min = {}
    col_dir = {}
    passos = []
    ant = None
    for p in partes:
        if p['tipo'] == 'linha':
            col_min[p['col']] = min(col_min.get(p['col'], 9999), p['x0'])
            col_dir[p['col']] = max(col_dir.get(p['col'], 0), p['x1'])
            if ant is not None and ant.get('pg') == p.get('pg') and ant['col'] == p['col'] and 0 < p['y0'] - ant['y0'] < 30:
                passos.append(p['y0'] - ant['y0'])
            ant = p
    pitch = sorted(passos)[len(passos) // 2] if passos else 12

    def fechar():
        nonlocal par, curtas
        if par:
            # Versos: maioria das linhas curtas → mantém as quebras de linha
            if len(par) >= 3 and curtas >= len(par) * 0.6:
                conteudo = '<br>'.join(par)
            else:
                conteudo = ' '.join(par)
            curtas = 0
            conteudo = re.sub(r'(\w)- (\w)', r'\1\2', conteudo)  # hifenização de quebra
            if estilo == 'fonte':
                saida.append(f'<p class="fonte">{conteudo}</p>')
            elif estilo == 'titulo':
                saida.append(f'<p class="titulo-texto"><strong>{conteudo}</strong></p>')
            elif estilo == 'instrucao':
                saida.append(f'<p class="instrucao-item">{conteudo}</p>')
            else:
                saida.append(f'<p>{conteudo}</p>')
            par = []

    for p in partes:
        if p['tipo'] == 'figura':
            fechar()
            estilo = None
            saida.append(img_html(p['nome'], p['w'], p['h'], ano))
            ultima = None
            continue
        t = p['texto']
        if p['tam'] <= 7.5:
            e = 'fonte'
        elif re.match(r'^(A partir|Com base|Considerando|Tendo em vista|Julgue|Acerca|Em relação|No que se refere|Com relação|À partir|À la lumière|Jugez|Based on|Judge|In relation|According|Considering|Taking|Regarding|A la luz|Juzgue|Con base|De acuerdo|Según|En relación|Teniendo)', t) \
                and re.search(r'(julgue|juzgue|jugez|judge|item|ítem|assinale|marque|faça o que se pede|seguinte|siguiente|suivant|following)', t, re.I) \
                and estilo != 'normal':
            e = 'instrucao'
        elif p['negrito'] and len(t) < 90:
            e = 'titulo'
        else:
            e = 'normal'
        if ultima is not None and ultima.get('pg') == p.get('pg') and ultima['col'] == p['col']:
            passo = p['y0'] - ultima['y0']
            fim_frase = bool(re.search(r'[.:;!?”»"\)]\s*$', ultima['texto'])) or ultima['x1'] < col_dir.get(p['col'], 9999) - 25
            novo_par = (p['x0'] > ultima['x0'] + 8 and fim_frase) or passo > pitch * 1.55 or passo < 0
        else:
            novo_par = ultima is not None and bool(re.search(r'[.:;!?”»"\)]\s*$', ultima['texto']))
        novo = e != estilo or ultima is None or (e in ('normal', 'instrucao', 'titulo') and novo_par)
        if novo:
            fechar()
        estilo = e
        par.append(p['html'].strip())
        if p['x1'] < col_dir.get(p['col'], 9999) - 45 and not re.search(r'[.!?]\s*$', p['texto']) or len(p['texto']) < 38:
            curtas += 1
        ultima = p
    fechar()
    return '\n'.join(saida)


def montar_item(item, gabarito, ano):
    """Retorna dict do item no formato do simulado, ou None se anulado/ausente."""
    g = gabarito.get(item['numero'])
    if g is None or g.upper() == 'X':
        return None
    linhas = item['linhas']
    # Separa alternativas A–D (linhas começando por "A " etc. no recuo do texto)
    alternativas = []
    enunciado = []
    for l in linhas:
        m = re.match(r'^\s*([ABCD])\s+(.*)$', l['texto'])
        if m and (not alternativas and m.group(1) == 'A' or alternativas and ord(m.group(1)) == ord('A') + len(alternativas)):
            corpo = re.sub(r'^\s*(<em>)?\s*[ABCD]\s*(</em>)?\s+', '', l['html'], count=1)
            alternativas.append([corpo])
        elif alternativas:
            alternativas[-1].append(l['html'])
        else:
            enunciado.append(l['html'])

    def juntar(partes):
        txt = ' '.join(p.strip() for p in partes)
        txt = re.sub(r'(\w)- (\w)', r'\1\2', txt)
        txt = re.sub(r'@@FIG:([^:]+):(\d+):(\d+)@@', lambda m: img_html(m.group(1), int(m.group(2)), int(m.group(3)), ano), txt)
        return txt.strip()

    base = {'numeroOriginal': item['numero'], 'enunciado': juntar(enunciado)}
    if item.get('recortado'):
        base['enunciado'] = juntar([l['html'] for l in linhas])
        alternativas = []
    if g == 'TipoD':
        return {**base, 'tipo': 'D', 'maxLinhas': 30,
                'espelho': '<p>A banca não divulga o padrão de resposta junto com o gabarito. '
                           'Avalie com base no comando do item: atendimento a todos os aspectos pedidos, '
                           'correção conceitual, coerência e uso da norma-padrão (até 30 linhas).</p>'}
    if re.fullmatch(r'\d{1,3}', g):
        return {**base, 'tipo': 'B', 'gabarito': int(g)}
    if g in ('A', 'B', 'D') or (g == 'C' and len(alternativas) == 4):
        if len(alternativas) != 4:
            if item['figuras']:
                # Alternativas são gráficos/figuras: o enunciado (com a figura) traz as opções
                base['enunciado'] = juntar([l['html'] for l in linhas])
                return {**base, 'tipo': 'C', 'gabarito': g,
                        'alternativas': [f'Alternativa {x} (veja no enunciado)' for x in 'ABCD']}
            return {**base, 'tipo': 'ERRO', 'gabarito': g}
        return {**base, 'tipo': 'C', 'alternativas': [juntar(a) for a in alternativas], 'gabarito': g}
    if g in ('C', 'E'):
        return {**base, 'tipo': 'A', 'gabarito': g}
    return {**base, 'tipo': 'ERRO', 'gabarito': g}

# ----------------------------------------------------------------------------
# Classificação aproximada de disciplina (para o simulado rápido)
# ----------------------------------------------------------------------------

PALAVRAS = {
    'Matemática': r'\b(função|funções|matriz|polinômio|probabilidade|equação|logaritmo|progressão|triângulo|ângulo|área|volume|seno|cosseno|plano cartesiano|números reais|inteiro positivo|gráfico da função|f\(x\)|média aritmética|mediana|conjunto)\b',
    'Física': r'\b(velocidade|aceleração|força|energia cinética|energia potencial|potencial elétric|campo elétrico|campo magnético|corrente elétrica|carga elétrica|elétrico|magnético|onda|ondas|frequência|newton|joule|watt|lente|refração|reflexão|calor|pressão|movimento|gravitacional|resistor|tensão elétrica|circuito|óptic|Doppler|luz|fóton|trajetória|cinemática|termodinâmic|potência|elétrons? (?:acelerad|que atravessam)|tubo de raios)\b',
    'Química': r'\b(mol|mols|molar|reação química|reações|ligação química|ligações|ácido|ácidos|básic|pH|oxidação|redução|isômero|orgânic|solução aquosa|concentração|equilíbrio químico|entalpia|elemento químico|tabela periódica|íons?|cátion|ânion|composto|compostos|molécula|moléculas|estequiometr|eletrólise|polímero|hidrocarboneto|massa molar|valência)\b',
    'Biologia': r'\b(célula|DNA|RNA|gene|proteína|enzima|espécie|evolução|ecossistema|organismo|bactéria|vírus|fotossíntese|mitocôndria|hormônio|tecido|fungo|vegetal|animais|cromossomo|sistema imune)\b',
    'História': r'\b(século|império|colonial|república|ditadura|revolução|escravidão|escravizad|guerra|monarquia|Idade Média|feudal|período|Vargas|independência|antiguidade)\b',
    'Geografia': r'\b(território|urbano|urbanização|clima|relevo|bioma|população|migração|geopolítica|cartograf|globalização|agronegócio|bacia hidrográfica|região|regional)\b',
    'Filosofia e Sociologia': r'\b(filósof|filosofia|ética|moral|razão|Platão|Aristóteles|Kant|Marx|Weber|Durkheim|sociedade|sociológic|Foucault|Nietzsche|Descartes|política)\b',
    'Língua Portuguesa e Literatura': r'\b(oração|vírgula|verbo|pronome|sujeito|coesão|coerência|gramatical|sintátic|semântic|morfológic|conjunção|preposição|concordância|regência|crase|figura de linguagem|metáfora|ironia|eu lírico|estrofe|rima|soneto|modernista|romantismo|realismo|barroco|arcadismo|romance|poema|narrador|literatura|literári|personagem|verso|crônica|substantivo|adjetivo)\b',
    'Música': r'\b(música|musical|musicais|compositor|compositora|canção|canções|melodia|harmonia|ritmo|partitura|compasso|compassos|sustenido|bemol|bequadro|tonalidade|acorde|acordes|instrumento|instrumentos|orquestra|sinfonia|samba|choro|MPB|cantor|cantora|nota musical|notas musicais|timbre|andamento|ópera)\b',
    'Artes': r'\b(teatro|teatral|teatrais|cênic|atriz|dramaturg|encenação|encenad|espetáculo teatral|palco|plateia|peça teatral|peças teatrais|dança|dançarin|coreograf|circo|circense|figurino|diretor teatral|Stanislavski|Brecht|Augusto Boal|pintura|pintor|pintora|escultura|escultor|gravura|fotografia|fotógraf|obra de arte|obras de arte|artista plástic|artes visuais|arte visual|tela|quadro|instalação artística|museu|exposição|Tarsila|Portinari|modernismo|cubismo|impressionismo|abstracionismo|Bienal|grafite|arquitetura|Niemeyer|óleo sobre tela|acrílica sobre|técnica mista|Foto de|ocupação artística|desenho|ilustração|charge|pintou|retrato|autorretrato|perspectiva|composição visual|vanguarda|arte|artes|artista|artístic|estética)\b',
}


DISCIPLINAS_POR_PARTE = {
    'II': ['Língua Portuguesa e Literatura', 'História', 'Geografia', 'Filosofia e Sociologia', 'Artes', 'Música'],
    'III': ['Física', 'Química', 'Biologia', 'Matemática'],
}
PADRAO_POR_PARTE = {'II': 'Língua Portuguesa e Literatura', 'III': 'Biologia'}


def classificar(texto, parte='II'):
    """Escolhe a disciplina com mais termos característicos, entre as da parte da prova."""
    candidatas = DISCIPLINAS_POR_PARTE.get(parte, list(PALAVRAS))
    pontos = {d: len(re.findall(PALAVRAS[d], texto, re.I)) for d in candidatas}
    melhor = max(candidatas, key=lambda d: pontos[d])
    return melhor if pontos[melhor] > 0 else PADRAO_POR_PARTE.get(parte, candidatas[0])


# ----------------------------------------------------------------------------
# Principal
# ----------------------------------------------------------------------------

# (ano, parte, número): alternativas em figura que a extração automática não recorta
# corretamente. Ficam de fora do simulado (consulte o caderno original).
ITENS_EXCLUIDOS = {
    (2023, 'III', 22): 'alternativas em figura (béqueres) sem as letras',
    (2023, 'III', 88): 'alternativas em figura (circuitos) não recortadas',
    (2024, 'III', 42): 'alternativas em figura (gráficos) incompletas',
    (2025, 'III', 109): 'alternativas em fórmula recortadas só em parte',
    (2026, 'III', 53): 'enunciado e alternativas em figura incompletos',
}

AREA = {'I': 'Língua Estrangeira', 'II': 'Linguagens e Ciências Humanas', 'III': 'Ciências da Natureza e Matemática'}


def processar_ano(pasta, ano, relatorio):
    cadernos = sorted(f for f in os.listdir(pasta) if re.fullmatch(rf'{ano}_p\d\.pdf', f))
    pasta_img = os.path.join(RAIZ, 'provas', 'img', str(ano))
    os.makedirs(pasta_img, exist_ok=True)
    for f in os.listdir(pasta_img):
        os.remove(os.path.join(pasta_img, f))

    # Ordem das partes do vestibular: I (línguas), II (1º dia), III (2º dia)
    partes = []   # (nome_parte, secao, gabarito)
    for cad in cadernos:
        k = cad[len(f'{ano}_p'):-4]
        secoes = segmentar(os.path.join(pasta, cad), ano, k, pasta_img, f'c{k}')
        gabs = ler_gabarito(os.path.join(pasta, f'{ano}_g{k}.pdf'))
        texto_caderno = fitz.open(os.path.join(pasta, cad))[0].get_text()[:4000]
        romanos = re.findall(r'PROVA DE CONHECIMENTOS (I{1,3})\b', texto_caderno)
        # Seções com língua: parte I. Seções restantes: parte seguinte.
        sec_ling = [s for s in secoes if s['lingua']]
        sec_out = [s for s in secoes if not s['lingua'] and any(b['itens'] for b in s['blocos'])]
        gi = 0
        for s in sec_ling:
            partes.append(('I', s, gabs[gi] if gi < len(gabs) else {}))
            gi += 1
        for s in sec_out:
            if romanos and 'II' in romanos and not sec_ling:
                nome = romanos[0]
            elif sec_ling:
                nome = 'II'
            else:
                nome = romanos[0] if romanos else 'III'
            partes.append((nome, s, gabs[gi] if gi < len(gabs) else {}))
            gi += 1
        relatorio.append(f'{ano} caderno {k}: {len(secoes)} seções, {len(gabs)} gabaritos, partes {romanos}')

    provas = {1: [], 2: []}
    for nome, secao, gab in partes:
        dia = 2 if nome == 'III' else 1
        lingua = next((l for l in LINGUAS if l[0] == secao['lingua']), None)
        blocos = []
        n_itens = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'ERRO': 0, 'anulado': 0, 'sem_gab': 0}
        vistos = set()
        for bi, b in enumerate(secao['blocos']):
            itens = []
            for it in b['itens']:
                vistos.add(it['numero'])
                motivo = ITENS_EXCLUIDOS.get((ano, nome, it['numero']))
                if motivo:
                    relatorio.append(f'  - {ano} parte {nome} item {it["numero"]} excluído: {motivo}')
                    n_itens['excluido'] = n_itens.get('excluido', 0) + 1
                    continue
                m = montar_item(it, gab, ano)
                if m is None:
                    n_itens['anulado' if gab.get(it['numero'], '').upper() == 'X' else 'sem_gab'] += 1
                    continue
                n_itens[m['tipo']] += 1
                if m['tipo'] == 'ERRO':
                    relatorio.append(f'  ! {ano} parte {nome} item {it["numero"]}: gabarito {m["gabarito"]} mas {len([1 for l in it["linhas"] if re.match(r"^[ABCD] ", l["texto"])])} alternativas')
                    continue
                itens.append(m)
            if not itens:
                # texto sem itens válidos: junta ao próximo bloco
                if bi + 1 < len(secao['blocos']):
                    secao['blocos'][bi + 1]['texto'] = b['texto'] + secao['blocos'][bi + 1]['texto']
                continue
            texto_html = texto_para_html(b['texto'], ano)
            texto_plano = re.sub('<[^>]+>', ' ', texto_html + ' '.join(i['enunciado'] for i in itens))
            if lingua:
                disc, area = lingua[2], AREA['I']
            else:
                disc, area = classificar(texto_plano, nome), AREA[nome]
            faixa = f"{itens[0]['numeroOriginal']}–{itens[-1]['numeroOriginal']}" if len(itens) > 1 else str(itens[0]['numeroOriginal'])
            pags = sorted(b['paginas'])
            bloco = {
                'id': f'unb{ano}-{nome}-{lingua[1] if lingua else "g"}-{bi + 1}',
                'disciplina': disc,
                'area': area,
                'titulo': '',
                'disciplinaEstimada': not lingua,
                'texto': texto_html,
                'fonte': f'Vestibular UnB {ano} · Prova de Conhecimentos {nome}' + (f' · {lingua[2]}' if lingua else '') +
                         f' · página {pags[0] + 1 if pags else "?"} do caderno oficial (Cebraspe).',
                'itens': itens,
            }
            if lingua:
                bloco['lingua'] = lingua[1]
            blocos.append(bloco)
        faltando = sorted(set(gab) - vistos)
        relatorio.append(f'  {ano} parte {nome} {secao["lingua"] or ""}: blocos={len(blocos)} itens={n_itens} gab={len(gab)}'
                         + (f' NÃO ENCONTRADOS={faltando[:15]}' if faltando else ''))
        provas[dia].extend(blocos)

    resultado = []
    for dia in (1, 2):
        if not provas[dia]:
            continue
        resultado.append({
            'id': f'unb-{ano}-dia{dia}',
            'titulo': f'Vestibular UnB {ano} · {dia}º Dia (oficial)',
            'dia': dia,
            'duracaoMin': 300,
            'oficial': True,
            'ano': ano,
            'origem_url': URL_BASE.get(ano, ''),
            'blocos': provas[dia],
        })
    return resultado


def main():
    pasta = sys.argv[1] if len(sys.argv) > 1 else '.'
    anos = sorted({int(f[:4]) for f in os.listdir(pasta) if re.fullmatch(r'\d{4}_p\d\.pdf', f)}, reverse=True)
    os.makedirs(os.path.join(RAIZ, 'provas'), exist_ok=True)
    relatorio = []
    indice = []
    for ano in anos:
        provas = processar_ano(pasta, ano, relatorio)
        arq = os.path.join(RAIZ, 'provas', f'unb-{ano}.js')
        with open(arq, 'w', encoding='utf-8') as fh:
            fh.write(f'/* Vestibular UnB {ano} — provas oficiais do Cebraspe, convertidas por ferramentas/extrair_provas.py.\n'
                     f'   Conteúdo: Universidade de Brasília / Cebraspe. Uso exclusivamente didático. */\n')
            fh.write('window.PROVAS_OFICIAIS = window.PROVAS_OFICIAIS || [];\n')
            fh.write('window.PROVAS_OFICIAIS.push(...' + json.dumps(provas, ensure_ascii=False, indent=0) + ');\n')
        indice.append(f'provas/unb-{ano}.js')
    print('\n'.join(relatorio + relatorio_global))
    print('Arquivos:', indice)


if __name__ == '__main__':
    main()
