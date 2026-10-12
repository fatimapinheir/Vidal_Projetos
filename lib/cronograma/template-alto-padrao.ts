/**
 * Template de cronograma para casa de alto padrão.
 *
 * Lista fornecida pelo cliente do engenheiro: 17 etapas, 136 tarefas. Bem mais
 * detalhada que a do MCMV — inclui projetos e aprovações antes da execução,
 * automação, marcenaria planejada, piscina e um bloco inteiro de testes e
 * entrega.
 *
 * DURAÇÕES NÃO VÊM DA LISTA. Todas entram com 1 dia, que é só um valor válido
 * para o cálculo partir — ao contrário do template MCMV, cujas durações são as
 * praticadas numa obra real. Aqui o engenheiro precisa ajustar tarefa a
 * tarefa, e a tela avisa isso antes de aplicar.
 */

import type { EtapaTemplateCronograma } from "./template-residencial";

export const TEMPLATE_CRONOGRAMA_ALTO_PADRAO: EtapaTemplateCronograma[] = [
  {
    nome: "01 — Projetos, planejamento e aprovações",
    observacao: "Antes de iniciar a execução",
    tarefas: [
      { nome: "Levantamento topográfico", duracaoDias: 1 },
      { nome: "Sondagem do terreno", duracaoDias: 1 },
      { nome: "Projeto arquitetônico", duracaoDias: 1 },
      { nome: "Projetos complementares", duracaoDias: 1 },
      { nome: "Compatibilização de projetos", duracaoDias: 1 },
      { nome: "Aprovação dos projetos e licenças", duracaoDias: 1 },
      { nome: "Orçamento executivo", duracaoDias: 1 },
      { nome: "Cronograma físico-financeiro", duracaoDias: 1 },
      { nome: "Contratação de equipes e fornecedores", duracaoDias: 1 },
    ],
  },
  {
    nome: "02 — Serviços preliminares e canteiro",
    tarefas: [
      { nome: "Limpeza e preparação do terreno", duracaoDias: 1 },
      { nome: "Demolições e remoções, se necessárias", duracaoDias: 1 },
      { nome: "Instalações provisórias de água e energia", duracaoDias: 1 },
      { nome: "Tapumes e fechamento do terreno", duracaoDias: 1 },
      { nome: "Instalação do canteiro de obras", duracaoDias: 1 },
      { nome: "Locação da obra", duracaoDias: 1 },
      { nome: "Terraplenagem e nivelamento", duracaoDias: 1 },
    ],
  },
  {
    nome: "03 — Fundações e infraestrutura enterrada",
    tarefas: [
      { nome: "Escavações das fundações", duracaoDias: 1 },
      { nome: "Execução de estacas, se previstas", duracaoDias: 1 },
      { nome: "Execução de sapatas e blocos", duracaoDias: 1 },
      { nome: "Armação, formas e concretagem das fundações", duracaoDias: 1 },
      { nome: "Execução de vigas baldrame", duracaoDias: 1 },
      { nome: "Impermeabilização das fundações", duracaoDias: 1 },
      { nome: "Tubulações enterradas de esgoto e drenagem", duracaoDias: 1 },
      { nome: "Tubulações enterradas de água e energia", duracaoDias: 1 },
      { nome: "Reaterro e compactação", duracaoDias: 1 },
    ],
  },
  {
    nome: "04 — Estrutura de concreto",
    tarefas: [
      { nome: "Pilares", duracaoDias: 1 },
      { nome: "Vigas", duracaoDias: 1 },
      { nome: "Lajes", duracaoDias: 1 },
      { nome: "Escadas estruturais", duracaoDias: 1 },
      { nome: "Desforma e reescoramento", duracaoDias: 1 },
      { nome: "Cura e inspeção do concreto", duracaoDias: 1 },
      { nome: "Estrutura do pavimento superior, se houver", duracaoDias: 1 },
    ],
  },
  {
    nome: "05 — Alvenaria e vedações",
    tarefas: [
      { nome: "Alvenaria do térreo", duracaoDias: 1 },
      { nome: "Alvenaria do pavimento superior", duracaoDias: 1 },
      { nome: "Alvenaria de platibandas", duracaoDias: 1 },
      { nome: "Vergas e contravergas", duracaoDias: 1 },
      { nome: "Fechamentos de shafts e áreas técnicas", duracaoDias: 1 },
      { nome: "Encunhamento e ajustes de vãos", duracaoDias: 1 },
    ],
  },
  {
    nome: "06 — Cobertura e estanqueidade externa",
    tarefas: [
      { nome: "Estrutura do telhado, se houver", duracaoDias: 1 },
      { nome: "Telhamento", duracaoDias: 1 },
      { nome: "Impermeabilização de lajes expostas", duracaoDias: 1 },
      { nome: "Execução de calhas e rufos", duracaoDias: 1 },
      { nome: "Instalação de condutores pluviais", duracaoDias: 1 },
      { nome: "Testes de estanqueidade", duracaoDias: 1 },
    ],
  },
  {
    nome: "07 — Instalações embutidas",
    observacao: "Antes de fechar paredes e forros",
    tarefas: [
      { nome: "Infraestrutura hidráulica de água fria e quente", duracaoDias: 1 },
      { nome: "Infraestrutura de esgoto e ventilação sanitária", duracaoDias: 1 },
      { nome: "Infraestrutura elétrica e quadros", duracaoDias: 1 },
      { nome: "Infraestrutura de internet e automação", duracaoDias: 1 },
      { nome: "Infraestrutura de climatização e drenos", duracaoDias: 1 },
      { nome: "Infraestrutura de gás", duracaoDias: 1 },
      { nome: "Infraestrutura de áudio, vídeo e CFTV", duracaoDias: 1 },
      { nome: "Testes das tubulações e instalações", duracaoDias: 1 },
      { nome: "Registro fotográfico das instalações embutidas", duracaoDias: 1 },
    ],
  },
  {
    nome: "08 — Impermeabilizações e contrapisos",
    tarefas: [
      { nome: "Regularização das bases", duracaoDias: 1 },
      { nome: "Impermeabilização de banheiros", duracaoDias: 1 },
      { nome: "Impermeabilização de varandas e áreas molhadas", duracaoDias: 1 },
      { nome: "Impermeabilização de áreas técnicas", duracaoDias: 1 },
      { nome: "Testes de estanqueidade", duracaoDias: 1 },
      { nome: "Proteção mecânica da impermeabilização", duracaoDias: 1 },
      { nome: "Execução de contrapisos", duracaoDias: 1 },
    ],
  },
  {
    nome: "09 — Revestimentos de paredes e tetos",
    tarefas: [
      { nome: "Chapisco", duracaoDias: 1 },
      { nome: "Emboço e reboco", duracaoDias: 1 },
      { nome: "Regularização de superfícies", duracaoDias: 1 },
      { nome: "Revestimentos cerâmicos de paredes", duracaoDias: 1 },
      { nome: "Revestimentos de banheiros e áreas gourmet", duracaoDias: 1 },
      { nome: "Forros de gesso", duracaoDias: 1 },
      { nome: "Cortineiros, sancas e negativos", duracaoDias: 1 },
      { nome: "Preparação de superfícies para pintura", duracaoDias: 1 },
    ],
  },
  {
    nome: "10 — Pisos e acabamentos em pedra",
    tarefas: [
      { nome: "Assentamento de pisos internos", duracaoDias: 1 },
      { nome: "Assentamento de pisos externos", duracaoDias: 1 },
      { nome: "Revestimento de escadas", duracaoDias: 1 },
      { nome: "Soleiras e peitoris", duracaoDias: 1 },
      { nome: "Bancadas de cozinha e banheiros", duracaoDias: 1 },
      { nome: "Nichos e detalhes em pedra", duracaoDias: 1 },
      { nome: "Rodapés", duracaoDias: 1 },
      { nome: "Rejuntamento e acabamento final", duracaoDias: 1 },
    ],
  },
  {
    nome: "11 — Esquadrias e vidros",
    tarefas: [
      { nome: "Instalação de marcos e contramarcos", duracaoDias: 1 },
      { nome: "Instalação de esquadrias", duracaoDias: 1 },
      { nome: "Instalação de portas internas e externas", duracaoDias: 1 },
      { nome: "Instalação de vidros e espelhos", duracaoDias: 1 },
      { nome: "Instalação de guarda-corpos", duracaoDias: 1 },
      { nome: "Ferragens, fechaduras e puxadores", duracaoDias: 1 },
      { nome: "Vedação e regulagem das esquadrias", duracaoDias: 1 },
    ],
  },
  {
    nome: "12 — Pintura e acabamentos decorativos",
    tarefas: [
      { nome: "Emassamento de paredes e tetos", duracaoDias: 1 },
      { nome: "Lixamento e preparação", duracaoDias: 1 },
      { nome: "Pintura interna", duracaoDias: 1 },
      { nome: "Pintura externa", duracaoDias: 1 },
      { nome: "Texturas e efeitos decorativos", duracaoDias: 1 },
      { nome: "Acabamentos de madeira e metal", duracaoDias: 1 },
      { nome: "Retoques de pintura", duracaoDias: 1 },
    ],
  },
  {
    nome: "13 — Instalações finais e equipamentos",
    tarefas: [
      { nome: "Instalação de tomadas e interruptores", duracaoDias: 1 },
      { nome: "Instalação de luminárias e fitas LED", duracaoDias: 1 },
      { nome: "Instalação de louças e metais sanitários", duracaoDias: 1 },
      { nome: "Instalação de boxes e acessórios", duracaoDias: 1 },
      { nome: "Instalação de chuveiros e aquecedores", duracaoDias: 1 },
      { nome: "Instalação de equipamentos de climatização", duracaoDias: 1 },
      { nome: "Instalação de quadros e dispositivos elétricos", duracaoDias: 1 },
      { nome: "Instalação de equipamentos de automação", duracaoDias: 1 },
      { nome: "Configuração de rede, áudio e vídeo", duracaoDias: 1 },
      { nome: "Instalação de bombas e pressurizadores", duracaoDias: 1 },
    ],
  },
  {
    nome: "14 — Marcenaria e mobiliário planejado",
    tarefas: [
      { nome: "Instalação dos armários da cozinha", duracaoDias: 1 },
      { nome: "Instalação dos gabinetes dos banheiros", duracaoDias: 1 },
      { nome: "Instalação de closets e roupeiros", duracaoDias: 1 },
      { nome: "Instalação de painéis e mobiliário fixo", duracaoDias: 1 },
      { nome: "Instalação de portas e acessórios de marcenaria", duracaoDias: 1 },
      { nome: "Regulagens e ajustes finais", duracaoDias: 1 },
    ],
  },
  {
    nome: "15 — Fachada, áreas externas e paisagismo",
    tarefas: [
      { nome: "Revestimento final da fachada", duracaoDias: 1 },
      { nome: "Pintura e arremates externos", duracaoDias: 1 },
      { nome: "Execução de calçadas e passeios", duracaoDias: 1 },
      { nome: "Pavimentação da garagem", duracaoDias: 1 },
      { nome: "Instalação de portões", duracaoDias: 1 },
      { nome: "Execução de muros e acabamentos", duracaoDias: 1 },
      { nome: "Drenagem superficial do terreno", duracaoDias: 1 },
      { nome: "Execução de decks e pergolados", duracaoDias: 1 },
      { nome: "Execução da área gourmet", duracaoDias: 1 },
      { nome: "Plantio de grama e paisagismo", duracaoDias: 1 },
      { nome: "Instalação de irrigação e iluminação externa", duracaoDias: 1 },
    ],
  },
  {
    nome: "16 — Piscina e equipamentos de lazer",
    tarefas: [
      { nome: "Estrutura e impermeabilização da piscina", duracaoDias: 1 },
      { nome: "Revestimento interno e bordas", duracaoDias: 1 },
      { nome: "Instalações hidráulicas", duracaoDias: 1 },
      { nome: "Instalação dos equipamentos da casa de máquinas", duracaoDias: 1 },
      { nome: "Instalação de iluminação subaquática", duracaoDias: 1 },
      { nome: "Enchimento e testes", duracaoDias: 1 },
      { nome: "Tratamento inicial da água", duracaoDias: 1 },
    ],
  },
  {
    nome: "17 — Testes, limpeza e entrega",
    tarefas: [
      { nome: "Testes finais das instalações hidráulicas", duracaoDias: 1 },
      { nome: "Testes finais das instalações elétricas", duracaoDias: 1 },
      { nome: "Comissionamento de climatização e automação", duracaoDias: 1 },
      { nome: "Testes de equipamentos e sistemas", duracaoDias: 1 },
      { nome: "Vistoria geral dos acabamentos", duracaoDias: 1 },
      { nome: "Elaboração da lista de pendências", duracaoDias: 1 },
      { nome: "Correção das pendências", duracaoDias: 1 },
      { nome: "Limpeza pós-obra", duracaoDias: 1 },
      { nome: "Vistoria com o cliente", duracaoDias: 1 },
      { nome: "Entrega de manuais e garantias", duracaoDias: 1 },
      { nome: "Entrega dos projetos conforme executado", duracaoDias: 1 },
      { nome: "Entrega das chaves", duracaoDias: 1 },
    ],
  },
];

export const TOTAL_TAREFAS_ALTO_PADRAO = 136;
