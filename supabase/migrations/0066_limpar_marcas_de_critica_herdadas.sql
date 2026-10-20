-- Zera as marcas de crítica que vieram do cálculo.
--
-- A migração 0065 passou a criticidade para a mão do engenheiro, mas deixou de
-- pé as 53 marcas que o CPM havia escrito. Nenhuma delas é decisão de ninguém:
-- 41 só tinham folga zero e 12 estavam apenas atrasadas (a 1.1 Limpeza do
-- terreno com -17 dias). Mantê-las apresentava a conta antiga como se fosse
-- declaração do engenheiro.
--
-- A pedido: limpa tudo, e ele marca pelo sistema as que realmente são críticas.
--
-- RDO FECHADO NÃO MUDA. As folhas fechadas leem de `tarefas_snapshot`, que
-- congelou o `critica` do dia do fechamento — documento é documento. O badge
-- vermelho segue nelas, e está certo que siga.
--
-- Registro do que foi apagado, para o caso de alguém querer de volta:
--
--   [CASA THAIS E RAFA] 16.8 Entrega técnica da obra  (folga 0)
--   [CASA VIDAL ALPHA] 2.11 Conferência e concretagem do baldrame  (folga 0)
--   [CASA VIDAL ALPHA] 2.12 Desforma e impermeabilização do baldrame  (folga 0)
--   [CASA VIDAL ALPHA] 3.1 Montagem de pilares e arranques  (folga 0)
--   [CASA VIDAL ALPHA] 3.2 Montagem de formas dos pilares  (folga 0)
--   [CASA VIDAL ALPHA] 3.3 Concretagem dos pilares  (folga 0)
--   [CASA VIDAL ALPHA] 3.4 Desforma e preparação dos pilares  (folga 0)
--   [CASA VIDAL ALPHA] 3.5 Escoramento e formas da Laje 1  (folga 0)
--   [CASA VIDAL ALPHA] 3.6 Montagem das armaduras da Laje 1  (folga 0)
--   [CASA VIDAL ALPHA] 3.8 Conferência estrutural e concretagem da Laje 1  (folga 0)
--   [CASA VIDAL ALPHA] 3.9 Cura e manutenção da Laje 1  (folga 0)
--   [CASA VIDAL ALPHA] 3.10 Montagem de pilares e elementos do nível seguinte  (folga 0)
--   [CASA VIDAL ALPHA] 3.11 Formas e escoramento da Laje 2  (folga 0)
--   [CASA VIDAL ALPHA] 3.12 Montagem das armaduras da Laje 2  (folga 0)
--   [CASA VIDAL ALPHA] 3.14 Conferência e concretagem da Laje 2  (folga 0)
--   [CASA VIDAL ALPHA] 3.15 Cura e manutenção da Laje 2  (folga 0)
--   [CASA VIDAL ALPHA] 3.16 Retirada programada de escoramentos  (folga 0)
--   [CASA VIDAL ALPHA] 4.1 Marcação das paredes  (folga 0)
--   [CASA VIDAL ALPHA] 4.3 Elevação das paredes internas  (folga 0)
--   [CASA VIDAL ALPHA] 4.5 Execução de shafts e fechamentos técnicos  (folga 0)
--   [CASA VIDAL ALPHA] 4.7 Encunhamento ou fechamento superior  (folga 0)
--   [CASA VIDAL ALPHA] 4.8 Correções e liberação para instalações  (folga 0)
--   [CASA VIDAL ALPHA] 5.1 Marcação dos pontos elétricos  (folga 0)
--   [CASA VIDAL ALPHA] 5.2 Abertura de rasgos e caixas elétricas  (folga 0)
--   [CASA VIDAL ALPHA] 5.3 Eletrodutos e caixas embutidas  (folga 0)
--   [CASA VIDAL ALPHA] 5.9 Conferência das instalações elétricas embutidas  (folga 0)
--   [CASA VIDAL ALPHA] 5.10 Fechamento dos rasgos e recomposição  (folga 0)
--   [CASA VIDAL ALPHA] 6.1 Chapisco interno  (folga 0)
--   [CASA VIDAL ALPHA] 6.2 Emboço/reboco interno  (folga 0)
--   [CASA VIDAL ALPHA] 6.5 Regularização de paredes de áreas molhadas  (folga 0)
--   [CASA VIDAL ALPHA] 6.6 Impermeabilização de banheiros e áreas molhadas  (folga 0)
--   [CASA VIDAL ALPHA] 6.7 Teste de estanqueidade da impermeabilização  (folga 0)
--   [CASA VIDAL ALPHA] 10.2 Assentamento dos revestimentos dos banheiros  (folga 0)
--   [CASA VIDAL ALPHA] 10.7 Rejuntamento dos pisos e paredes  (folga 0)
--   [CASA VIDAL ALPHA] 13.5 Instalação de cubas, torneiras e metais  (folga 0)
--   [CASA VIDAL ALPHA] 13.6 Instalação de bancadas e tampos  (folga 0)
--   [CASA VIDAL ALPHA] 13.9 Testes finais de hidráulica e elétrica  (folga 0)
--   [CASA VIDAL ALPHA] 15.3 Testes de funcionamento de equipamentos  (folga 0)
--   [CASA VIDAL ALPHA] 15.4 Vistoria de acabamento e lista de pendências  (folga 0)
--   [CASA VIDAL ALPHA] 15.5 Correção das pendências  (folga 0)
--   [CASA VIDAL ALPHA] 15.6 Vistoria final e entrega  (folga 0)
--   [CASA VIDAL ALPHA] 1.1 Limpeza do terreno  (folga -17)
--   [CASA VIDAL ALPHA] 1.5 Conferência de níveis e referências topográficas  (folga -15)
--   [CASA VIDAL ALPHA] 1.6 Locação da casa e dos eixos  (folga -14)
--   [CASA VIDAL ALPHA] 2.1 Escavação das sapatas  (folga -12)
--   [CASA VIDAL ALPHA] 2.2 Regularização do fundo das escavações  (folga -9)
--   [CASA VIDAL ALPHA] 2.3 Montagem das armaduras das sapatas  (folga -8)
--   [CASA VIDAL ALPHA] 2.4 Montagem das formas das sapatas, quando necessárias  (folga -6)
--   [CASA VIDAL ALPHA] 2.5 Conferência e concretagem das sapatas  (folga -5)
--   [CASA VIDAL ALPHA] 2.7 Escavação das vigas baldrame  (folga -4)
--   [CASA VIDAL ALPHA] 2.8 Montagem das formas do baldrame  (folga -2)
--   [CASA VIDAL ALPHA] 2.9 Montagem das armaduras do baldrame  (folga -2)
--   [CASA VIDAL ALPHA] 2.10 Passagens hidráulicas sob o baldrame  (folga -2)
do $$
declare
  v_limpas integer;
begin
  update public.cronograma_tarefas
     set critica = false
   where critica;

  get diagnostics v_limpas = row_count;
  raise notice 'Marcas de crítica removidas: %', v_limpas;
end $$;
