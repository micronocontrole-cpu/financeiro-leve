# Gera o kit de planilhas premium grátis do Micro no Controle.
import datetime as dt, os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule, CellIsRule, DataBarRule
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.utils import get_column_letter as L

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
os.makedirs(OUT, exist_ok=True)

DEEP, MINT, SOL = '0F3D3E', '22C3A6', 'FFCF3A'
INP = 'FFF4CC'; SUB = 'E6F4F1'; LINE = 'D6E0DF'
F = 'Arial'
BRL = 'R$ #,##0.00;[Red]-R$ #,##0.00;"-"'
BRL0 = 'R$ #,##0;[Red]-R$ #,##0;"-"'
PCT = '0.0%;[Red]-0.0%;"-"'
DATA = 'dd/mm/yyyy'
thin = Side(style='thin', color=LINE)
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
VERSAO = 'Versão de novembro de 2026'

def font(**k):
    base = dict(name=F, size=10, color='1A2628')
    base.update(k); return Font(**base)

def fill(c): return PatternFill('solid', start_color=c, end_color=c)

def banda(ws, titulo, sub, ate=12):
    ws.sheet_view.showGridLines = False
    ws.row_dimensions[1].height = 34; ws.row_dimensions[2].height = 20
    for c in range(1, ate + 1):
        ws.cell(1, c).fill = fill(DEEP); ws.cell(2, c).fill = fill(DEEP)
    ws.cell(1, 1, titulo).font = font(size=16, bold=True, color='FFFFFF')
    ws.cell(2, 1, sub).font = font(size=10, color='CDE9E5')
    ws.cell(1, 1).alignment = Alignment(vertical='center', indent=1)
    ws.cell(2, 1).alignment = Alignment(vertical='center', indent=1)
    ws.cell(1, ate, 'Micro no Controle').font = font(size=10, bold=True, color=SOL)
    ws.cell(1, ate).alignment = Alignment(horizontal='right', vertical='center')

def cabec(ws, linha, cols, larg=None, cor=DEEP):
    for i, t in enumerate(cols, 1):
        c = ws.cell(linha, i, t)
        c.font = font(bold=True, color='FFFFFF' if cor == DEEP else DEEP)
        c.fill = fill(cor); c.border = BOX
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws.row_dimensions[linha].height = 32 if max(len(str(t)) for t in cols) <= 18 else 46
    if larg:
        for i, w in enumerate(larg, 1): ws.column_dimensions[L(i)].width = w

def celulas(ws, rng):
    if ':' not in rng: rng = rng + ':' + rng
    return ws[rng]

def entrada(ws, rng, fmt=None):
    for row in celulas(ws, rng):
        for c in row:
            c.fill = fill(INP); c.border = BOX; c.font = font(color='1F3B9A')
            if fmt: c.number_format = fmt

def calc(ws, rng, fmt=None, bold=False):
    for row in celulas(ws, rng):
        for c in row:
            c.border = BOX; c.font = font(bold=bold)
            if fmt: c.number_format = fmt

def lista(ws, rng, origem, msg=None):
    dv = DataValidation(type='list', formula1=origem, allow_blank=True)
    dv.error = 'Escolha um item da lista.'; dv.errorTitle = 'Valor inválido'
    if msg: dv.prompt = msg; dv.showInputMessage = True
    ws.add_data_validation(dv); dv.add(rng)

def status_cores(ws, rng, regras):
    """regras: lista de (texto_contido, fundo, cor_texto)"""
    top = rng.split(':')[0]
    col = ''.join(ch for ch in top if ch.isalpha()); lin = ''.join(ch for ch in top if ch.isdigit())
    for txt, bg, fg in regras:
        ws.conditional_formatting.add(rng, FormulaRule(
            formula=[f'ISNUMBER(SEARCH("{txt}",{col}{lin}))'], fill=fill(bg), font=Font(name=F, size=10, color=fg, bold=True)))

VERDE = ('DDF5EF', '0B5D55'); AMAR = ('FFF1C9', '6B4D00'); VERM = ('FCE3DE', 'B5301B'); CINZA = ('EEF2F2', '3B4B4D')

def exemplo(ws, linhas, cols):
    for r in linhas:
        for c in range(1, cols + 1):
            cel = ws.cell(r, c)
            cel.font = Font(name=F, size=10, italic=True, color=cel.font.color.rgb if cel.font and cel.font.color and isinstance(cel.font.color.rgb, str) else '1A2628')

def kpi(ws, linha, col, rotulo, formula, fmt, larg=2):
    if larg > 1:
        ws.merge_cells(start_row=linha, start_column=col, end_row=linha, end_column=col + larg - 1)
        ws.merge_cells(start_row=linha + 1, start_column=col, end_row=linha + 1, end_column=col + larg - 1)
    a = ws.cell(linha, col, rotulo); a.font = font(size=9, bold=True, color='58686B'); a.fill = fill(SUB)
    b = ws.cell(linha + 1, col, formula); b.font = font(size=15, bold=True, color=DEEP); b.fill = fill(SUB); b.number_format = fmt
    for r in (linha, linha + 1):
        for c in range(col, col + larg):
            ws.cell(r, c).fill = fill(SUB)
        ws.cell(r, col).alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.row_dimensions[linha + 1].height = 26

def grafico_ok(ch):
    ch.roundedCorners = False
    if ch.legend is not None: ch.legend.overlay = False; ch.legend.position = 'b'
    if ch.title is not None: ch.title.overlay = False
    try:
        ch.x_axis.delete = False; ch.y_axis.delete = False
    except Exception: pass

def como_usar(wb, titulo, faz, passos, abas, extra=None, fiscal=False):
    ws = wb.active; ws.title = 'Como usar'
    ws.sheet_properties.tabColor = SOL
    banda(ws, titulo, 'Planilha premium grátis · ' + VERSAO, ate=8)
    ws.column_dimensions['A'].width = 4
    for c in 'BCDEFGH': ws.column_dimensions[c].width = 16
    r = 4
    ws.cell(r, 2, 'Para que serve').font = font(size=12, bold=True, color=DEEP); r += 1
    ws.merge_cells(start_row=r, start_column=2, end_row=r + 1, end_column=8)
    c = ws.cell(r, 2, faz); c.font = font(size=11); c.alignment = Alignment(wrap_text=True, vertical='top')
    ws.row_dimensions[r].height = 30; ws.row_dimensions[r + 1].height = 30; r += 3
    ws.cell(r, 2, 'Passo a passo').font = font(size=12, bold=True, color=DEEP); r += 1
    for i, p in enumerate(passos, 1):
        n = ws.cell(r, 2, i); n.font = font(bold=True, color='2A1F00'); n.fill = fill(SOL)
        n.alignment = Alignment(horizontal='center', vertical='center')
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=8)
        t = ws.cell(r, 3, p); t.font = font(size=11); t.alignment = Alignment(wrap_text=True, vertical='center')
        ws.row_dimensions[r].height = 32; r += 1
    r += 1
    ws.cell(r, 2, 'Legenda').font = font(size=12, bold=True, color=DEEP); r += 1
    ws.cell(r, 2, '').fill = fill(INP); ws.cell(r, 2).border = BOX
    ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=8)
    ws.cell(r, 3, 'Células amarelas: você preenche. As brancas calculam sozinhas: não precisa mexer.').font = font(size=11); r += 1
    ws.cell(r, 2, 'Exemplo').font = Font(name=F, size=10, italic=True, color='58686B')
    ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=8)
    ws.cell(r, 3, 'Linhas em itálico são de exemplo. Apague o conteúdo delas (só as células amarelas) e use as suas.').font = font(size=11); r += 2
    ws.cell(r, 2, 'Abas desta planilha').font = font(size=12, bold=True, color=DEEP); r += 1
    for nome, desc in abas:
        ws.cell(r, 2, nome).font = font(bold=True)
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=8)
        ws.cell(r, 3, desc).font = font(size=11); r += 1
    if extra:
        r += 1; ws.cell(r, 2, 'Bom saber').font = font(size=12, bold=True, color=DEEP); r += 1
        for e in extra:
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=8)
            c = ws.cell(r, 2, '• ' + e); c.font = font(size=11); c.alignment = Alignment(wrap_text=True, vertical='top')
            ws.row_dimensions[r].height = 30; r += 1
    r += 1
    for col in range(2, 9):
        ws.cell(r, col).fill = fill(SUB); ws.cell(r + 1, col).fill = fill(SUB)
    ws.cell(r, 2, 'Quer saber se a maquininha e o iFood pagaram certo?').font = font(size=11, bold=True, color=DEEP)
    ws.cell(r + 1, 2, 'A primeira conferência é grátis e sem senha: micronocontrole.com').font = font(size=11, color='0B6F68', underline='single')
    ws.cell(r + 1, 2).hyperlink = 'https://micronocontrole.com/?src=planilha#conferencia'
    r += 3
    nota = 'Funciona no Excel e no Google Planilhas. Pode usar à vontade no seu negócio; não pode ser revendida.'
    if fiscal: nota += ' Os valores de imposto e limite são estimativas com as regras de 2026: confirme com o seu contador.'
    ws.merge_cells(start_row=r, start_column=2, end_row=r + 1, end_column=8)
    c = ws.cell(r, 2, nota); c.font = font(size=9, color='58686B'); c.alignment = Alignment(wrap_text=True, vertical='top')
    ws.print_options.horizontalCentered = True
    ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0; ws.sheet_properties.pageSetUpPr.fitToPage = True
    return ws

def preparar(ws, cabec_linha, ultima_col, paisagem=True):
    ws.freeze_panes = ws.cell(cabec_linha + 1, 1)
    ws.page_setup.orientation = 'landscape' if paisagem else 'portrait'
    ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = f'{cabec_linha}:{cabec_linha}'

MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
d = dt.date

# =====================================================================
# 1. GESTÃO DO MÊS
# =====================================================================
def gestao():
    wb = Workbook()
    como_usar(wb, 'Gestão do Mês', 'Anote tudo o que entra e sai e veja, mês a mês, quanto vendeu, quanto gastou, quanto sobrou e quanto precisa vender para não ter prejuízo.',
        ['Na aba Configurar, coloque o nome do negócio, o ano, o saldo do caixa no início do ano e a meta de vendas do mês.',
         'Confira as categorias. Pode renomear e criar novas nas linhas amarelas vazias, dizendo se é entrada ou saída e o tipo de saída.',
         'Na aba Lançamentos, anote cada entrada e cada saída: data, categoria, forma de pagamento e valor. O resto preenche sozinho.',
         'Abra o Painel: o resultado do mês, a sobra, o ponto de equilíbrio e os gráficos se atualizam na hora.'],
        [('Configurar', 'Dados do negócio, categorias e formas de pagamento'), ('Lançamentos', 'Tudo o que entra e sai, um por linha'),
         ('Painel', 'Resultado mês a mês, ponto de equilíbrio, meta e gráficos'), ('Por categoria', 'Quanto cada categoria somou em cada mês')],
        ['Saída variável é o que sobe quando você vende mais (mercadoria, embalagem, taxas). Saída fixa é o que você paga vendendo ou não (aluguel, internet, salários).',
         'Retirada do dono é o dinheiro que você tira para você. Separar do resto mostra se o negócio dá lucro de verdade.',
         'Ponto de equilíbrio = quanto precisa vender no mês para pagar as saídas fixas, sem lucro e sem prejuízo.'])
    # Configurar
    cf = wb.create_sheet('Configurar'); cf.sheet_properties.tabColor = MINT
    banda(cf, 'Configurar', 'Preencha uma vez. Pode mudar quando quiser.', ate=6)
    for col, w in zip('ABCDEF', [32, 18, 16, 4, 26, 4]): cf.column_dimensions[col].width = w
    itens = [('Nome do negócio', 'Lanchonete Exemplo', None), ('Ano', 2026, '0'), ('Saldo do caixa no início do ano (R$)', 2500, BRL), ('Meta de vendas por mês (R$)', 18000, BRL)]
    for i, (a, b, fm) in enumerate(itens, 4):
        cf.cell(i, 1, a).font = font(bold=True); cf.cell(i, 2, b)
        entrada(cf, f'B{i}', fm)
    cabec(cf, 9, ['Categoria', 'Entrada ou saída', 'Tipo'])
    cf.cell(9, 5, 'Formas de pagamento').font = font(bold=True, color='FFFFFF'); cf.cell(9, 5).fill = fill(DEEP); cf.cell(9, 5).border = BOX
    cf.cell(9, 5).alignment = Alignment(horizontal='center', vertical='center')
    cats = [('Vendas no dinheiro', 'Entrada', 'Entrada'), ('Vendas no cartão', 'Entrada', 'Entrada'), ('Vendas no Pix', 'Entrada', 'Entrada'),
            ('Vendas por aplicativo (iFood e outros)', 'Entrada', 'Entrada'), ('Serviços prestados', 'Entrada', 'Entrada'), ('Outras entradas', 'Entrada', 'Entrada'),
            ('Mercadorias e insumos', 'Saída', 'Variável'), ('Embalagens', 'Saída', 'Variável'), ('Taxas de maquininha', 'Saída', 'Variável'),
            ('Comissões de aplicativos', 'Saída', 'Variável'), ('Entregas e fretes', 'Saída', 'Variável'), ('Imposto (DAS)', 'Saída', 'Fixa'),
            ('Aluguel', 'Saída', 'Fixa'), ('Energia, água e gás', 'Saída', 'Fixa'), ('Internet e telefone', 'Saída', 'Fixa'), ('Salários e ajudantes', 'Saída', 'Fixa'),
            ('Contador e sistemas', 'Saída', 'Fixa'), ('Marketing e divulgação', 'Saída', 'Fixa'), ('Manutenção', 'Saída', 'Fixa'), ('Outras saídas', 'Saída', 'Fixa'),
            ('Retirada do dono', 'Saída', 'Retirada')]
    N1, N2 = 10, 39
    for i in range(N1, N2 + 1):
        k = i - N1
        if k < len(cats):
            for j, v in enumerate(cats[k], 1): cf.cell(i, j, v)
    entrada(cf, f'A{N1}:C{N2}')
    lista(cf, f'B{N1}:B{N2}', '"Entrada,Saída"'); lista(cf, f'C{N1}:C{N2}', '"Entrada,Variável,Fixa,Retirada"')
    formas = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Vale-refeição', 'Aplicativo', 'Boleto', 'Transferência']
    for i in range(N1, N1 + 12):
        if i - N1 < len(formas): cf.cell(i, 5, formas[i - N1])
    entrada(cf, f'E{N1}:E{N1+11}')
    CAT = f'Configurar!$A${N1}:$A${N2}'
    # Lançamentos
    lc = wb.create_sheet('Lançamentos'); lc.sheet_properties.tabColor = MINT
    banda(lc, 'Lançamentos', 'Uma linha para cada entrada ou saída. Amarelo você preenche; o resto é automático.', ate=9)
    cabec(lc, 4, ['Data', 'Categoria', 'Descrição', 'Forma de pagamento', 'Valor (R$)', 'Entrada ou saída', 'Tipo', 'Mês', 'Ano'],
          [12, 34, 30, 20, 14, 14, 12, 7, 7])
    R1, R2 = 5, 1004
    ex = [(d(2026, 9, 2), 'Vendas no cartão', 'Semana 1', 'Cartão de crédito', 3820), (d(2026, 9, 2), 'Vendas no Pix', 'Semana 1', 'Pix', 1450),
          (d(2026, 9, 3), 'Mercadorias e insumos', 'Atacado', 'Pix', 2380), (d(2026, 9, 5), 'Aluguel', 'Setembro', 'Boleto', 1800),
          (d(2026, 9, 10), 'Vendas por aplicativo (iFood e outros)', 'Repasse', 'Aplicativo', 2950), (d(2026, 9, 12), 'Taxas de maquininha', 'Setembro', 'Cartão de crédito', 310),
          (d(2026, 9, 20), 'Imposto (DAS)', 'DAS agosto', 'Pix', 82.05), (d(2026, 9, 25), 'Retirada do dono', 'Pró-labore', 'Pix', 2500),
          (d(2026, 10, 2), 'Vendas no cartão', 'Semana 1', 'Cartão de débito', 4100), (d(2026, 10, 2), 'Vendas no dinheiro', 'Semana 1', 'Dinheiro', 980),
          (d(2026, 10, 4), 'Mercadorias e insumos', 'Atacado', 'Boleto', 2650), (d(2026, 10, 5), 'Aluguel', 'Outubro', 'Boleto', 1800),
          (d(2026, 10, 8), 'Energia, água e gás', 'Conta de luz', 'Boleto', 420), (d(2026, 10, 10), 'Vendas por aplicativo (iFood e outros)', 'Repasse', 'Aplicativo', 3120),
          (d(2026, 10, 15), 'Comissões de aplicativos', 'Outubro', 'Aplicativo', 690), (d(2026, 10, 25), 'Retirada do dono', 'Pró-labore', 'Pix', 2500)]
    for k, row in enumerate(ex):
        for j, v in enumerate(row, 1): lc.cell(R1 + k, j, v)
    entrada(lc, f'A{R1}:A{R2}', DATA); entrada(lc, f'B{R1}:D{R2}'); entrada(lc, f'E{R1}:E{R2}', BRL)
    for r in range(R1, R2 + 1):
        lc[f'F{r}'] = f'=IF(B{r}="","",IFERROR(INDEX(Configurar!$B${N1}:$B${N2},MATCH(B{r},{CAT},0)),"Categoria?"))'
        lc[f'G{r}'] = f'=IF(B{r}="","",IFERROR(INDEX(Configurar!$C${N1}:$C${N2},MATCH(B{r},{CAT},0)),""))'
        lc[f'H{r}'] = f'=IF(A{r}="","",MONTH(A{r}))'
        lc[f'I{r}'] = f'=IF(A{r}="","",YEAR(A{r}))'
    calc(lc, f'F{R1}:I{R2}')
    lista(lc, f'B{R1}:B{R2}', '=' + CAT, 'Escolha a categoria'); lista(lc, f'D{R1}:D{R2}', f'=Configurar!$E${N1}:$E${N1+11}')
    status_cores(lc, f'F{R1}:F{R2}', [('Entrada', *VERDE), ('Saída', *VERM), ('Categoria?', *AMAR)])
    exemplo(lc, range(R1, R1 + len(ex)), 9)
    preparar(lc, 4, 9)
    RNG = lambda c: f"Lançamentos!${c}${R1}:${c}${R2}"
    ANO = 'Configurar!$B$5'
    # Painel
    pn = wb.create_sheet('Painel', 1); pn.sheet_properties.tabColor = DEEP
    banda(pn, 'Painel do ano', '="Negócio: "&Configurar!B4&"  ·  Ano: "&Configurar!B5', ate=15)
    pn.column_dimensions['A'].width = 3; pn.column_dimensions['B'].width = 30
    for c in range(3, 16): pn.column_dimensions[L(c)].width = 11.5
    pn.column_dimensions['O'].width = 13
    kpi(pn, 4, 2, 'Vendas no ano', f'=O10', BRL0, 1)
    kpi(pn, 4, 3, 'Resultado no ano', f'=O15', BRL0, 3)
    kpi(pn, 4, 6, 'Sobrou depois da retirada', f'=O17', BRL0, 3)
    kpi(pn, 4, 9, 'Margem de contribuição', f'=O13', PCT, 3)
    kpi(pn, 4, 12, 'Ponto de equilíbrio médio/mês', f'=IFERROR(AVERAGEIF(C19:N19,">0"),0)', BRL0, 4)
    cabec(pn, 8, [''] + ['O que'] + MESES + ['Ano'])
    pn.cell(8, 1).fill = PatternFill(None); pn.cell(8, 1).border = Border()
    linhas = [
        (10, 'Entradas (vendas)', lambda c, m: f'=SUMIFS({RNG("E")},{RNG("F")},"Entrada",{RNG("H")},{m},{RNG("I")},{ANO})', BRL0, True),
        (11, 'Saídas variáveis', lambda c, m: f'=SUMIFS({RNG("E")},{RNG("G")},"Variável",{RNG("H")},{m},{RNG("I")},{ANO})', BRL0, False),
        (12, 'Margem de contribuição', lambda c, m: f'={c}10-{c}11', BRL0, True),
        (13, 'Margem de contribuição (%)', lambda c, m: f'=IF({c}10=0,0,{c}12/{c}10)', PCT, False),
        (14, 'Saídas fixas', lambda c, m: f'=SUMIFS({RNG("E")},{RNG("G")},"Fixa",{RNG("H")},{m},{RNG("I")},{ANO})', BRL0, False),
        (15, 'Resultado do negócio', lambda c, m: f'={c}12-{c}14', BRL0, True),
        (16, 'Retirada do dono', lambda c, m: f'=SUMIFS({RNG("E")},{RNG("G")},"Retirada",{RNG("H")},{m},{RNG("I")},{ANO})', BRL0, False),
        (17, 'Sobrou no caixa', lambda c, m: f'={c}15-{c}16', BRL0, True),
        (18, 'Saldo acumulado do caixa', None, BRL0, True),
        (19, 'Ponto de equilíbrio', lambda c, m: f'=IF({c}13<=0,0,{c}14/{c}13)', BRL0, False),
        (20, 'Meta de vendas', lambda c, m: '=Configurar!$B$7', BRL0, False),
        (21, 'Quanto da meta bateu', lambda c, m: f'=IF({c}20=0,0,{c}10/{c}20)', PCT, False),
        (22, 'Total de saídas', lambda c, m: f'={c}11+{c}14+{c}16', BRL0, False),
    ]
    for (r, nome, fn, fm, neg) in linhas:
        pn.cell(r, 2, nome).font = font(bold=neg); pn.cell(r, 2).border = BOX
        if r in (12, 15, 17, 18): pn.cell(r, 2).fill = fill(SUB)
        for k in range(12):
            c = L(3 + k); m = k + 1
            if r == 18:
                pn[f'{c}18'] = '=Configurar!$B$6+C17' if k == 0 else f'={L(2+k)}18+{c}17'
            else:
                pn[f'{c}{r}'] = fn(c, m)
            cel = pn[f'{c}{r}']; cel.number_format = fm; cel.border = BOX; cel.font = font(bold=neg)
            if r in (12, 15, 17, 18): cel.fill = fill(SUB)
        o = pn[f'O{r}']
        if r in (13,): o.value = '=IF(O10=0,0,O12/O10)'
        elif r == 18: o.value = '=N18'
        elif r == 19: o.value = '=IF(O13<=0,0,O14/O13)'
        elif r == 21: o.value = '=IF(O20=0,0,O10/O20)'
        else: o.value = f'=SUM(C{r}:N{r})'
        o.number_format = fm; o.border = BOX; o.font = font(bold=True); o.fill = fill(SUB)
    for r in (15, 17, 18):
        pn.conditional_formatting.add(f'C{r}:O{r}', CellIsRule(operator='lessThan', formula=['0'], font=Font(name=F, size=10, bold=True, color='B5301B'), fill=fill('FCE3DE')))
    pn.conditional_formatting.add('C21:N21', CellIsRule(operator='greaterThanOrEqual', formula=['1'], font=Font(name=F, size=10, bold=True, color='0B5D55'), fill=fill('DDF5EF')))
    pn.cell(23, 2, 'Resultado do negócio = vendas − saídas variáveis − saídas fixas. Sobrou no caixa = resultado − retirada do dono.').font = font(size=9, color='58686B')
    # gráficos
    ch = BarChart(); ch.type = 'col'; ch.grouping = 'clustered'; ch.title = 'Entradas e saídas por mês'
    ch.add_data(Reference(pn, min_col=2, max_col=14, min_row=10, max_row=10), from_rows=True, titles_from_data=True)
    ch.add_data(Reference(pn, min_col=2, max_col=14, min_row=22, max_row=22), from_rows=True, titles_from_data=True)
    ch.set_categories(Reference(pn, min_col=3, max_col=14, min_row=8))
    ch.y_axis.numFmt = 'R$ #,##0'; ch.y_axis.majorGridlines = None; ch.height = 7.5; ch.width = 17
    ch.series[0].graphicalProperties.solidFill = MINT; ch.series[1].graphicalProperties.solidFill = 'E4572E'
    grafico_ok(ch); pn.add_chart(ch, 'B25')
    lch = LineChart(); lch.title = 'Saldo do caixa no ano'
    lch.add_data(Reference(pn, min_col=2, max_col=14, min_row=18, max_row=18), from_rows=True, titles_from_data=True)
    lch.set_categories(Reference(pn, min_col=3, max_col=14, min_row=8))
    lch.y_axis.numFmt = 'R$ #,##0'; lch.height = 7.5; lch.width = 13
    for sr in lch.series: sr.smooth = False
    lch.series[0].graphicalProperties.line.solidFill = DEEP; lch.series[0].graphicalProperties.line.width = 28000
    grafico_ok(lch); pn.add_chart(lch, 'J25')
    pn.page_setup.orientation = 'landscape'; pn.page_setup.fitToWidth = 1; pn.page_setup.fitToHeight = 1; pn.sheet_properties.pageSetUpPr.fitToPage = True
    # Por categoria
    pc = wb.create_sheet('Por categoria'); pc.sheet_properties.tabColor = DEEP
    banda(pc, 'Por categoria', 'Quanto cada categoria somou em cada mês do ano', ate=15)
    pc.column_dimensions['A'].width = 34; pc.column_dimensions['B'].width = 11
    for c in range(3, 16): pc.column_dimensions[L(c)].width = 11
    cabec(pc, 4, ['Categoria', 'Tipo'] + MESES + ['Ano'])
    for i in range(N2 - N1 + 1):
        r = 5 + i
        pc[f'A{r}'] = f'=IF(Configurar!A{N1+i}="","",Configurar!A{N1+i})'
        pc[f'B{r}'] = f'=IF(A{r}="","",Configurar!C{N1+i})'
        for k in range(12):
            c = L(3 + k)
            pc[f'{c}{r}'] = f'=IF($A{r}="","",SUMIFS({RNG("E")},{RNG("B")},$A{r},{RNG("H")},{k+1},{RNG("I")},{ANO}))'
        pc[f'O{r}'] = f'=IF($A{r}="","",SUM(C{r}:N{r}))'
    calc(pc, f'A5:O{5+N2-N1}');
    for row in pc[f'C5:O{5+N2-N1}']:
        for c in row: c.number_format = BRL0
    pc.conditional_formatting.add(f'O5:O{5+N2-N1}', DataBarRule(start_type='min', end_type='max', color=MINT))
    preparar(pc, 4, 15)
    return wb

# =====================================================================
# 2. CONFERÊNCIA DE RECEBIMENTOS
# =====================================================================
def conferencia():
    wb = Workbook()
    como_usar(wb, 'Conferência de Recebimentos', 'Descubra se cada venda no cartão, no Pix da maquininha, no vale e no aplicativo caiu na conta, no valor certo e no dia certo. É a mesma lógica da conferência que fazemos para os clientes.',
        ['Na aba Taxas, coloque a taxa e o prazo de recebimento do SEU contrato para cada forma de pagamento. Sem isso, o resultado é só uma estimativa.',
         'Na aba Vendas, lance as vendas (pode ser o total do dia por forma de pagamento): data, forma e valor bruto.',
         'Quando o dinheiro cair no banco, anote o valor recebido e a data. A planilha calcula o que deveria ter caído e marca a situação.',
         'Abra o Resumo para ver quanto ficou para trás. Na aba Vendas, a coluna Texto para cobrar traz a mensagem pronta para mandar à maquininha.'],
        [('Resumo', 'Quanto foi vendido, quanto caiu e quanto ficou para trás, por forma'), ('Vendas', 'Cada venda, o que devia cair, o que caiu e a situação'),
         ('Taxas', 'A taxa e o prazo do seu contrato')],
        ['Confirmada: a venda está lançada, passou o prazo e o dinheiro não caiu (ou caiu a menos). Provável: venda no crédito parcelado, que cai em parcelas, ou com antecipação: confira antes de cobrar.',
         'Damos 2 dias de folga depois do prazo antes de marcar "Não caiu", por causa de feriados e fins de semana.',
         'Vale-refeição e alimentação: a taxa máxima é de 3,6% e o repasse em até 15 dias (Decreto 12.712/2025). Confira o seu contrato.'])
    tx = wb.create_sheet('Taxas'); tx.sheet_properties.tabColor = MINT
    banda(tx, 'Taxas do seu contrato', 'Troque os valores de exemplo pelos do seu contrato ou do app da maquininha', ate=4)
    cabec(tx, 4, ['Forma de pagamento', 'Taxa do contrato (%)', 'Prazo para cair (dias)', 'Observação'], [28, 16, 16, 52])
    taxas = [('Cartão de débito', .0199, 1, 'Exemplo: troque pela sua taxa'), ('Crédito à vista', .0349, 30, 'Se você antecipa, use 1 dia e a taxa com antecipação'),
             ('Crédito parcelado', .0449, 30, 'Cai em parcelas: a conferência marca como provável'), ('Pix na maquininha', .0099, 0, ''),
             ('Vale-refeição/alimentação', .036, 15, 'Teto de 3,6% e repasse em até 15 dias (Decreto 12.712/2025)'), ('Aplicativo de delivery', .23, 7, 'Some comissão + taxa de pagamento do seu plano')]
    for i in range(12):
        r = 5 + i
        if i < len(taxas):
            for j, v in enumerate(taxas[i], 1): tx.cell(r, j, v)
    entrada(tx, 'A5:A16'); entrada(tx, 'B5:B16', '0.00%'); entrada(tx, 'C5:C16', '0'); entrada(tx, 'D5:D16')
    exemplo(tx, range(5, 5 + len(taxas)), 4)
    FORMA = 'Taxas!$A$5:$A$16'
    vd = wb.create_sheet('Vendas'); vd.sheet_properties.tabColor = MINT
    banda(vd, 'Vendas e recebimentos', 'Lance a venda; quando cair no banco, anote o valor e a data', ate=13)
    cabec(vd, 4, ['Data da venda', 'Forma de pagamento', 'Bandeira ou origem', 'Valor bruto (R$)', 'Taxa (%)', 'Devia cair (R$)', 'Previsão', 'Caiu (R$)', 'Data que caiu', 'Diferença (R$)', 'Situação', 'Certeza', 'Texto para cobrar'],
          [12, 24, 14, 13, 9, 13, 12, 12, 12, 12, 18, 22, 60])
    R1, R2 = 5, 1004
    ex = [(d(2026, 10, 1), 'Cartão de débito', 'Visa', 1240.50, 1215.81, d(2026, 10, 2)), (d(2026, 10, 1), 'Crédito à vista', 'Mastercard', 2310.00, 2229.38, d(2026, 10, 31)),
          (d(2026, 10, 2), 'Pix na maquininha', '', 640.00, 633.66, d(2026, 10, 2)), (d(2026, 10, 3), 'Cartão de débito', 'Elo', 980.00, None, None),
          (d(2026, 10, 3), 'Vale-refeição/alimentação', 'Vale', 455.00, 438.62, d(2026, 10, 17)), (d(2026, 10, 5), 'Crédito à vista', 'Visa', 1875.00, 1790.00, d(2026, 11, 4)),
          (d(2026, 10, 6), 'Aplicativo de delivery', 'iFood', 3120.00, 2402.40, d(2026, 10, 13)), (d(2026, 11, 20), 'Cartão de débito', 'Visa', 1105.00, None, None)]
    for k, (a, b, c, v, rec, drec) in enumerate(ex):
        r = R1 + k; vd.cell(r, 1, a); vd.cell(r, 2, b); vd.cell(r, 3, c); vd.cell(r, 4, v)
        if rec is not None: vd.cell(r, 8, rec); vd.cell(r, 9, drec)
    entrada(vd, f'A{R1}:A{R2}', DATA); entrada(vd, f'B{R1}:C{R2}'); entrada(vd, f'D{R1}:D{R2}', BRL)
    entrada(vd, f'H{R1}:H{R2}', BRL); entrada(vd, f'I{R1}:I{R2}', DATA)
    for r in range(R1, R2 + 1):
        vd[f'E{r}'] = f'=IF(B{r}="","",IFERROR(INDEX(Taxas!$B$5:$B$16,MATCH(B{r},{FORMA},0)),""))'
        vd[f'F{r}'] = f'=IF(OR(D{r}="",E{r}=""),"",ROUND(D{r}*(1-E{r}),2))'
        vd[f'G{r}'] = f'=IF(OR(A{r}="",B{r}=""),"",A{r}+IFERROR(INDEX(Taxas!$C$5:$C$16,MATCH(B{r},{FORMA},0)),0))'
        vd[f'J{r}'] = f'=IF(OR(H{r}="",F{r}=""),"",ROUND(H{r}-F{r},2))'
        vd[f'K{r}'] = (f'=IF(OR(D{r}="",F{r}=""),"",IF(H{r}="",IF(TODAY()>G{r}+2,"Não caiu","Aguardando"),'
                       f'IF(ABS(J{r})<=0.05,"OK",IF(J{r}<0,"Caiu a menos","Caiu a mais"))))')
        vd[f'L{r}'] = f'=IF(OR(K{r}="",K{r}="OK",K{r}="Aguardando"),"",IF(B{r}="Crédito parcelado","Provável: confira as parcelas",IF(K{r}="Caiu a mais","Confira: pode ser outra venda","Confirmada")))'
        vd[f'M{r}'] = (f'=IF(OR(K{r}="Não caiu",K{r}="Caiu a menos"),"Olá! A venda de R$ "&FIXED(D{r},2)&" ("&B{r}&") feita em "&DAY(A{r})&"/"&MONTH(A{r})&"/"&YEAR(A{r})'
                       f'&" devia ter caído em "&DAY(G{r})&"/"&MONTH(G{r})&"/"&YEAR(G{r})&", no valor de R$ "&FIXED(F{r},2)&". "'
                       f'&IF(K{r}="Caiu a menos","Caiu só R$ "&FIXED(H{r},2)&".","Não encontrei esse valor no extrato.")&" Podem verificar e me mandar o comprovante, por favor?","")')
    calc(vd, f'E{R1}:E{R2}', '0.00%'); calc(vd, f'F{R1}:F{R2}', BRL); calc(vd, f'G{R1}:G{R2}', DATA); calc(vd, f'J{R1}:J{R2}', BRL)
    calc(vd, f'K{R1}:L{R2}'); calc(vd, f'M{R1}:M{R2}')
    for row in vd[f'M{R1}:M{R2}']: row[0].font = font(size=9, color='3A4B4D')
    lista(vd, f'B{R1}:B{R2}', '=' + FORMA, 'Escolha a forma de pagamento')
    status_cores(vd, f'K{R1}:K{R2}', [('OK', *VERDE), ('Aguardando', *CINZA), ('Não caiu', *VERM), ('a menos', *VERM), ('a mais', *AMAR)])
    status_cores(vd, f'L{R1}:L{R2}', [('Confirmada', *VERM), ('Provável', *AMAR), ('Confira', *AMAR)])
    exemplo(vd, range(R1, R1 + len(ex)), 9)
    preparar(vd, 4, 13)
    rs = wb.create_sheet('Resumo', 1); rs.sheet_properties.tabColor = DEEP
    banda(rs, 'Resumo da conferência', 'Atualiza sozinho conforme você lança as vendas e o que caiu', ate=8)
    rs.column_dimensions['A'].width = 3; rs.column_dimensions['B'].width = 28
    for c in 'CDEFGH': rs.column_dimensions[c].width = 15
    V = lambda c: f'Vendas!${c}${R1}:${c}${R2}'
    kpi(rs, 4, 2, 'Ficou para trás (confirmado)', f'=SUMIFS({V("F")},{V("L")},"Confirmada",{V("K")},"Não caiu")-SUMIFS({V("J")},{V("L")},"Confirmada",{V("K")},"Caiu a menos")', BRL, 2)
    kpi(rs, 4, 4, 'Provável (confira antes)', f'=SUMIFS({V("F")},{V("L")},"Provável*",{V("K")},"Não caiu")-SUMIFS({V("J")},{V("L")},"Provável*",{V("K")},"Caiu a menos")', BRL, 2)
    kpi(rs, 4, 6, 'Ainda dentro do prazo', f'=SUMIFS({V("F")},{V("K")},"Aguardando")', BRL, 2)
    kpi(rs, 4, 8, 'Taxas pagas', f'=SUMIFS({V("D")},{V("E")},">0")-SUM({V("F")})', BRL, 1)
    cabec(rs, 8, ['', 'Forma de pagamento', 'Vendido', 'Devia cair', 'Caiu', 'Não caiu', 'Caiu a menos', 'Aguardando'])
    rs.cell(8, 1).fill = PatternFill(None); rs.cell(8, 1).border = Border()
    for i in range(12):
        r = 9 + i
        rs[f'B{r}'] = f'=IF(Taxas!A{5+i}="","",Taxas!A{5+i})'
        rs[f'C{r}'] = f'=IF(B{r}="","",SUMIFS({V("D")},{V("B")},B{r}))'
        rs[f'D{r}'] = f'=IF(B{r}="","",SUMIFS({V("F")},{V("B")},B{r}))'
        rs[f'E{r}'] = f'=IF(B{r}="","",SUMIFS({V("H")},{V("B")},B{r}))'
        rs[f'F{r}'] = f'=IF(B{r}="","",SUMIFS({V("F")},{V("B")},B{r},{V("K")},"Não caiu"))'
        rs[f'G{r}'] = f'=IF(B{r}="","",-SUMIFS({V("J")},{V("B")},B{r},{V("K")},"Caiu a menos"))'
        rs[f'H{r}'] = f'=IF(B{r}="","",SUMIFS({V("F")},{V("B")},B{r},{V("K")},"Aguardando"))'
    calc(rs, 'B9:H20', BRL);
    for r in range(9, 21): rs[f'B{r}'].number_format = 'General'
    rs['B21'] = 'Total'; rs['B21'].font = font(bold=True); rs['B21'].border = BOX; rs['B21'].fill = fill(SUB)
    for c in 'CDEFGH':
        rs[f'{c}21'] = f'=SUM({c}9:{c}20)'; rs[f'{c}21'].number_format = BRL; rs[f'{c}21'].font = font(bold=True); rs[f'{c}21'].border = BOX; rs[f'{c}21'].fill = fill(SUB)
    rs.conditional_formatting.add('F9:G21', CellIsRule(operator='greaterThan', formula=['0'], font=Font(name=F, size=10, bold=True, color='B5301B'), fill=fill('FCE3DE')))
    rs['B23'] = 'Taxas pagas = vendido − o que devia cair. Para cobrar, use o texto pronto na coluna M da aba Vendas.'; rs['B23'].font = font(size=9, color='58686B')
    ch = BarChart(); ch.type = 'bar'; ch.grouping = 'clustered'; ch.title = 'Devia cair × caiu, por forma'
    ch.add_data(Reference(rs, min_col=4, max_col=5, min_row=8, max_row=14), titles_from_data=True)
    ch.set_categories(Reference(rs, min_col=2, min_row=9, max_row=14))
    ch.x_axis.numFmt = 'R$ #,##0'; ch.height = 8; ch.width = 18
    ch.series[0].graphicalProperties.solidFill = 'B9C7C6'; ch.series[1].graphicalProperties.solidFill = MINT
    grafico_ok(ch); rs.add_chart(ch, 'B25')
    rs.page_setup.orientation = 'landscape'; rs.page_setup.fitToWidth = 1; rs.page_setup.fitToHeight = 1; rs.sheet_properties.pageSetUpPr.fitToPage = True
    return wb

# =====================================================================
# 3. PREÇO E MARGEM
# =====================================================================
def preco():
    wb = Workbook()
    como_usar(wb, 'Preço e Margem', 'Descubra o preço mínimo para não ter prejuízo e o preço sugerido para ter o lucro que você quer, contando taxa da maquininha, comissão de aplicativo, imposto, embalagem, entrega e custos fixos.',
        ['Na aba Custos fixos, liste o que você paga todo mês vendendo ou não, e coloque quanto vende em média por mês.',
         'Na aba Produtos, coloque o custo de cada produto ou serviço, as taxas e a margem que você quer.',
         'Veja o preço mínimo, o preço sugerido e, se colocar o preço que cobra hoje, o lucro real e a situação de cada item.'],
        [('Produtos', 'Preço mínimo, preço sugerido e lucro real de cada item'), ('Custos fixos', 'Quanto os custos fixos pesam em cada venda')],
        ['O custo fixo entra como porcentagem do faturamento: se você vende R$ 20 mil e tem R$ 5 mil de custos fixos, cada venda precisa cobrir 25%.',
         'Se a soma das porcentagens passar de 100%, nenhum preço cobre os custos: a planilha avisa "Revise os %".',
         'Vende no aplicativo com outra comissão? Faça duas linhas do mesmo produto, uma para o balcão e outra para o app.'])
    cf = wb.create_sheet('Custos fixos'); cf.sheet_properties.tabColor = MINT
    banda(cf, 'Custos fixos do mês', 'O que você paga todo mês, vendendo ou não', ate=3)
    cabec(cf, 4, ['Custo fixo', 'Valor por mês (R$)', 'Observação'], [34, 18, 40])
    fixos = [('Aluguel', 1800), ('Energia, água e gás', 520), ('Internet e telefone', 150), ('Ajudante', 1600), ('Contador e sistemas', 180), ('Imposto fixo (DAS)', 82.05), ('Marketing', 200)]
    for i in range(20):
        r = 5 + i
        if i < len(fixos): cf.cell(r, 1, fixos[i][0]); cf.cell(r, 2, fixos[i][1])
    entrada(cf, 'A5:A24'); entrada(cf, 'B5:B24', BRL); entrada(cf, 'C5:C24')
    exemplo(cf, range(5, 5 + len(fixos)), 3)
    cf['A26'] = 'Total de custos fixos'; cf['B26'] = '=SUM(B5:B24)'
    cf['A27'] = 'Quanto você vende em média por mês (R$)'; cf['B27'] = 18000
    cf['A28'] = 'Peso dos custos fixos em cada venda'; cf['B28'] = '=IF(B27=0,0,B26/B27)'
    for r in (26, 27, 28): cf[f'A{r}'].font = font(bold=True); cf[f'B{r}'].border = BOX
    cf['B26'].number_format = BRL; cf['B26'].font = font(bold=True)
    entrada(cf, 'B27', BRL); cf['B28'].number_format = PCT; cf['B28'].font = font(bold=True, color=DEEP); cf['B28'].fill = fill(SUB)
    pr = wb.create_sheet('Produtos', 1); pr.sheet_properties.tabColor = DEEP
    banda(pr, 'Preço e margem por produto', 'Amarelo você preenche; o preço mínimo e o sugerido aparecem sozinhos', ate=18)
    cols = ['Produto ou serviço', 'Custo do produto ou insumos', 'Embalagem', 'Entrega ou frete', 'Outros custos', 'Custo direto total', 'Taxa do cartão (%)',
            'Comissão de app ou marketplace (%)', 'Imposto (%)', 'Custos fixos (%)', 'Margem que você quer (%)', 'Soma das taxas (%)', 'Preço mínimo (sem lucro)',
            'Preço sugerido', 'Preço que cobra hoje', 'Lucro por unidade', 'Margem real (%)', 'Situação']
    cabec(pr, 4, cols, [26, 13, 11, 11, 11, 12, 10, 13, 9, 10, 11, 10, 13, 12, 12, 12, 10, 16])
    R1, R2 = 5, 204
    ex = [('X-burguer (balcão)', 7.80, 0.60, 0, 0.40, .03, 0, .04, .15, 24.90), ('X-burguer (aplicativo)', 7.80, 1.20, 0, 0.40, 0, .23, .04, .15, 29.90),
          ('Combo família', 34.00, 2.50, 0, 1.00, .03, 0, .04, .15, 69.90), ('Corte de cabelo', 4.00, 0, 0, 1.50, .03, 0, .06, .20, 40.00)]
    for k, row in enumerate(ex):
        r = R1 + k; pr.cell(r, 1, row[0])
        for j, v in zip([2, 3, 4, 5, 7, 8, 9, 11, 15], row[1:]): pr.cell(r, j, v)
    entrada(pr, f'A{R1}:A{R2}'); entrada(pr, f'B{R1}:E{R2}', BRL); entrada(pr, f'G{R1}:I{R2}', '0.0%'); entrada(pr, f'K{R1}:K{R2}', '0.0%'); entrada(pr, f'O{R1}:O{R2}', BRL)
    for r in range(R1, R2 + 1):
        pr[f'F{r}'] = f'=IF(A{r}="","",SUM(B{r}:E{r}))'
        pr[f'J{r}'] = f'=IF(A{r}="","",\'Custos fixos\'!$B$28)'
        pr[f'L{r}'] = f'=IF(A{r}="","",G{r}+H{r}+I{r}+J{r})'
        pr[f'M{r}'] = f'=IF(A{r}="","",IF(L{r}>=1,"Revise os %",F{r}/(1-L{r})))'
        pr[f'N{r}'] = f'=IF(A{r}="","",IF(L{r}+K{r}>=1,"Revise os %",F{r}/(1-L{r}-K{r})))'
        pr[f'P{r}'] = f'=IF(OR(A{r}="",O{r}=""),"",O{r}-F{r}-O{r}*L{r})'
        pr[f'Q{r}'] = f'=IF(OR(P{r}="",O{r}=0),"",P{r}/O{r})'
        pr[f'R{r}'] = f'=IF(P{r}="","",IF(P{r}<0,"Prejuízo",IF(Q{r}<K{r},"Abaixo da meta","Saudável")))'
    calc(pr, f'F{R1}:F{R2}', BRL); calc(pr, f'J{R1}:J{R2}', '0.0%'); calc(pr, f'L{R1}:L{R2}', '0.0%')
    calc(pr, f'M{R1}:N{R2}', BRL, bold=True); calc(pr, f'P{R1}:P{R2}', BRL); calc(pr, f'Q{R1}:Q{R2}', PCT); calc(pr, f'R{R1}:R{R2}')
    for row in pr[f'N{R1}:N{R2}']: row[0].fill = fill(SUB)
    status_cores(pr, f'R{R1}:R{R2}', [('Saudável', *VERDE), ('Abaixo', *AMAR), ('Prejuízo', *VERM)])
    status_cores(pr, f'M{R1}:N{R2}', [('Revise', *VERM)])
    exemplo(pr, range(R1, R1 + len(ex)), 18)
    preparar(pr, 4, 18)
    ch = BarChart(); ch.type = 'bar'; ch.title = 'Margem real por produto (primeiros 10)'
    ch.add_data(Reference(pr, min_col=17, min_row=4, max_row=14), titles_from_data=True)
    ch.set_categories(Reference(pr, min_col=1, min_row=5, max_row=14))
    ch.x_axis.numFmt = '0%'; ch.height = 8; ch.width = 16; ch.legend = None
    ch.series[0].graphicalProperties.solidFill = MINT
    grafico_ok(ch); pr.add_chart(ch, 'T4')
    return wb

# =====================================================================
# 4. CONTAS E FIADO
# =====================================================================
def contas():
    wb = Workbook()
    como_usar(wb, 'Contas e Fiado', 'Todas as contas a pagar e tudo o que os clientes devem num lugar só, com o aviso do que vence nos próximos dias e há quanto tempo cada fiado está em aberto.',
        ['Na aba Contas a pagar, anote o vencimento, a conta e o valor. Quando pagar, coloque a data do pagamento.',
         'Na aba A receber e fiado, anote quem deve, o valor e a data. Quando o cliente pagar (tudo ou parte), anote o valor recebido.',
         'Abra o Resumo: o que vence em 7 e em 30 dias, o que já venceu e o total que os clientes devem.'],
        [('Resumo', 'O que vence, o que venceu e quanto você tem a receber'), ('Contas a pagar', 'Boletos, faturas e fornecedores'), ('A receber e fiado', 'Quem te deve e há quanto tempo')],
        ['A situação usa a data de hoje do computador ou do celular: abra a planilha todo dia para ver os avisos atualizados.',
         'Para cobrar fiado com Pix pelo WhatsApp em 10 segundos, use o app grátis do Micro no Controle.'])
    cp = wb.create_sheet('Contas a pagar'); cp.sheet_properties.tabColor = MINT
    banda(cp, 'Contas a pagar', 'Quando pagar, coloque a data do pagamento', ate=9)
    cabec(cp, 4, ['Vencimento', 'Conta', 'Fornecedor ou empresa', 'Categoria', 'Valor (R$)', 'Pago em', 'Situação', 'Dias para vencer', 'Observação'], [12, 26, 24, 18, 13, 12, 18, 10, 26])
    R1, R2 = 5, 504
    ex = [(d(2026, 11, 5), 'Aluguel', 'Imobiliária', 'Aluguel', 1800, d(2026, 11, 5)), (d(2026, 11, 20), 'DAS', 'Receita Federal', 'Imposto', 82.05, None),
          (d(2026, 11, 28), 'Conta de luz', 'Distribuidora', 'Energia', 410, None), (d(2026, 12, 3), 'Mercadorias', 'Atacado', 'Fornecedor', 1350, None),
          (d(2026, 12, 15), 'Internet', 'Operadora', 'Internet', 99.90, None)]
    for k, (a, b, c, e, v, p) in enumerate(ex):
        r = R1 + k
        for j, x in zip([1, 2, 3, 4, 5, 6], [a, b, c, e, v, p]):
            if x is not None: cp.cell(r, j, x)
    entrada(cp, f'A{R1}:A{R2}', DATA); entrada(cp, f'B{R1}:D{R2}'); entrada(cp, f'E{R1}:E{R2}', BRL); entrada(cp, f'F{R1}:F{R2}', DATA); entrada(cp, f'I{R1}:I{R2}')
    for r in range(R1, R2 + 1):
        cp[f'G{r}'] = f'=IF(OR(A{r}="",E{r}=""),"",IF(F{r}<>"","Paga",IF(A{r}<TODAY(),"Vencida",IF(A{r}-TODAY()<=7,"Vence em até 7 dias","Em dia"))))'
        cp[f'H{r}'] = f'=IF(OR(A{r}="",F{r}<>""),"",A{r}-TODAY())'
    calc(cp, f'G{R1}:G{R2}'); calc(cp, f'H{R1}:H{R2}', '0')
    status_cores(cp, f'G{R1}:G{R2}', [('Paga', *CINZA), ('Vencida', *VERM), ('7 dias', *AMAR), ('Em dia', *VERDE)])
    exemplo(cp, range(R1, R1 + len(ex)), 9); preparar(cp, 4, 9)
    fr = wb.create_sheet('A receber e fiado'); fr.sheet_properties.tabColor = MINT
    banda(fr, 'A receber e fiado', 'Anote quem deve; quando pagar, coloque quanto já recebeu', ate=10)
    cabec(fr, 4, ['Data', 'Cliente', 'WhatsApp', 'O que levou', 'Valor (R$)', 'Já recebido (R$)', 'Falta receber (R$)', 'Dias em aberto', 'Situação', 'Combinou pagar em'], [12, 24, 16, 26, 12, 13, 13, 10, 18, 14])
    ex2 = [(d(2026, 10, 12), 'Maria (vizinha)', '(61) 90000-0000', 'Marmitas da semana', 180, 100, None), (d(2026, 11, 3), 'João da oficina', '', 'Lanches', 64.50, 0, d(2026, 11, 30)),
           (d(2026, 11, 15), 'Ana', '', 'Encomenda de bolo', 120, 120, None)]
    for k, (a, b, c, e, v, rec, comb) in enumerate(ex2):
        r = R1 + k
        for j, x in zip([1, 2, 3, 4, 5, 6, 10], [a, b, c, e, v, rec, comb]):
            if x is not None: fr.cell(r, j, x)
    entrada(fr, f'A{R1}:A{R2}', DATA); entrada(fr, f'B{R1}:D{R2}'); entrada(fr, f'E{R1}:F{R2}', BRL); entrada(fr, f'J{R1}:J{R2}', DATA)
    for r in range(R1, R2 + 1):
        fr[f'G{r}'] = f'=IF(E{r}="","",MAX(0,E{r}-N(F{r})))'
        fr[f'H{r}'] = f'=IF(OR(A{r}="",G{r}=""),"",IF(G{r}=0,"",TODAY()-A{r}))'
        fr[f'I{r}'] = f'=IF(G{r}="","",IF(G{r}=0,"Quitado",IF(AND(J{r}<>"",J{r}<TODAY()),"Passou do combinado",IF(H{r}>30,"Mais de 30 dias","Em aberto"))))'
    calc(fr, f'G{R1}:G{R2}', BRL); calc(fr, f'H{R1}:H{R2}', '0'); calc(fr, f'I{R1}:I{R2}')
    status_cores(fr, f'I{R1}:I{R2}', [('Quitado', *CINZA), ('Passou', *VERM), ('30 dias', *VERM), ('Em aberto', *AMAR)])
    exemplo(fr, range(R1, R1 + len(ex2)), 10); preparar(fr, 4, 10)
    rs = wb.create_sheet('Resumo', 1); rs.sheet_properties.tabColor = DEEP
    banda(rs, 'Resumo de contas e fiado', 'Atualiza com a data de hoje', ate=8)
    rs.column_dimensions['A'].width = 3
    for c in 'BCDEFGH': rs.column_dimensions[c].width = 15
    P = lambda c: f"'Contas a pagar'!${c}${R1}:${c}${R2}"; Q = lambda c: f"'A receber e fiado'!${c}${R1}:${c}${R2}"
    kpi(rs, 4, 2, 'Contas vencidas', f'=SUMIFS({P("E")},{P("G")},"Vencida")', BRL, 2)
    kpi(rs, 4, 4, 'Vence em até 7 dias', f'=SUMIFS({P("E")},{P("G")},"Vence em até 7 dias")', BRL, 2)
    kpi(rs, 4, 6, 'Vence em até 30 dias', f'=SUMIFS({P("E")},{P("F")},"",{P("A")},">="&TODAY(),{P("A")},"<="&TODAY()+30)', BRL, 2)
    kpi(rs, 7, 2, 'Clientes te devem', f'=SUM({Q("G")})', BRL, 2)
    kpi(rs, 7, 4, 'Fiado com mais de 30 dias', f'=SUMIFS({Q("G")},{Q("I")},"Mais de 30 dias")+SUMIFS({Q("G")},{Q("I")},"Passou do combinado")', BRL, 2)
    kpi(rs, 7, 6, 'Clientes devendo', f'=COUNTIFS({Q("G")},">0")', '0', 2)
    cabec(rs, 11, ['', 'Mês', 'A pagar no mês', 'Já pago', 'Falta pagar'])
    rs.cell(11, 1).fill = PatternFill(None); rs.cell(11, 1).border = Border()
    for k in range(12):
        r = 12 + k; rs[f'B{r}'] = f'=DATE(YEAR(TODAY()),{k+1},1)'; rs[f'B{r}'].number_format = 'mmm/yyyy'
        rs[f'C{r}'] = f'=SUMIFS({P("E")},{P("A")},">="&B{r},{P("A")},"<="&EOMONTH(B{r},0))'
        rs[f'D{r}'] = f'=SUMIFS({P("E")},{P("A")},">="&B{r},{P("A")},"<="&EOMONTH(B{r},0),{P("F")},"<>")'
        rs[f'E{r}'] = f'=C{r}-D{r}'
    calc(rs, 'B12:E23', BRL)
    for r in range(12, 24): rs[f'B{r}'].number_format = 'mmm/yyyy'
    ch = BarChart(); ch.type = 'col'; ch.grouping = 'stacked'; ch.overlap = 100; ch.title = 'Contas por mês: pago e a pagar'
    ch.add_data(Reference(rs, min_col=4, max_col=5, min_row=11, max_row=23), titles_from_data=True)
    ch.set_categories(Reference(rs, min_col=2, min_row=12, max_row=23))
    ch.y_axis.numFmt = 'R$ #,##0'; ch.x_axis.numFmt = 'mmm'; ch.height = 7.5; ch.width = 16
    ch.series[0].graphicalProperties.solidFill = 'B9C7C6'; ch.series[1].graphicalProperties.solidFill = 'E4572E'
    grafico_ok(ch); rs.add_chart(ch, 'G11')
    return wb

# =====================================================================
# 5. ESTOQUE
# =====================================================================
def estoque():
    wb = Workbook()
    como_usar(wb, 'Controle de Estoque', 'Saiba quanto tem de cada produto, quanto vale o seu estoque, quanto custou em média cada item e o que precisa repor antes de faltar.',
        ['Na aba Produtos, cadastre cada item com um código curto, a unidade, o estoque mínimo e o preço de venda.',
         'Na aba Movimentos, anote cada entrada (compra) com quantidade e custo, e cada saída (venda, uso ou perda).',
         'Volte em Produtos: saldo, custo médio, valor em estoque, margem e o aviso de repor aparecem sozinhos.'],
        [('Produtos', 'Saldo, custo médio, valor em estoque e o que repor'), ('Movimentos', 'Cada entrada e saída de mercadoria')],
        ['Custo médio = tudo o que você pagou nas entradas ÷ quantidade que entrou.', 'Perdeu ou estragou? Lance como saída e escreva "perda" na observação.'])
    pr = wb.create_sheet('Produtos'); pr.sheet_properties.tabColor = DEEP
    banda(pr, 'Produtos e saldo', 'Cadastre os itens; o saldo vem dos movimentos', ate=12)
    cabec(pr, 4, ['Código', 'Produto', 'Unidade', 'Estoque mínimo', 'Entrou', 'Saiu', 'Saldo', 'Custo médio (R$)', 'Valor em estoque (R$)', 'Preço de venda (R$)', 'Margem (%)', 'Situação'],
          [10, 28, 9, 10, 9, 9, 9, 12, 14, 12, 10, 14])
    R1, R2 = 5, 304
    ex = [('P01', 'Pão de hambúrguer', 'un', 40, 0.85), ('P02', 'Hambúrguer 120 g', 'un', 30, 0), ('P03', 'Refrigerante lata', 'un', 12, 6.00), ('P04', 'Embalagem para viagem', 'un', 50, 0)]
    for k, row in enumerate(ex):
        for j, v in enumerate(row, 1):
            if j == 5:
                if v: pr.cell(R1 + k, 10, v)
            else: pr.cell(R1 + k, j, v)
    entrada(pr, f'A{R1}:C{R2}'); entrada(pr, f'D{R1}:D{R2}', '#,##0'); entrada(pr, f'J{R1}:J{R2}', BRL)
    M = lambda c: f'Movimentos!${c}$5:${c}$2004'
    for r in range(R1, R2 + 1):
        pr[f'E{r}'] = f'=IF(A{r}="","",SUMIFS({M("D")},{M("B")},A{r},{M("C")},"Entrada"))'
        pr[f'F{r}'] = f'=IF(A{r}="","",SUMIFS({M("D")},{M("B")},A{r},{M("C")},"Saída"))'
        pr[f'G{r}'] = f'=IF(A{r}="","",E{r}-F{r})'
        pr[f'H{r}'] = f'=IF(A{r}="","",IF(E{r}=0,0,SUMIFS({M("F")},{M("B")},A{r},{M("C")},"Entrada")/E{r}))'
        pr[f'I{r}'] = f'=IF(A{r}="","",MAX(0,G{r})*H{r})'
        pr[f'K{r}'] = f'=IF(OR(A{r}="",J{r}="",J{r}=0),"",(J{r}-H{r})/J{r})'
        pr[f'L{r}'] = f'=IF(A{r}="","",IF(G{r}<=0,"Sem estoque",IF(G{r}<=D{r},"Repor","OK")))'
    calc(pr, f'E{R1}:G{R2}', '#,##0'); calc(pr, f'H{R1}:I{R2}', BRL); calc(pr, f'K{R1}:K{R2}', PCT); calc(pr, f'L{R1}:L{R2}')
    status_cores(pr, f'L{R1}:L{R2}', [('OK', *VERDE), ('Repor', *AMAR), ('Sem estoque', *VERM)])
    exemplo(pr, range(R1, R1 + len(ex)), 12); preparar(pr, 4, 12)
    pr['N4'] = 'Valor total em estoque'; pr['N4'].font = font(bold=True, color=DEEP)
    pr['N5'] = f'=SUM(I{R1}:I{R2})'; pr['N5'].number_format = BRL; pr['N5'].font = font(size=14, bold=True, color=DEEP)
    pr['N7'] = 'Itens para repor'; pr['N7'].font = font(bold=True, color=DEEP)
    pr['N8'] = f'=COUNTIF(L{R1}:L{R2},"Repor")+COUNTIF(L{R1}:L{R2},"Sem estoque")'; pr['N8'].font = font(size=14, bold=True, color='B5301B')
    pr.column_dimensions['N'].width = 22
    mv = wb.create_sheet('Movimentos'); mv.sheet_properties.tabColor = MINT
    banda(mv, 'Movimentos', 'Cada compra é uma entrada; cada venda, uso ou perda é uma saída', ate=8)
    cabec(mv, 4, ['Data', 'Código', 'Entrada ou saída', 'Quantidade', 'Produto', 'Custo total da entrada (R$)', 'Custo unitário (R$)', 'Observação'], [12, 10, 14, 11, 28, 16, 13, 28])
    ex2 = [(d(2026, 11, 2), 'P01', 'Entrada', 120, 54.00), (d(2026, 11, 2), 'P02', 'Entrada', 100, 290.00), (d(2026, 11, 2), 'P03', 'Entrada', 48, 134.40),
           (d(2026, 11, 2), 'P04', 'Entrada', 200, 70.00), (d(2026, 11, 9), 'P01', 'Saída', 92, None), (d(2026, 11, 9), 'P02', 'Saída', 88, None),
           (d(2026, 11, 9), 'P03', 'Saída', 30, None), (d(2026, 11, 9), 'P04', 'Saída', 60, None)]
    for k, (a, b, c, q, ct) in enumerate(ex2):
        r = 5 + k
        for j, x in zip([1, 2, 3, 4, 6], [a, b, c, q, ct]):
            if x is not None: mv.cell(r, j, x)
    entrada(mv, 'A5:A2004', DATA); entrada(mv, 'B5:C2004'); entrada(mv, 'D5:D2004', '#,##0.##'); entrada(mv, 'F5:F2004', BRL); entrada(mv, 'H5:H2004')
    for r in range(5, 2005):
        mv[f'E{r}'] = f'=IF(B{r}="","",IFERROR(INDEX(Produtos!$B${R1}:$B${R2},MATCH(B{r},Produtos!$A${R1}:$A${R2},0)),"Código não cadastrado"))'
        mv[f'G{r}'] = f'=IF(OR(F{r}="",N(D{r})=0),"",F{r}/D{r})'
    calc(mv, 'E5:E2004'); calc(mv, 'G5:G2004', BRL)
    lista(mv, 'B5:B2004', f'=Produtos!$A${R1}:$A${R2}', 'Escolha o código do produto'); lista(mv, 'C5:C2004', '"Entrada,Saída"')
    status_cores(mv, 'E5:E2004', [('não cadastrado', *VERM)])
    exemplo(mv, range(5, 5 + len(ex2)), 8); preparar(mv, 4, 8)
    return wb

# =====================================================================
# 6. MEI EM DIA
# =====================================================================
def mei():
    wb = Workbook()
    como_usar(wb, 'MEI em Dia', 'Acompanhe o faturamento do ano contra o limite do MEI, veja a projeção até dezembro, controle o DAS de cada mês e não perca a declaração anual.',
        ['Na aba Configurar, escolha a sua atividade e o mês em que o MEI começou neste ano (1 se já existia em janeiro).',
         'Na aba Faturamento, anote todo mês quanto faturou com nota e sem nota, e marque se pagou o DAS.',
         'Acompanhe o quanto já usou do limite, a projeção do ano e os alertas. Antes de chegar perto do limite, converse com o seu contador.'],
        [('Faturamento', 'Faturamento do mês, acumulado, limite, DAS e alertas'), ('Configurar', 'Atividade, início no ano e valores de 2026')],
        ['Limite de 2026: R$ 81.000 no ano, ou R$ 6.750 por mês de atividade para quem abriu durante o ano.',
         'O DAS vence todo dia 20 do mês seguinte. Gere a guia no app MEI da Receita Federal ou no Portal do Empreendedor.',
         'Declaração anual (DASN-SIMEI): até 31 de maio, sobre o faturamento do ano anterior.',
         'A partir de 2027, o limite passa para R$ 110 mil por ano (lei sancionada em outubro de 2026). Atualize a aba Configurar quando virar o ano.'],
        fiscal=True)
    cf = wb.create_sheet('Configurar'); cf.sheet_properties.tabColor = MINT
    banda(cf, 'Configurar', 'Valores de 2026: confirme no Portal do Empreendedor', ate=4)
    for c, w in zip('ABCD', [40, 22, 4, 50]): cf.column_dimensions[c].width = w
    cf['A4'] = 'Ano'; cf['B4'] = 2026
    cf['A5'] = 'Atividade'; cf['B5'] = 'Comércio ou indústria'
    cf['A6'] = 'Mês em que o MEI começou neste ano (1 a 12)'; cf['B6'] = 1
    cf['A7'] = 'Limite anual do MEI (R$)'; cf['B7'] = 81000
    cf['A8'] = 'Limite proporcional deste ano'; cf['B8'] = '=B7/12*(13-B6)'
    cf['A9'] = 'DAS por mês para a sua atividade'; cf['B9'] = '=IFERROR(INDEX(B13:B15,MATCH(B5,A13:A15,0)),0)'
    for r in range(4, 10): cf[f'A{r}'].font = font(bold=True)
    entrada(cf, 'B4', '0'); entrada(cf, 'B5'); entrada(cf, 'B6', '0'); entrada(cf, 'B7', BRL)
    calc(cf, 'B8:B9', BRL, bold=True)
    lista(cf, 'B5', '=$A$13:$A$15');
    dv = DataValidation(type='whole', operator='between', formula1='1', formula2='12'); cf.add_data_validation(dv); dv.add('B6')
    cabec(cf, 12, ['Atividade', 'DAS 2026 (R$)'])
    for i, (a, b) in enumerate([('Comércio ou indústria', 82.05), ('Serviços', 86.05), ('Comércio e serviços', 87.05)], 13):
        cf.cell(i, 1, a); cf.cell(i, 2, b)
    entrada(cf, 'A13:A15'); entrada(cf, 'B13:B15', BRL)
    cf['D12'] = 'Fonte'; cf['D12'].font = font(bold=True)
    cf['D13'] = 'DAS 2026 = 5% do salário mínimo (R$ 1.621) + R$ 1 de ICMS e/ou R$ 5 de ISS.'
    cf['D14'] = 'Limite de 2026: R$ 81 mil. Em 2027: R$ 110 mil (lei sancionada em out/2026).'
    cf['D15'] = 'Confirme em gov.br/empresas-e-negocios (Portal do Empreendedor).'
    for r in (13, 14, 15): cf[f'D{r}'].font = font(size=9, color='58686B')
    fz = wb.create_sheet('Faturamento', 1); fz.sheet_properties.tabColor = DEEP
    banda(fz, '="Faturamento do MEI em "&Configurar!B4', 'Anote todo mês; o acumulado e os alertas aparecem sozinhos', ate=10)
    kpi(fz, 4, 1, 'Faturado no ano', '=E17', BRL, 2)
    kpi(fz, 4, 3, 'Usado do limite', '=IF(Configurar!B8=0,0,E17/Configurar!B8)', PCT, 2)
    kpi(fz, 4, 5, 'Projeção até dezembro', '=IF(COUNT(D5:D16)=0,0,SUM(D5:D16)/COUNT(D5:D16)*(13-Configurar!B6))', BRL, 2)
    kpi(fz, 4, 7, 'Ainda pode faturar', '=MAX(0,Configurar!B8-E17)', BRL, 2)
    fz.merge_cells('I4:J5')
    fz['I4'] = ('=IF(E17>Configurar!B8*1.2,"Passou mais de 20% do limite: fale com o contador já",IF(E17>Configurar!B8,"Passou do limite: fale com o contador",'
                'IF(OR(E17>=Configurar!B8*0.8,G4>Configurar!B8),"Atenção: perto do limite ou projeção acima","Dentro do limite")))')
    fz['I4'].alignment = Alignment(wrap_text=True, vertical='center', horizontal='center'); fz['I4'].font = font(bold=True)
    fz['I4'].border = BOX
    status_cores(fz, 'I4:J5', [('Dentro', *VERDE), ('Atenção', *AMAR), ('Passou', *VERM)])
    cabec(fz, 8, ['Mês', 'Com nota fiscal (R$)', 'Sem nota fiscal (R$)', 'Total do mês (R$)', 'Acumulado no ano (R$)', 'Usado do limite', 'DAS do mês (R$)', 'Vence em', 'Pagou o DAS?', 'Situação do DAS'],
          [10, 15, 15, 15, 16, 12, 12, 12, 12, 18])
    # reorganiza: linhas 9..20 meses; total 21
    base = 9
    ex = [5200, 6100, 5800, 6400, 7100, 6900, 7300, 6800, 7050, 7400]
    for k in range(12):
        r = base + k
        fz[f'A{r}'] = f'=DATE(Configurar!$B$4,{k+1},1)'; fz[f'A{r}'].number_format = 'mmm/yyyy'
        if k < len(ex): fz[f'B{r}'] = round(ex[k] * 0.35, 2); fz[f'C{r}'] = round(ex[k] * 0.65, 2); fz[f'I{r}'] = 'Sim'
        fz[f'D{r}'] = f'=IF(AND(B{r}="",C{r}=""),"",N(B{r})+N(C{r}))'
        fz[f'E{r}'] = f'=IF(D{r}="","",SUM($D${base}:D{r}))'
        fz[f'F{r}'] = f'=IF(OR(E{r}="",Configurar!$B$8=0),"",E{r}/Configurar!$B$8)'
        fz[f'G{r}'] = f'=IF({k+1}<Configurar!$B$6,"",Configurar!$B$9)'
        fz[f'H{r}'] = f'=IF(G{r}="","",DATE(Configurar!$B$4,{k+2},20))'
        fz[f'J{r}'] = f'=IF(G{r}="","",IF(I{r}="Sim","Pago",IF(TODAY()>H{r},"Atrasado",IF(H{r}-TODAY()<=10,"Vence logo","A pagar"))))'
    entrada(fz, f'B{base}:C{base+11}', BRL); entrada(fz, f'I{base}:I{base+11}')
    calc(fz, f'A{base}:A{base+11}', 'mmm/yyyy'); calc(fz, f'D{base}:E{base+11}', BRL); calc(fz, f'F{base}:F{base+11}', PCT)
    calc(fz, f'G{base}:G{base+11}', BRL); calc(fz, f'H{base}:H{base+11}', DATA); calc(fz, f'J{base}:J{base+11}')
    lista(fz, f'I{base}:I{base+11}', '"Sim,Não"')
    status_cores(fz, f'J{base}:J{base+11}', [('Pago', *VERDE), ('Atrasado', *VERM), ('logo', *AMAR), ('A pagar', *CINZA)])
    fz.conditional_formatting.add(f'F{base}:F{base+11}', DataBarRule(start_type='num', start_value=0, end_type='num', end_value=1, color='E4572E'))
    tot = base + 12
    fz[f'A{tot}'] = 'Total'; fz[f'B{tot}'] = f'=SUM(B{base}:B{base+11})'; fz[f'C{tot}'] = f'=SUM(C{base}:C{base+11})'; fz[f'D{tot}'] = f'=SUM(D{base}:D{base+11})'
    fz[f'G{tot}'] = f'=SUMIFS(G{base}:G{base+11},I{base}:I{base+11},"Sim")'; fz[f'H{tot}'] = 'DAS pago'
    for c in 'ABCDEFGHIJ':
        fz[f'{c}{tot}'].font = font(bold=True); fz[f'{c}{tot}'].fill = fill(SUB); fz[f'{c}{tot}'].border = BOX
    for c in 'BCDG': fz[f'{c}{tot}'].number_format = BRL
    exemplo(fz, range(base, base + len(ex)), 10)
    # KPIs apontam para o total
    fz['A5'] = f'=D{tot}'; fz['C5'] = f'=IF(Configurar!B8=0,0,D{tot}/Configurar!B8)'
    fz['E5'] = f'=IF(COUNT(D{base}:D{base+11})=0,0,SUM(D{base}:D{base+11})/COUNT(D{base}:D{base+11})*(13-Configurar!B6))'
    fz['G5'] = f'=MAX(0,Configurar!B8-D{tot})'
    fz['I4'] = (f'=IF(D{tot}>Configurar!B8*1.2,"Passou mais de 20% do limite: fale com o contador já",IF(D{tot}>Configurar!B8,"Passou do limite: fale com o contador",'
                f'IF(OR(D{tot}>=Configurar!B8*0.8,E5>Configurar!B8),"Atenção: perto do limite ou projeção acima","Dentro do limite")))')
    fz[f'A{tot+2}'] = 'Lembretes: DAS todo dia 20 · Declaração anual (DASN-SIMEI) até 31/05 · Guarde o relatório mensal de receitas brutas com as notas de compra.'
    fz[f'A{tot+2}'].font = font(size=9, color='58686B')
    fz.freeze_panes = 'B9'
    ch = BarChart(); ch.type = 'col'; ch.title = 'Faturamento por mês'
    ch.add_data(Reference(fz, min_col=4, min_row=8, max_row=base + 11), titles_from_data=True)
    ch.set_categories(Reference(fz, min_col=1, min_row=base, max_row=base + 11))
    ch.y_axis.numFmt = 'R$ #,##0'; ch.x_axis.numFmt = 'mmm'; ch.height = 7; ch.width = 16; ch.legend = None
    ch.series[0].graphicalProperties.solidFill = MINT
    grafico_ok(ch); fz.add_chart(ch, f'A{tot+4}')
    fz.page_setup.orientation = 'landscape'; fz.page_setup.fitToWidth = 1; fz.sheet_properties.pageSetUpPr.fitToPage = True
    return wb

# =====================================================================
# 7. FECHAMENTO DE CAIXA
# =====================================================================
def fechamento():
    wb = Workbook()
    como_usar(wb, 'Fechamento de Caixa', 'Feche o caixa todo dia em 2 minutos: veja se o dinheiro na gaveta bateu, quanto vendeu em cada forma de pagamento e, no fim do mês, quanto faltou e em quais dias.',
        ['Na aba Configurar, coloque o mês e os nomes de quem fecha o caixa.',
         'Todo dia, na aba Caixa do mês, anote o troco que começou, as vendas por forma de pagamento, as retiradas e as despesas pagas com o dinheiro da gaveta.',
         'Conte o dinheiro e anote. A planilha mostra se bateu, faltou ou sobrou.',
         'No fim do mês, abra o Resumo: total vendido por forma, dias com diferença e a diferença por responsável.'],
        [('Resumo', 'Vendas do mês, diferenças e quem fechou'), ('Caixa do mês', 'Um dia por linha'), ('Configurar', 'Mês e responsáveis')],
        ['Dinheiro esperado na gaveta = troco inicial + vendas em dinheiro − retiradas − despesas pagas no caixa.',
         'Retirada é o dinheiro tirado da gaveta para guardar, depositar ou pagar algo fora do caixa. Anote sempre: retirada sem registro vira "falta".'])
    cf = wb.create_sheet('Configurar'); cf.sheet_properties.tabColor = MINT
    banda(cf, 'Configurar', 'Mês e quem fecha o caixa', ate=3)
    cf.column_dimensions['A'].width = 30; cf.column_dimensions['B'].width = 22
    cf['A4'] = 'Primeiro dia do mês'; cf['B4'] = d(2026, 11, 1); entrada(cf, 'B4', DATA); cf['A4'].font = font(bold=True)
    cf['A5'] = 'Tolerância de diferença (R$)'; cf['B5'] = 2; entrada(cf, 'B5', BRL); cf['A5'].font = font(bold=True)
    cabec(cf, 7, ['Responsáveis'])
    for i, n in enumerate(['Ana', 'Bruno', 'Carla'], 8): cf.cell(i, 1, n)
    entrada(cf, 'A8:A17')
    cx = wb.create_sheet('Caixa do mês'); cx.sheet_properties.tabColor = MINT
    banda(cx, 'Caixa do mês', '="Mês de referência: "&MONTH(Configurar!B4)&"/"&YEAR(Configurar!B4)', ate=15)
    cabec(cx, 4, ['Data', 'Responsável', 'Troco inicial', 'Dinheiro', 'Cartão', 'Pix', 'Aplicativo', 'Vale-refeição', 'Total vendido', 'Retiradas', 'Despesas pagas no caixa',
                  'Esperado na gaveta', 'Dinheiro contado', 'Diferença', 'Situação'],
          [12, 14, 11, 11, 11, 11, 11, 11, 12, 11, 12, 12, 12, 11, 12])
    R1, R2 = 5, 35
    ex = [('Ana', 200, 640, 1820, 950, 720, 180, 300, 45, 495), ('Bruno', 200, 580, 1650, 1010, 610, 120, 250, 0, 520), ('Ana', 200, 710, 2100, 1200, 830, 210, 400, 60, 450)]
    for k in range(31):
        r = R1 + k
        cx[f'A{r}'] = f'=IF(MONTH(Configurar!$B$4+{k})=MONTH(Configurar!$B$4),Configurar!$B$4+{k},"")'
    # coloca colunas certas para exemplo (J retiradas, K despesas, M contado)
    for k, row in enumerate(ex):
        r = R1 + k
        cx[f'B{r}'] = row[0]; cx[f'C{r}'] = row[1]; cx[f'D{r}'] = row[2]; cx[f'E{r}'] = row[3]; cx[f'F{r}'] = row[4]; cx[f'G{r}'] = row[5]; cx[f'H{r}'] = row[6]
        cx[f'J{r}'] = row[7]; cx[f'K{r}'] = row[8]; cx[f'M{r}'] = row[9]
    calc(cx, f'A{R1}:A{R2}', 'ddd dd/mm')
    entrada(cx, f'B{R1}:B{R2}'); entrada(cx, f'C{R1}:H{R2}', BRL); entrada(cx, f'J{R1}:K{R2}', BRL); entrada(cx, f'M{R1}:M{R2}', BRL)
    for r in range(R1, R2 + 1):
        cx[f'I{r}'] = f'=IF(COUNT(D{r}:H{r})=0,"",SUM(D{r}:H{r}))'
        cx[f'L{r}'] = f'=IF(COUNT(C{r}:D{r})=0,"",N(C{r})+N(D{r})-N(J{r})-N(K{r}))'
        cx[f'N{r}'] = f'=IF(OR(M{r}="",L{r}=""),"",M{r}-L{r})'
        cx[f'O{r}'] = f'=IF(N{r}="","",IF(ABS(N{r})<=Configurar!$B$5,"Bateu",IF(N{r}<0,"Faltou","Sobrou")))'
    calc(cx, f'I{R1}:I{R2}', BRL, bold=True); calc(cx, f'L{R1}:L{R2}', BRL); calc(cx, f'N{R1}:N{R2}', BRL, bold=True); calc(cx, f'O{R1}:O{R2}')
    lista(cx, f'B{R1}:B{R2}', '=Configurar!$A$8:$A$17')
    status_cores(cx, f'O{R1}:O{R2}', [('Bateu', *VERDE), ('Faltou', *VERM), ('Sobrou', *AMAR)])
    tot = R2 + 1
    cx[f'A{tot}'] = 'Total'
    for c in 'CDEFGHIJKMN': cx[f'{c}{tot}'] = f'=SUM({c}{R1}:{c}{R2})'
    for c in 'ABCDEFGHIJKLMNO':
        cx[f'{c}{tot}'].font = font(bold=True); cx[f'{c}{tot}'].fill = fill(SUB); cx[f'{c}{tot}'].border = BOX
        if c not in 'ABO': cx[f'{c}{tot}'].number_format = BRL
    exemplo(cx, range(R1, R1 + len(ex)), 15); preparar(cx, 4, 15)
    rs = wb.create_sheet('Resumo', 1); rs.sheet_properties.tabColor = DEEP
    banda(rs, 'Resumo do caixa', 'Atualiza sozinho com os fechamentos do mês', ate=8)
    rs.column_dimensions['A'].width = 3; rs.column_dimensions['B'].width = 22
    for c in 'CDEFGH': rs.column_dimensions[c].width = 14
    C = lambda c: f"'Caixa do mês'!${c}${R1}:${c}${R2}"
    kpi(rs, 4, 2, 'Vendido no mês', f"='Caixa do mês'!I{tot}", BRL, 1)
    kpi(rs, 4, 3, 'Diferença total', f"='Caixa do mês'!N{tot}", BRL, 2)
    kpi(rs, 4, 5, 'Dias com falta', f'=COUNTIF({C("O")},"Faltou")', '0', 2)
    kpi(rs, 4, 7, 'Maior falta', f'=IF(MIN({C("N")})<0,MIN({C("N")}),0)', BRL, 2)
    cabec(rs, 8, ['', 'Forma de pagamento', 'Vendido', 'Parte do total'])
    rs.cell(8, 1).fill = PatternFill(None); rs.cell(8, 1).border = Border()
    for i, (nome, col) in enumerate([('Dinheiro', 'D'), ('Cartão', 'E'), ('Pix', 'F'), ('Aplicativo', 'G'), ('Vale-refeição', 'H')]):
        r = 9 + i; rs[f'B{r}'] = nome; rs[f'C{r}'] = f"='Caixa do mês'!{col}{tot}"; rs[f'D{r}'] = f'=IF($C$14=0,0,C{r}/$C$14)'
    rs['B14'] = 'Total'; rs['C14'] = '=SUM(C9:C13)'; rs['D14'] = '=SUM(D9:D13)'
    calc(rs, 'B9:B14'); calc(rs, 'C9:C14', BRL); calc(rs, 'D9:D14', PCT)
    for c in 'BCD': rs[f'{c}14'].font = font(bold=True); rs[f'{c}14'].fill = fill(SUB)
    cabec(rs, 17, ['', 'Responsável', 'Dias fechados', 'Diferença (R$)', 'Dias com falta'])
    rs.cell(17, 1).fill = PatternFill(None); rs.cell(17, 1).border = Border()
    for i in range(10):
        r = 18 + i
        rs[f'B{r}'] = f'=IF(Configurar!A{8+i}="","",Configurar!A{8+i})'
        rs[f'C{r}'] = f'=IF(B{r}="","",COUNTIFS({C("B")},B{r},{C("O")},"<>"))'
        rs[f'D{r}'] = f'=IF(B{r}="","",SUMIFS({C("N")},{C("B")},B{r}))'
        rs[f'E{r}'] = f'=IF(B{r}="","",COUNTIFS({C("B")},B{r},{C("O")},"Faltou"))'
    calc(rs, 'B18:C27'); calc(rs, 'D18:D27', BRL); calc(rs, 'E18:E27', '0')
    rs.conditional_formatting.add('D18:D27', CellIsRule(operator='lessThan', formula=['0'], font=Font(name=F, size=10, bold=True, color='B5301B'), fill=fill('FCE3DE')))
    ch = BarChart(); ch.type = 'bar'; ch.title = 'Vendas por forma de pagamento'
    ch.add_data(Reference(rs, min_col=3, min_row=8, max_row=13), titles_from_data=True)
    ch.set_categories(Reference(rs, min_col=2, min_row=9, max_row=13))
    ch.x_axis.numFmt = 'R$ #,##0'; ch.height = 7; ch.width = 13; ch.legend = None
    ch.series[0].graphicalProperties.solidFill = MINT
    grafico_ok(ch); rs.add_chart(ch, 'G8')
    return wb

ARQ = [('gestao-do-mes', gestao), ('conferencia-de-recebimentos', conferencia), ('preco-e-margem', preco), ('contas-e-fiado', contas),
       ('controle-de-estoque', estoque), ('mei-em-dia', mei), ('fechamento-de-caixa', fechamento)]
for nome, fn in ARQ:
    wb = fn()
    wb.properties.creator = 'Micro no Controle'; wb.properties.title = nome.replace('-', ' ').title()
    wb.active = 0
    p = os.path.join(OUT, f'{nome}-micro-no-controle.xlsx'); wb.save(p); print('ok', p)
