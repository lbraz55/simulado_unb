# Simulado UnB — Vestibular Tradicional (padrão Cebraspe)

Simulador de provas feito só com **HTML5, CSS3 e JavaScript puro**. Não usa backend nem dependências.

## Como abrir

### Como Web App instalável (recomendado)
O projeto é um **PWA**: depois de publicado, pode ser instalado no celular ou no computador como um aplicativo e funciona mesmo sem internet.

1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Selecione a branch **`main`**, a pasta **`/ (root)`** e clique em **Save**.
4. Depois de 1 ou 2 minutos, o app fica disponível em **https://lbraz55.github.io/simulado_unb/**
5. Para instalar:
   - **Android (Chrome):** botão **⤓ Instalar app** no topo, ou menu ⋮ → *Instalar app*.
   - **iPhone/iPad (Safari):** Compartilhar (□↑) → *Adicionar à Tela de Início*.
   - **Computador (Chrome/Edge):** botão **⤓ Instalar app** ou o ícone de instalar na barra de endereço.

### Direto no computador
Baixe o repositório (**Code → Download ZIP**), descompacte e abra o `index.html` com um duplo clique. Funciona pelo `file://`, só sem a instalação e sem o modo offline.

> Abrir o `index.html` pelo site do GitHub mostra apenas o código. Para usar o app, é preciso o GitHub Pages ou baixar os arquivos.

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura das telas: lobby, prova e resultado |
| `style.css` | Visual (variáveis CSS, Grid/Flexbox, tema claro/escuro, responsivo, impressão) |
| `questoes.js` | Banco padrão (`window.BANCO_PADRAO`): 1º e 2º dia, com itens A, B, C e D |
| `app.js` | Estado, montagem da prova, cronômetro, persistência, correção, relatório e instalação do app |
| `manifest.webmanifest` | Nome, cores e ícones do Web App |
| `sw.js` | Service worker: guarda os arquivos para uso offline (aumente `VERSAO` ao alterar o app) |
| `icons/` | Ícones do aplicativo |

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
