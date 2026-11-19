/* =====================================================================
   questoes.js — Banco de questões padrão do Simulado UnB (Cebraspe)
   ---------------------------------------------------------------------
   Estrutura (a mesma aceita pela função "Importar JSON"):

   {
     "provas": [{
       "id": "identificador-unico",
       "titulo": "Nome da prova",
       "dia": 1 | 2 | 0,            // 0 = prova avulsa (usada só no simulado rápido)
       "duracaoMin": 300,
       "blocos": [{
         "id": "id-do-bloco",
         "disciplina": "Língua Portuguesa",
         "area": "Linguagens",
         "lingua": "ingles",         // opcional: ingles | espanhol | frances
         "titulo": "Título do texto",
         "texto": "<p>HTML do texto-base</p>",
         "fonte": "Referência do texto",
         "itens": [
           { "tipo": "A", "enunciado": "...", "gabarito": "C" | "E", "justificativa": "..." },
           { "tipo": "B", "enunciado": "...", "gabarito": 42, "justificativa": "..." },
           { "tipo": "C", "enunciado": "...", "alternativas": ["...","...","...","..."],
             "gabarito": "A" | "B" | "C" | "D", "justificativa": "..." },
           { "tipo": "D", "enunciado": "...", "maxLinhas": 20, "espelho": "<p>Padrão de resposta</p>" }
         ]
       }]
     }]
   }

   As questões abaixo são AUTORAIS, elaboradas para fins didáticos no
   estilo do Vestibular Tradicional da UnB (Cebraspe). Para usar provas
   oficiais, transcreva-as dos PDFs do Cebraspe e importe pelo lobby.
   ===================================================================== */

window.BANCO_PADRAO = {
  formato: 'simulado-unb',
  versao: 1,
  provas: [
    /* =================================================================
       1º DIA — Língua Estrangeira + Linguagens e Ciências Humanas
       ================================================================= */
    {
      id: 'unb-modelo-dia1',
      titulo: 'Simulado UnB — Modelo Cebraspe · 1º Dia',
      dia: 1,
      duracaoMin: 300,
      blocos: [
        /* ---------------- Língua Inglesa ---------------- */
        {
          id: 'd1-ingles',
          disciplina: 'Língua Inglesa',
          area: 'Língua Estrangeira',
          lingua: 'ingles',
          titulo: 'Cities that breathe',
          texto: `
<p>When Brasília was inaugurated in 1960, its planners imagined a capital organized around wide avenues and generous green spaces. More than six decades later, urban researchers argue that the greatest challenge for modern cities is no longer how to move cars, but how to keep people cool. Heat waves are becoming longer and more frequent, and dense neighborhoods with little vegetation can be several degrees warmer than nearby parks — a phenomenon known as the <em>urban heat island effect</em>.</p>
<p>Some solutions are surprisingly simple. Planting trees along sidewalks, painting roofs in light colors and restoring small streams that had been buried under concrete can reduce local temperatures significantly. However, experts warn that such measures must reach poorer districts too; otherwise, green infrastructure may become a privilege rather than a public good.</p>
<p>“A city that only shades its wealthiest streets has not solved the problem,” says one researcher. “It has merely moved it.”</p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'According to the text, urban researchers believe that the main challenge for modern cities is still how to manage car traffic.', gabarito: 'E', justificativa: 'O texto afirma o contrário: o maior desafio “is no longer how to move cars, but how to keep people cool”.' },
            { tipo: 'A', enunciado: 'The urban heat island effect refers to the fact that densely built areas with little vegetation may be warmer than nearby green areas.', gabarito: 'C', justificativa: 'É exatamente a definição dada no primeiro parágrafo: “dense neighborhoods with little vegetation can be several degrees warmer than nearby parks”.' },
            { tipo: 'A', enunciado: 'In the second paragraph, the word “However” introduces an idea that qualifies or contrasts with what was previously stated.', gabarito: 'C', justificativa: '“However” é conector adversativo: após apresentar soluções simples, o autor introduz uma ressalva (as medidas devem chegar aos bairros pobres).' },
            { tipo: 'A', enunciado: 'The researcher quoted in the last paragraph considers that shading only the wealthiest streets is an adequate solution to urban heat.', gabarito: 'E', justificativa: 'O pesquisador diz que essa cidade “has not solved the problem. It has merely moved it” — ou seja, a solução é inadequada.' },
            { tipo: 'C', enunciado: 'The expression “a privilege rather than a public good” (second paragraph) suggests that green infrastructure', alternativas: ['should be restricted to the central districts of a city.', 'might benefit only part of the population if it is poorly distributed.', 'is too expensive to be implemented in any district.', 'has already been removed from poorer neighborhoods.'], gabarito: 'B', justificativa: 'O alerta é que, se as medidas não chegarem aos bairros pobres, beneficiarão apenas parte da população (privilégio), e não todos (bem público).' }
          ]
        },
        /* ---------------- Língua Espanhola ---------------- */
        {
          id: 'd1-espanhol',
          disciplina: 'Língua Espanhola',
          area: 'Língua Estrangeira',
          lingua: 'espanhol',
          titulo: 'La lengua que nos une',
          texto: `
<p>En las ciudades fronterizas entre Brasil y sus vecinos hispanohablantes, no es raro escuchar conversaciones en las que el portugués y el español se mezclan con naturalidad. Lejos de ser un “error”, ese fenómeno —que algunos llaman <em>portuñol</em>— revela la creatividad de hablantes que comparten mercados, escuelas y familias.</p>
<p>Sin embargo, durante mucho tiempo, la escuela trató esas mezclas como algo que debía corregirse. Hoy, muchos lingüistas defienden que la enseñanza de lenguas en la frontera parta de la realidad de los alumnos, valorando sus repertorios en lugar de silenciarlos. Aprender otra lengua, dicen, no significa abandonar la propia, sino ampliar las maneras de estar en el mundo.</p>`,
          fonte: 'Texto elaborado para fines didácticos.',
          itens: [
            { tipo: 'A', enunciado: 'Según el texto, la mezcla entre portugués y español en las ciudades fronterizas es presentada exclusivamente como un error que debe ser eliminado.', gabarito: 'E', justificativa: 'El texto dice “Lejos de ser un error”; la mezcla revela creatividad. La visión de “corregir” se atribuye a la escuela del pasado.' },
            { tipo: 'A', enunciado: 'La expresión “Sin embargo” (segundo párrafo) podría sustituirse por “No obstante” sin perjuicio del sentido original del texto.', gabarito: 'C', justificativa: 'Ambas son locuciones adversativas equivalentes.' },
            { tipo: 'A', enunciado: 'Se infiere del texto que los lingüistas mencionados defienden que los alumnos abandonen su lengua materna para aprender una segunda lengua.', gabarito: 'E', justificativa: 'Al contrario: “Aprender otra lengua [...] no significa abandonar la propia”.' },
            { tipo: 'A', enunciado: 'En “valorando sus repertorios en lugar de silenciarlos”, el pronombre “los” se refiere a “repertorios”.', gabarito: 'C', justificativa: 'Silenciar los repertorios: “los” retoma “sus repertorios”.' },
            { tipo: 'C', enunciado: 'De acuerdo con el texto, aprender otra lengua significa', alternativas: ['sustituir la lengua materna por una más prestigiosa.', 'corregir las mezclas lingüísticas de la frontera.', 'ampliar las maneras de estar en el mundo.', 'limitarse a los contenidos del ámbito escolar.'], gabarito: 'C', justificativa: 'Paráfrasis directa de la última oración del texto.' }
          ]
        },
        /* ---------------- Língua Francesa ---------------- */
        {
          id: 'd1-frances',
          disciplina: 'Língua Francesa',
          area: 'Língua Estrangeira',
          lingua: 'frances',
          titulo: 'La lecture à l’ère numérique',
          texto: `
<p>Selon plusieurs enquêtes récentes, les jeunes lisent toujours, mais autrement. Les écrans ont transformé la manière dont on accède aux textes : on lit des fragments, on passe d’un lien à l’autre, on partage des citations. Certains chercheurs s’inquiètent de la perte de la lecture lente et profonde, celle qui exige du temps et de la concentration.</p>
<p>D’autres, en revanche, rappellent que chaque nouvelle technologie a suscité des craintes semblables. Pour eux, l’enjeu n’est pas de choisir entre le papier et l’écran, mais d’apprendre aux lecteurs à adapter leur façon de lire selon leurs objectifs.</p>`,
          fonte: 'Texte élaboré à des fins didactiques.',
          itens: [
            { tipo: 'A', enunciado: 'D’après le texte, les jeunes ont complètement arrêté de lire.', gabarito: 'E', justificativa: '« les jeunes lisent toujours, mais autrement ».' },
            { tipo: 'A', enunciado: 'L’expression « en revanche » (deuxième paragraphe) introduit une opposition par rapport aux chercheurs mentionnés dans le premier paragraphe.', gabarito: 'C', justificativa: '« En revanche » marque l’opposition entre les chercheurs inquiets et ceux qui relativisent.' },
            { tipo: 'A', enunciado: 'Selon certains chercheurs, la lecture sur écran favorise la lecture lente et profonde.', gabarito: 'E', justificativa: 'Ils s’inquiètent justement de la « perte » de ce type de lecture.' },
            { tipo: 'A', enunciado: 'Dans « celle qui exige du temps », le pronom « celle » reprend le mot « lecture ».', gabarito: 'C', justificativa: '« celle » = la lecture lente et profonde.' },
            { tipo: 'C', enunciado: 'Pour les chercheurs mentionnés dans le deuxième paragraphe, l’enjeu principal est de', alternativas: ['interdire les écrans dans les écoles.', 'revenir exclusivement au livre imprimé.', 'prouver que les craintes actuelles sont justifiées.', 'apprendre aux lecteurs à adapter leur lecture à leurs objectifs.'], gabarito: 'D', justificativa: 'Reprise directe de la dernière phrase du texte.' }
          ]
        },
        /* ---------------- Língua Portuguesa ---------------- */
        {
          id: 'd1-portugues',
          disciplina: 'Língua Portuguesa e Literatura',
          area: 'Linguagens',
          titulo: 'Texto I — Monumento e moradia',
          texto: `
<p>A cidade de Brasília costuma ser descrita por quem a visita pela primeira vez como um lugar de horizontes. O céu, dizem, ocupa ali mais espaço do que em outras capitais. Essa impressão, no entanto, não nasce apenas da geografia do Planalto Central: ela é também produto de um projeto urbanístico que, ao afastar os edifícios uns dos outros e limitar sua altura, transformou o vazio em elemento de composição.</p>
<p>Para muitos moradores, porém, o mesmo vazio que encanta o turista é vivido como distância. Atravessar a cidade a pé pode ser uma tarefa longa, e o transporte coletivo nem sempre acompanha o ritmo das necessidades cotidianas. Assim, a cidade que se oferece à contemplação é também aquela que exige, de quem nela vive, estratégias diárias de deslocamento.</p>
<p>Talvez seja essa a sua contradição mais fecunda: Brasília é, ao mesmo tempo, monumento e moradia, cartão-postal e endereço.</p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'No primeiro parágrafo, a expressão “no entanto” introduz uma ressalva à ideia de que a impressão de amplitude do céu de Brasília se explicaria somente por fatores geográficos.', gabarito: 'C', justificativa: 'O conector adversativo antecede a afirmação de que a impressão “não nasce apenas da geografia”, mas também do projeto urbanístico.' },
            { tipo: 'A', enunciado: 'O texto apresenta o “vazio” de Brasília de forma unívoca, como característica exclusivamente positiva da cidade.', gabarito: 'E', justificativa: 'O segundo parágrafo mostra que, para moradores, o vazio é vivido como distância — há duas perspectivas.' },
            { tipo: 'A', enunciado: 'Em “a cidade que se oferece à contemplação”, o emprego do acento indicativo de crase justifica-se pela regência do verbo “oferecer”, que exige a preposição “a”, e pela presença do artigo feminino que antecede “contemplação”.', gabarito: 'C', justificativa: 'Oferecer-se a algo + a contemplação = à contemplação.' },
            { tipo: 'A', enunciado: 'A substituição de “porém” (segundo parágrafo) por “portanto” preservaria a coerência e o sentido original do texto.', gabarito: 'E', justificativa: '“Porém” é adversativo; “portanto” é conclusivo. A troca alteraria a relação lógica entre os parágrafos.' },
            { tipo: 'A', enunciado: 'No último parágrafo, os pares “monumento e moradia” e “cartão-postal e endereço” sintetizam a contradição desenvolvida ao longo do texto.', gabarito: 'C', justificativa: 'Os pares retomam a oposição entre a cidade contemplada (turista) e a cidade vivida (morador).' },
            { tipo: 'A', enunciado: 'O pronome “ela”, em “ela é também produto de um projeto urbanístico” (primeiro parágrafo), retoma a expressão “geografia do Planalto Central”.', gabarito: 'E', justificativa: '“Ela” retoma “Essa impressão”.' },
            { tipo: 'C', enunciado: 'Predomina no texto I a tipologia', alternativas: ['narrativa, com sequência cronológica de ações de personagens.', 'injuntiva, com instruções dirigidas ao leitor.', 'dissertativa, com reflexão sobre aspectos contraditórios da cidade.', 'descritiva, sem qualquer posicionamento do autor.'], gabarito: 'C', justificativa: 'O texto expõe e analisa ideias (vazio como composição × distância), concluindo com uma síntese reflexiva.' }
          ]
        },
        /* ---------------- Literatura ---------------- */
        {
          id: 'd1-literatura',
          disciplina: 'Língua Portuguesa e Literatura',
          area: 'Linguagens',
          titulo: 'Texto II — Dom Casmurro (Machado de Assis)',
          texto: `
<p><strong>Capítulo I — Do título</strong></p>
<p>Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me, sentou-se ao pé de mim, falou da Lua e dos ministros, e acabou recitando-me versos. A viagem era curta, e os versos pode ser que não fossem inteiramente maus. Sucedeu, porém, que, como eu estava cansado, fechei os olhos três ou quatro vezes; tanto bastou para que ele interrompesse a leitura e metesse os versos no bolso.</p>`,
          fonte: 'Machado de Assis. <em>Dom Casmurro</em>. Obra em domínio público.',
          itens: [
            { tipo: 'A', enunciado: 'O fragmento é narrado em primeira pessoa por um narrador que participa dos acontecimentos relatados.', gabarito: 'C', justificativa: 'Formas como “encontrei”, “eu conheço”, “fechei” indicam narrador-personagem.' },
            { tipo: 'A', enunciado: 'Dom Casmurro é obra representativa do Romantismo brasileiro, marcada pela idealização da mulher e do amor.', gabarito: 'E', justificativa: 'É romance realista, marcado pela análise psicológica, ironia e ambiguidade.' },
            { tipo: 'A', enunciado: 'A expressão “que eu conheço de vista e de chapéu” revela traço de humor e ironia característicos da prosa machadiana.', gabarito: 'C', justificativa: 'O acréscimo “e de chapéu” sugere conhecimento superficial, com efeito irônico.' },
            { tipo: 'A', enunciado: 'No romance, a narração de Bento Santiago é apresentada como imparcial e plenamente confiável, o que elimina qualquer ambiguidade quanto à suposta traição de Capitu.', gabarito: 'E', justificativa: 'A narração é parcial e memorialista; a ambiguidade é justamente um dos traços centrais da obra.' },
            { tipo: 'B', enunciado: 'Considere que Dom Casmurro tenha sido publicado em 1899. Calcule a quantidade de anos decorridos entre essa publicação e a inauguração de Brasília, em 1960.', gabarito: 61, justificativa: '1960 − 1899 = 61 → marcar 061.' }
          ]
        },
        /* ---------------- História ---------------- */
        {
          id: 'd1-historia',
          disciplina: 'História',
          area: 'Ciências Humanas',
          titulo: 'Texto III — A capital no Planalto',
          texto: `
<p>A ideia de interiorizar a capital do Brasil antecede em muito a construção de Brasília. Já a primeira Constituição republicana reservava à União uma área no Planalto Central para a futura capital, e a Comissão Exploradora chefiada por Luiz Cruls percorreu a região no final do século XIX para demarcá-la.</p>
<p>Foi, contudo, no governo de Juscelino Kubitschek (1956-1961) que o projeto se concretizou. Inserida no Plano de Metas como “meta-síntese”, a nova capital foi erguida em ritmo acelerado, a partir do Plano Piloto vencedor do concurso de 1957, e inaugurada em 21 de abril de 1960. Milhares de trabalhadores migrantes — os candangos — vieram de diferentes regiões do país, sobretudo do Nordeste, de Minas Gerais e de Goiás, para trabalhar nos canteiros de obras.</p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'A previsão de transferir a capital para o interior do país já constava da primeira Constituição republicana, de 1891.', gabarito: 'C', justificativa: 'O art. 3.º da Constituição de 1891 reservava à União uma zona no Planalto Central para a futura capital.' },
            { tipo: 'A', enunciado: 'O Plano de Metas de Juscelino Kubitschek, sintetizado no lema “cinquenta anos em cinco”, priorizou setores como energia, transportes e indústria de base.', gabarito: 'C', justificativa: 'Esses foram eixos centrais do plano desenvolvimentista de JK.' },
            { tipo: 'A', enunciado: 'A construção de Brasília foi realizada exclusivamente por trabalhadores oriundos da Região Sul do país.', gabarito: 'E', justificativa: 'O texto informa que os candangos vieram sobretudo do Nordeste, de Minas Gerais e de Goiás.' },
            { tipo: 'A', enunciado: 'A inauguração de Brasília ocorreu durante o regime militar instaurado no Brasil.', gabarito: 'E', justificativa: 'Brasília foi inaugurada em 1960; o golpe civil-militar ocorreu em 1964.' },
            { tipo: 'B', enunciado: 'Considere que Salvador tenha sido a capital do Brasil de 1549 a 1763 e que o Rio de Janeiro o tenha sido de 1763 a 1960. Calcule por quantos anos o Rio de Janeiro foi a capital do país.', gabarito: 197, justificativa: '1960 − 1763 = 197.' },
            { tipo: 'C', enunciado: 'O Plano Piloto de Brasília, vencedor do concurso de 1957, foi concebido pelo urbanista', alternativas: ['Oscar Niemeyer.', 'Roberto Burle Marx.', 'Israel Pinheiro.', 'Lúcio Costa.'], gabarito: 'D', justificativa: 'Lúcio Costa assinou o Plano Piloto; Niemeyer projetou os principais edifícios; Burle Marx, paisagismo; Israel Pinheiro presidiu a Novacap.' }
          ]
        },
        /* ---------------- Geografia ---------------- */
        {
          id: 'd1-geografia',
          disciplina: 'Geografia',
          area: 'Ciências Humanas',
          titulo: 'Texto IV — O berço das águas',
          texto: `
<p>O Cerrado, que ocupa a porção central do território brasileiro, é frequentemente chamado de “berço das águas”: em suas chapadas nascem rios que alimentam algumas das principais bacias hidrográficas do país. O clima tropical da região é marcado por forte sazonalidade, e muitas espécies vegetais apresentam adaptações à longa estação seca, como raízes profundas, cascas espessas e folhas coriáceas.</p>
<p>Nas últimas décadas, a expansão da fronteira agropecuária converteu grande parte da vegetação nativa em pastagens e lavouras, sobretudo de grãos para exportação, o que tem preocupado pesquisadores quanto à manutenção da recarga dos aquíferos e à vazão dos rios.</p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'O Cerrado é o maior bioma brasileiro em extensão territorial.', gabarito: 'E', justificativa: 'O maior é a Amazônia; o Cerrado é o segundo.' },
            { tipo: 'A', enunciado: 'O clima predominante no Cerrado apresenta duas estações bem definidas: uma chuvosa, no verão, e outra seca, no inverno.', gabarito: 'C', justificativa: 'Clima tropical sazonal (tropical semiúmido).' },
            { tipo: 'A', enunciado: 'A expansão da fronteira agrícola, especialmente com a monocultura de soja, é apontada como um dos principais vetores de desmatamento do Cerrado.', gabarito: 'C', justificativa: 'A conversão para lavouras de grãos e pastagens é o principal vetor de perda de vegetação nativa.' },
            { tipo: 'A', enunciado: 'As raízes profundas de muitas espécies vegetais do Cerrado constituem adaptação que permite o acesso à água de camadas mais profundas do solo durante a estação seca.', gabarito: 'C', justificativa: 'Adaptação clássica citada no próprio texto.' },
            { tipo: 'C', enunciado: 'Assinale a opção que apresenta corretamente bacias hidrográficas brasileiras que possuem nascentes no território do Distrito Federal.', alternativas: ['Amazônica, do Parnaíba e do Uruguai', 'do Paraná, do São Francisco e do Tocantins-Araguaia', 'do Atlântico Sul, do Paraguai e Amazônica', 'do Uruguai, do Paraná e do Parnaíba'], gabarito: 'B', justificativa: 'O DF contribui para as bacias do Paraná, do São Francisco e do Tocantins-Araguaia.' }
          ]
        },
        /* ---------------- Filosofia e Sociologia ---------------- */
        {
          id: 'd1-filosofia',
          disciplina: 'Filosofia e Sociologia',
          area: 'Ciências Humanas',
          titulo: 'Texto V — Poder e cidadania',
          texto: `
<blockquote><p>Todo o poder emana do povo, que o exerce por meio de representantes eleitos ou diretamente, nos termos desta Constituição.</p></blockquote>
<p class="fonte-inline">Constituição da República Federativa do Brasil de 1988, art. 1.º, parágrafo único.</p>
<p>A reflexão sobre a origem e a legitimidade do poder político atravessa a história da filosofia: dos gregos, que pensavam o ser humano a partir da vida na <em>pólis</em>, aos contratualistas modernos e à sociologia política contemporânea.</p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'Para Aristóteles, o ser humano é um “animal político”, isto é, sua natureza se realiza plenamente na vida em comunidade.', gabarito: 'C', justificativa: 'Zoon politikon — tese central da Política de Aristóteles.' },
            { tipo: 'A', enunciado: 'De acordo com o dispositivo constitucional transcrito, o poder é exercido exclusivamente por meio de representantes eleitos.', gabarito: 'E', justificativa: 'O texto prevê exercício “por meio de representantes eleitos ou diretamente”.' },
            { tipo: 'A', enunciado: 'O plebiscito, o referendo e a iniciativa popular são instrumentos de democracia direta previstos na Constituição Federal de 1988.', gabarito: 'C', justificativa: 'Art. 14 da CF/1988.' },
            { tipo: 'A', enunciado: 'Na teoria de Thomas Hobbes, o estado de natureza é caracterizado como uma condição de paz e de cooperação espontânea entre os indivíduos.', gabarito: 'E', justificativa: 'Para Hobbes, o estado de natureza é a “guerra de todos contra todos”.' },
            { tipo: 'A', enunciado: 'Para Max Weber, o Estado moderno é a comunidade humana que reivindica, com êxito, o monopólio do uso legítimo da força física dentro de determinado território.', gabarito: 'C', justificativa: 'Definição clássica de Weber em “A política como vocação”.' }
          ]
        },
        /* ---------------- Discursiva (Humanas) ---------------- */
        {
          id: 'd1-discursiva',
          disciplina: 'Redação / Discursiva',
          area: 'Ciências Humanas',
          titulo: 'Item discursivo — Cidade e desigualdade',
          texto: `
<p>Considere os textos I (Monumento e moradia) e IV (O berço das águas), bem como o texto em língua estrangeira sobre ilhas de calor urbanas, para responder ao item a seguir.</p>
<p>Em diversas cidades brasileiras, o acesso a áreas verdes, a transporte eficiente e a serviços públicos distribui-se de maneira desigual pelo território, o que afeta a qualidade de vida e as oportunidades de seus habitantes.</p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            {
              tipo: 'D',
              enunciado: 'Redija um texto dissertativo acerca do tema <strong>desigualdade no acesso à cidade no Brasil</strong>. Em seu texto, aborde, necessariamente, os seguintes aspectos:<br>a) a relação entre planejamento urbano e mobilidade cotidiana dos moradores;<br>b) os efeitos da distribuição desigual de áreas verdes sobre a qualidade de vida;<br>c) uma proposta de política pública para reduzir essas desigualdades.',
              maxLinhas: 20,
              espelho: `
<p><strong>Padrão esperado de resposta (espelho):</strong></p>
<ul>
<li><strong>Aspecto a (até 1,0 ponto):</strong> relacionar o desenho urbano (distâncias, dispersão, setorização, modelo rodoviarista) à dificuldade de deslocamento, ao tempo gasto e à dependência de transporte coletivo/automóvel. Ex.: o “vazio” de Brasília como distância para o morador.</li>
<li><strong>Aspecto b (até 1,0 ponto):</strong> explicar que bairros com menos vegetação são mais quentes (ilhas de calor), com impactos na saúde, no conforto térmico e no lazer; mencionar que a infraestrutura verde pode tornar-se privilégio dos bairros mais ricos.</li>
<li><strong>Aspecto c (até 1,0 ponto):</strong> apresentar proposta coerente e viável (arborização prioritária em periferias, integração tarifária, corredores de ônibus, parques lineares, recuperação de nascentes/córregos), indicando agente e finalidade.</li>
</ul>
<p><em>Desconte proporcionalmente por erros de norma culta, fuga ao tema ou texto além do limite de linhas.</em></p>`
            }
          ]
        }
      ]
    },

    /* =================================================================
       2º DIA — Ciências da Natureza e Matemática
       ================================================================= */
    {
      id: 'unb-modelo-dia2',
      titulo: 'Simulado UnB — Modelo Cebraspe · 2º Dia',
      dia: 2,
      duracaoMin: 300,
      blocos: [
        /* ---------------- Biologia: energia ---------------- */
        {
          id: 'd2-biologia-energia',
          disciplina: 'Biologia',
          area: 'Ciências da Natureza',
          titulo: 'Texto VI — Energia no Cerrado',
          texto: `
<p>Ao amanhecer no Cerrado, as folhas das plantas começam a absorver a luz solar e a converter energia luminosa em energia química. Nesse processo, o gás carbônico atmosférico é incorporado em moléculas orgânicas, e a água é decomposta, liberando oxigênio.</p>
<p>Muitas gramíneas do bioma utilizam a via fotossintética C<sub>4</sub>, que concentra CO<sub>2</sub> nas células da bainha do feixe vascular e reduz as perdas por fotorrespiração em ambientes quentes e ensolarados. Os herbívoros que se alimentam dessas plantas obtêm energia por meio da respiração celular, representada, de forma simplificada, pela equação a seguir.</p>
<p class="equacao">C<sub>6</sub>H<sub>12</sub>O<sub>6</sub> + 6 O<sub>2</sub> → 6 CO<sub>2</sub> + 6 H<sub>2</sub>O</p>
<p><em>Dados: massas molares (g/mol): C = 12; H = 1; O = 16.</em></p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'Na fotossíntese, o oxigênio liberado para a atmosfera provém da fotólise da água.', gabarito: 'C', justificativa: 'O O<sub>2</sub> liberado é originado da quebra da água na etapa fotoquímica.' },
            { tipo: 'A', enunciado: 'A etapa fotoquímica da fotossíntese ocorre no estroma do cloroplasto, onde também atua o ciclo de Calvin.', gabarito: 'E', justificativa: 'A etapa fotoquímica ocorre nas membranas dos tilacoides; o ciclo de Calvin, no estroma.' },
            { tipo: 'A', enunciado: 'Plantas C<sub>4</sub> tendem a apresentar vantagem adaptativa em ambientes quentes e de alta luminosidade, em comparação com plantas C<sub>3</sub>.', gabarito: 'C', justificativa: 'A concentração de CO<sub>2</sub> reduz a fotorrespiração, vantajosa em calor e alta luminosidade.' },
            { tipo: 'A', enunciado: 'Em células eucarióticas, a respiração celular aeróbica ocorre integralmente no citoplasma.', gabarito: 'E', justificativa: 'A glicólise ocorre no citosol, mas o ciclo de Krebs e a cadeia respiratória ocorrem na mitocôndria.' },
            { tipo: 'A', enunciado: 'Em uma cadeia alimentar, apenas uma fração da energia de um nível trófico é transferida ao nível seguinte, sendo grande parte dissipada na forma de calor.', gabarito: 'C', justificativa: 'Fluxo unidirecional de energia com perdas a cada nível (aprox. 10% transferido).' },
            { tipo: 'B', enunciado: 'Com base na equação apresentada, calcule, em gramas, a massa de CO<sub>2</sub> produzida pela oxidação completa de 90 g de glicose. Para a marcação no Caderno de Respostas, despreze, caso exista, a parte fracionária do resultado final obtido.', gabarito: 132, justificativa: 'M(glicose) = 180 g/mol → 90 g = 0,5 mol → 3 mol de CO<sub>2</sub> × 44 g/mol = 132 g.' }
          ]
        },
        /* ---------------- Biologia: genética + discursiva ---------------- */
        {
          id: 'd2-biologia-genetica',
          disciplina: 'Biologia',
          area: 'Ciências da Natureza',
          titulo: 'Texto VII — Herança e água',
          texto: `
<p>O albinismo oculocutâneo é uma condição de herança autossômica recessiva, caracterizada pela ausência ou redução da produção de melanina. Considere um casal em que ambos os cônjuges são heterozigotos (<em>Aa</em>) para esse gene e não apresentam a condição.</p>
<p>Em outro contexto, considere que pesquisadores investigam como a remoção da vegetação nativa do Cerrado altera a infiltração da água da chuva no solo e, consequentemente, o abastecimento de nascentes.</p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'No cruzamento Aa × Aa, com dominância completa, espera-se que 1/4 dos descendentes apresentem o fenótipo recessivo.', gabarito: 'C', justificativa: 'Genótipos 1 AA : 2 Aa : 1 aa → 1/4 aa.' },
            { tipo: 'B', enunciado: 'Calcule, em porcentagem, a probabilidade de o casal mencionado no texto ter uma criança albina.', gabarito: 25, justificativa: 'P(aa) = 1/4 = 25% → marcar 025.' },
            { tipo: 'C', enunciado: 'A proporção fenotípica esperada para a descendência do casal, quanto ao albinismo, é de', alternativas: ['3 : 1.', '1 : 1.', '1 : 2 : 1.', '9 : 3 : 3 : 1.'], gabarito: 'A', justificativa: '3 com pigmentação normal : 1 albino.' },
            {
              tipo: 'D',
              enunciado: 'Explique, do ponto de vista ecológico e hidrológico, de que forma o desmatamento do Cerrado pode afetar a disponibilidade de água em nascentes e rios. Mencione pelo menos <strong>dois</strong> mecanismos envolvidos.',
              maxLinhas: 10,
              espelho: `
<ul>
<li><strong>Infiltração e recarga (até 1,5 ponto):</strong> a vegetação nativa, com raízes profundas e serapilheira, favorece a infiltração e a recarga dos aquíferos; sem ela, aumenta o escoamento superficial e diminui a água armazenada que abastece as nascentes na seca.</li>
<li><strong>Erosão e assoreamento (até 1,0 ponto):</strong> solo exposto sofre erosão, carreando sedimentos que assoreiam leitos de rios.</li>
<li><strong>Evapotranspiração / ciclo hidrológico (até 0,5 ponto):</strong> alteração da evapotranspiração e do microclima, com impactos na umidade e no regime de chuvas regionais.</li>
</ul>`
            }
          ]
        },
        /* ---------------- Química ---------------- */
        {
          id: 'd2-quimica',
          disciplina: 'Química',
          area: 'Ciências da Natureza',
          titulo: 'Texto VIII — Da represa à torneira',
          texto: `
<p>Em uma estação de tratamento de água, a água bruta captada recebe sulfato de alumínio, Al<sub>2</sub>(SO<sub>4</sub>)<sub>3</sub>, que atua como coagulante, agregando partículas em suspensão em flocos. Em seguida, ocorrem a decantação e a filtração. Para corrigir o pH, adiciona-se cal hidratada, Ca(OH)<sub>2</sub>. Por fim, a desinfecção é feita com cloro, que reage com a água conforme a equação abaixo.</p>
<p class="equacao">Cl<sub>2</sub>(g) + H<sub>2</sub>O(l) → HCl(aq) + HClO(aq)</p>
<p><em>Dados: massas molares (g/mol): Al = 27; S = 32; O = 16.</em></p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'O hidróxido de cálcio é uma base, e sua adição à água tende a elevar o pH do meio.', gabarito: 'C', justificativa: 'Ca(OH)<sub>2</sub> libera OH<sup>−</sup>, diminuindo [H<sup>+</sup>] e elevando o pH.' },
            { tipo: 'A', enunciado: 'Uma solução de pH = 4 apresenta concentração de íons H<sup>+</sup> 100 vezes maior que a de uma solução de pH = 6.', gabarito: 'C', justificativa: '10<sup>−4</sup> / 10<sup>−6</sup> = 10<sup>2</sup> = 100.' },
            { tipo: 'A', enunciado: 'Na reação do cloro com a água, o elemento cloro sofre apenas oxidação.', gabarito: 'E', justificativa: 'É um desproporcionamento: o cloro passa de 0 para −1 (HCl, redução) e para +1 (HClO, oxidação).' },
            { tipo: 'A', enunciado: 'A filtração é um método de separação de misturas homogêneas baseado na diferença entre os pontos de ebulição dos componentes.', gabarito: 'E', justificativa: 'A filtração separa misturas heterogêneas sólido-líquido; a descrição corresponde à destilação.' },
            { tipo: 'B', enunciado: 'Calcule, em g/mol, a massa molar do sulfato de alumínio, Al<sub>2</sub>(SO<sub>4</sub>)<sub>3</sub>.', gabarito: 342, justificativa: '2(27) + 3[32 + 4(16)] = 54 + 3(96) = 54 + 288 = 342 g/mol.' },
            { tipo: 'C', enunciado: 'O pH de uma solução aquosa de HCl de concentração 0,001 mol/L, considerando ionização total, é igual a', alternativas: ['1.', '2.', '3.', '11.'], gabarito: 'C', justificativa: '[H<sup>+</sup>] = 10<sup>−3</sup> mol/L → pH = 3.' }
          ]
        },
        /* ---------------- Física ---------------- */
        {
          id: 'd2-fisica',
          disciplina: 'Física',
          area: 'Ciências da Natureza',
          titulo: 'Texto IX — Domingo no Eixão',
          texto: `
<p>Aos domingos e feriados, o Eixo Rodoviário de Brasília é fechado para veículos e se transforma em área de lazer. Considere que um ciclista, cuja massa somada à da bicicleta é de 80 kg, parta do repouso e atinja a velocidade de 10 m/s em 20 s, com aceleração constante, em trecho retilíneo e horizontal. Em seguida, ele mantém essa velocidade constante.</p>
<p><em>Despreze a resistência do ar nos cálculos.</em></p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'A aceleração do ciclista no trecho inicial é de 0,5 m/s².', gabarito: 'C', justificativa: 'a = Δv/Δt = 10/20 = 0,5 m/s².' },
            { tipo: 'A', enunciado: 'Durante o trecho percorrido com velocidade constante, a força resultante sobre o conjunto ciclista-bicicleta é nula.', gabarito: 'C', justificativa: '1.ª lei de Newton: MRU ⇒ força resultante nula.' },
            { tipo: 'A', enunciado: 'A distância percorrida pelo ciclista nos 20 s iniciais é de 200 m.', gabarito: 'E', justificativa: 'd = a·t²/2 = 0,5·400/2 = 100 m.' },
            { tipo: 'A', enunciado: 'Ao atingir 10 m/s, a energia cinética do conjunto é de 8.000 J.', gabarito: 'E', justificativa: 'Ec = m·v²/2 = 80·100/2 = 4.000 J.' },
            { tipo: 'B', enunciado: 'Calcule, em newtons, o módulo da força resultante sobre o conjunto no trecho de aceleração.', gabarito: 40, justificativa: 'F = m·a = 80 × 0,5 = 40 N → marcar 040.' },
            { tipo: 'B', enunciado: 'Calcule, em metros, a distância percorrida pelo ciclista nos 20 s iniciais.', gabarito: 100, justificativa: 'd = (v₀ + v)/2 · t = (0 + 10)/2 · 20 = 100 m.' },
            { tipo: 'C', enunciado: 'A potência média da força resultante nos 20 s iniciais é igual a', alternativas: ['100 W.', '200 W.', '400 W.', '800 W.'], gabarito: 'B', justificativa: 'P = ΔEc/Δt = 4.000 J / 20 s = 200 W.' }
          ]
        },
        /* ---------------- Matemática: funções ---------------- */
        {
          id: 'd2-mat-funcoes',
          disciplina: 'Matemática',
          area: 'Matemática',
          titulo: 'Texto X — O chafariz',
          texto: `
<p>Em uma praça, um chafariz lança jatos de água verticalmente. A altura <em>h</em>, em metros, de uma gota de água em relação ao bocal, <em>t</em> segundos após sair dele, é dada por</p>
<p class="equacao"><em>h</em>(<em>t</em>) = −5<em>t</em>² + 20<em>t</em>, para 0 ≤ <em>t</em> ≤ 4.</p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'A altura máxima atingida pela gota é de 20 m.', gabarito: 'C', justificativa: 'Vértice em t = −b/2a = 2 s → h(2) = −20 + 40 = 20 m.' },
            { tipo: 'A', enunciado: 'A gota retorna ao nível do bocal 4 s após sair dele.', gabarito: 'C', justificativa: 'h(t) = 0 ⇒ t(−5t + 20) = 0 ⇒ t = 0 ou t = 4.' },
            { tipo: 'A', enunciado: 'A função h é crescente em todo o intervalo [0, 4].', gabarito: 'E', justificativa: 'h cresce em [0, 2] e decresce em [2, 4].' },
            { tipo: 'B', enunciado: 'Calcule o valor de h(1) + h(3).', gabarito: 30, justificativa: 'h(1) = 15 e h(3) = −45 + 60 = 15 → 30 → marcar 030.' },
            { tipo: 'C', enunciado: 'O gráfico da função h, considerada em todo o conjunto dos números reais, é', alternativas: ['uma reta crescente.', 'uma parábola com concavidade voltada para cima.', 'uma hipérbole.', 'uma parábola com concavidade voltada para baixo.'], gabarito: 'D', justificativa: 'Função quadrática com coeficiente a = −5 < 0.' }
          ]
        },
        /* ---------------- Matemática: conjuntos/probabilidade/estatística ---------------- */
        {
          id: 'd2-mat-prob',
          disciplina: 'Matemática',
          area: 'Matemática',
          titulo: 'Texto XI — A turma do cursinho',
          texto: `
<p>Em uma turma de cursinho preparatório com 40 estudantes, 25 pretendem concorrer a cursos da área de saúde, 18 pretendem concorrer a cursos da área de exatas e 8 pretendem concorrer a cursos de ambas as áreas.</p>
<p>Em um simulado, cinco estudantes dessa turma obtiveram as seguintes notas: 6, 7, 7, 8 e 9.</p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'Exatamente 5 estudantes da turma não pretendem concorrer a nenhuma das duas áreas.', gabarito: 'C', justificativa: 'n(S ∪ E) = 25 + 18 − 8 = 35 → 40 − 35 = 5.' },
            { tipo: 'A', enunciado: 'Escolhendo-se ao acaso um estudante da turma, a probabilidade de ele pretender concorrer apenas à área de exatas é superior a 30%.', gabarito: 'E', justificativa: 'Apenas exatas: 18 − 8 = 10 → 10/40 = 25%.' },
            { tipo: 'B', enunciado: 'Calcule a quantidade de comissões distintas de 3 estudantes que podem ser formadas apenas com os estudantes que pretendem concorrer a ambas as áreas.', gabarito: 56, justificativa: 'C(8,3) = 8·7·6/3! = 56 → marcar 056.' },
            { tipo: 'A', enunciado: 'A moda das notas apresentadas é 7.', gabarito: 'C', justificativa: 'O valor 7 aparece duas vezes.' },
            { tipo: 'C', enunciado: 'A média aritmética e a mediana das cinco notas são, respectivamente,', alternativas: ['7 e 7,4.', '7,4 e 7.', '7,4 e 8.', '7,5 e 7.'], gabarito: 'B', justificativa: 'Média = 37/5 = 7,4; mediana (valor central de 6, 7, 7, 8, 9) = 7.' }
          ]
        },
        /* ---------------- Matemática: geometria + discursiva ---------------- */
        {
          id: 'd2-mat-geometria',
          disciplina: 'Matemática',
          area: 'Matemática',
          titulo: 'Texto XII — Reservatório e acessibilidade',
          texto: `
<p>Uma escola pública do Distrito Federal construirá um reservatório de água na forma de um cilindro circular reto, com raio da base de 3 m e altura de 5 m.</p>
<p>A mesma escola fará uma rampa de acessibilidade para vencer um desnível de 0,6 m. Considere que a inclinação máxima permitida para a rampa seja de 8,33%, o que corresponde, aproximadamente, à razão 1 : 12 entre a altura e o comprimento horizontal da rampa.</p>`,
          fonte: 'Texto elaborado para fins didáticos.',
          itens: [
            { tipo: 'A', enunciado: 'O volume do reservatório é igual a 45π m³.', gabarito: 'C', justificativa: 'V = π·r²·h = π·9·5 = 45π m³.' },
            { tipo: 'B', enunciado: 'Considerando π = 3, calcule, em m³, o volume do reservatório.', gabarito: 135, justificativa: '45 × 3 = 135 m³.' },
            { tipo: 'A', enunciado: 'Se o raio da base do reservatório fosse duplicado e a altura mantida, o volume também seria duplicado.', gabarito: 'E', justificativa: 'O volume é proporcional ao quadrado do raio: seria quadruplicado.' },
            {
              tipo: 'D',
              enunciado: 'Determine o comprimento horizontal mínimo da rampa descrita no texto e o comprimento da superfície inclinada da rampa (com aproximação de duas casas decimais). Apresente os cálculos e justifique cada etapa.',
              maxLinhas: 12,
              espelho: `
<ul>
<li><strong>Comprimento horizontal (até 1,5 ponto):</strong> razão 1 : 12 ⇒ L = 0,6 × 12 = <strong>7,2 m</strong>.</li>
<li><strong>Superfície inclinada (até 1,5 ponto):</strong> teorema de Pitágoras: c = √(7,2² + 0,6²) = √(51,84 + 0,36) = √52,2 ≈ <strong>7,22 m</strong>.</li>
</ul>
<p><em>Atribua nota parcial se o raciocínio estiver correto com erro apenas de arredondamento.</em></p>`
            }
          ]
        }
      ]
    }
  ]
};
