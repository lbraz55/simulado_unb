# Simulado UnB — Vestibular Tradicional (padrão Cebraspe)

Simulador de provas feito só com **HTML5, CSS3 e JavaScript puro**. Não usa backend nem dependências.

## Como executar
Abra o `index.html` no navegador com um duplo clique. Funciona direto pelo `file://`.

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura das telas: lobby, prova e resultado |
| `style.css` | Visual (variáveis CSS, Grid/Flexbox, tema claro/escuro, responsivo, impressão) |
| `questoes.js` | Banco padrão (`window.BANCO_PADRAO`): 1º e 2º dia, com itens A, B, C e D |
| `app.js` | Estado, montagem da prova, cronômetro, persistência, correção e relatório |

## Regras implementadas
| Tipo | Acerto | Erro | Branco |
|---|---|---|---|
| A — Certo/Errado | +1 | −1 | 0 |
| B — Numérica 000–999 | +2 | 0 | 0 |
| C — Múltipla escolha | +2 | −0,667 | 0 |
| D — Discursiva | 0 a 3 (você mesmo atribui a nota, comparando com o espelho da banca) | — | 0 |

Nota líquida = soma dos acertos − descontos dos erros nos itens A e C.

## Adicionar provas oficiais
1. No lobby, clique em **Baixar modelo JSON**.
2. Transcreva a prova do PDF do Cebraspe seguindo o formato do modelo (o formato também está documentado no início de `questoes.js`).
3. Em **Importar provas (JSON)**, escolha o arquivo, arraste-o para a área indicada ou cole o conteúdo.

Observações sobre o formato:
- `dia`: `1`, `2` ou `0` (prova avulsa, usada só no simulado rápido).
- Blocos com `"lingua": "ingles" | "espanhol" | "frances"` aparecem apenas para quem escolher essa língua.
- Os textos aceitam HTML simples (`<p>`, `<em>`, `<sub>`, `<img>`…). Scripts são removidos.
- Uma prova importada com o mesmo `id` de outra já existente a substitui.

As provas importadas ficam no `localStorage` do navegador. Use **Exportar banco completo** para guardar uma cópia de segurança.

## Persistência
Ficam salvos automaticamente: respostas, alternativas riscadas, itens marcados com "?", bloco atual, tempo restante, notas dos itens discursivos, histórico de notas, tema e tamanho da fonte.

> As questões incluídas são autorais e didáticas, inspiradas no estilo da UnB/Cebraspe. Este projeto não tem vínculo com a UnB nem com o Cebraspe.
