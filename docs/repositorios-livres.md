# Repositórios livres para o Micro no Controle

Lista viva. O radar semanal (segunda, 19h31) procura novidades e sugere entradas aqui.
Regra: só licenças livres (MIT, Apache-2.0, BSD, LGPL). AGPL/FSL só para uso interno, nunca revendido.
Nada de WhatsApp não oficial (Z-API, Evolution API, Baileys). Nomes e exemplos sempre genéricos de MEI.

## Fiscal e contábil (ajuda o contador)
| Repositório | Para quê | Onde entra no Micro |
|---|---|---|
| github.com/ReceitaFederal/calculadora-rtc-regime-regular (MIT) | Cálculo oficial de IBS/CBS no regime regular | Simulador de IBS/CBS e ensinamentos diários |
| github.com/ReceitaFederal/calculadora-rtc-simples-nacional (MIT) | IBS/CBS para Simples Nacional | "Quanto muda para mim" na reforma |
| github.com/ReceitaFederal/calculadora-rtc-gerador-danfse (MIT) | Gera DANFSe (NFS-e) | Conferência e explicação de nota de serviço |
| github.com/gabrielbuzziv/emissor-nfse-nacional (MIT) | Emite NFS-e no sistema nacional, roda na Cloudflare | Teste em conta de homologação antes de usar (projeto de nov/2026) |
| github.com/thiagopatzdorf/nota-aberta (MIT) | NFS-e + calculadora oficial, em Python | Plano B do emissor acima |
| github.com/nfephp-org/sped-nfe (LGPL/GPL/MIT) | NF-e e NFC-e: montar, assinar, validar XML | Ler XML de notas, devolução, conferência |
| github.com/TadaSoftware/PyNFe (LGPL) | NF-e/NFC-e/NFS-e em Python | Robôs do fechamento automático |
| Pacote de exportação para o contador (a fazer) | Mês organizado em planilha padrão + XMLs | Botão "Pacote para o contador" |

## Dinheiro, bancos e Pix
| Repositório | Para quê | Onde entra |
|---|---|---|
| ofxparse (MIT, Python) | Ler extrato OFX | Já usado no fechamento |
| pandas (BSD) | Cálculos do fechamento | Já usado |
| Bibliotecas de Pix copia e cola / QR (várias MIT) | Gerar Pix sem custo | Fiado e sinal da agenda (já no app) |
| BrasilAPI (MIT) | CNPJ, bancos, feriados, CEP | Preencher cadastro pelo CNPJ; feriados no conferidor |
| github.com/Maxwbh/cobranca-api (MIT) | Pix Automático, boleto e OFX de C6, Sicoob, Inter e Itaú | Só referência de estudo (pouco usado) |
| Conciliador próprio (conferir/conciliador.js) | Vendas da maquininha × extrato OFX/CSV/Excel, no navegador | Motor da conferência (24/11/2026) |

## Atendimento e automação
| Repositório | Para quê | Observação |
|---|---|---|
| Chatwoot (MIT, núcleo) | Caixa única: WhatsApp oficial, Instagram, site | Quando houver atendentes |
| Typebot | Fluxos de conversa com botões e IA | Licença com regras para revenda |
| n8n | Automação (Hotmart → WhatsApp → plano liberado) | Licença "fair-code": uso interno ok |
| WhatsApp Cloud API oficial (Meta) | Responder grátis quem chamou | Base do "Atendente no WhatsApp" |

## Documentos e artes
| Repositório | Para quê | Onde entra |
|---|---|---|
| ReportLab (BSD) | PDF do relatório mensal | Já usado |
| Playwright (Apache-2.0) | Artes e cardápios HTML → PNG/PDF | Já usado |
| openpyxl (MIT) | Planilhas do acervo | Acervo e kit |

## Ideias de planilhas
Inspiração em modelos genéricos para pequenos negócios (Etsy, templates públicos): orçamento,
fluxo de caixa, precificação, controle de estoque, agenda de clientes, metas de vendas,
controle de fiado, planejamento de promoções. Nunca usar termos ou casos específicos de um
empregador: só vocabulário comum de MEI.

## Decisões do radar de 23/11/2026
- Calculadora RTC do Simples (Receita, MIT, Java): fica para quando houver servidor; hoje o site não roda Java.
- Emissor NFS-e nacional: testar em homologação quando o primeiro cliente de serviço pedir. Não entra antes da validação.
- Custo do WhatsApp (confirmado na documentação oficial da Meta): desde 01/10/2026, 1.000 respostas de atendimento grátis por mês por número; da 1.001ª em diante, paga. Respostas de utilidade dentro da janela também passaram a ser cobradas. Pagamento em reais disponível desde julho/2026. Para menos de 30 clientes, não muda a conta.
