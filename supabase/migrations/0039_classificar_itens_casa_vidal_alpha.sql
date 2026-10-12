-- Classifica em material / serviço / mão de obra os itens da CASA VIDAL ALPHA.
--
-- Nem a importação de planilha nem os templates preenchem `tipo_item`: só o
-- cadastro manual preenche. Com 227 itens importados, o bloco "material ×
-- serviço × mão de obra" do orçamento aparecia inteiro como "sem categoria".
--
-- A regra é a ETAPA, e não a descrição ou o código.
--
-- O código não serve: a coluna "Código" desta obra recebeu a numeração da
-- planilha ("1.1", "3.4", "15.1"), não código SINAPI — então "tem código" não
-- distingue nada.
--
-- A etapa serve porque é assim que o orçamento foi montado, no padrão
-- brasileiro de material item a item com mão de obra em empreita global:
-- as etapas de instalação listam peças (adaptador, flange, bacia Deca), as de
-- construção listam serviços (chapisco, reboco, montagem de armadura), e a
-- mão de obra inteira é uma linha só.
--
-- DELIBERADAMENTE restrita a esta obra, por decisão do engenheiro. A regra lê
-- como ESTE orçamento foi montado; obra que embuta mão de obra em cada item
-- seria classificada errado por ela. Também não vira regra automática na
-- importação pelo mesmo motivo.
--
-- Pega as duas versões (ativa e rascunho): o rascunho é a cópia em edição, e
-- deixá-lo de fora faria a classificação sumir quando ele fosse ativado.
--
-- As etapas 05 (Paredes), 06 (Cobertura) e 11 (Forro) ficam em branco de
-- propósito — misturam material e serviço de verdade ("Alvenaria em Pedra" é
-- serviço, "Tijolo Cerâmico 9x19x18" é material), e são 13 itens que o
-- engenheiro resolve à mão.
update orcamento_itens i
set tipo_item = case i.etapa
  when '02. MÃO DE OBRA' then 'mao_de_obra'

  when '07. ESQUADRIAS DE MADEIRA' then 'material'
  when '08. ESQUADRIAS DE ALUMÍNIO' then 'material'
  when '15. GRANITOS E MÁRMORES' then 'material'
  when '16. INSTALAÇÃO ELÉTRICA' then 'material'
  when '17. INSTALAÇÃO ÁGUA FRIA' then 'material'
  when '18. INSTALAÇÃO ÁGUA QUENTE' then 'material'
  when '19. INSTALAÇÃO AR CONDICIONADO' then 'material'
  when '20. INSTALAÇÃO ESGOTO E PLUVIAL' then 'material'
  when '21. LOUÇAS E METAIS' then 'material'

  when '01. SERVIÇOS PRELIMINARES' then 'servico'
  when '03. INFRA-ESTRUTURA' then 'servico'
  when '04. SUPRA-ESTRUTURA' then 'servico'
  when '09. IMPERMEABILIZAÇÃO' then 'servico'
  when '10. REVESTIMENTOS INTERNOS' then 'servico'
  when '12. REVESTIMENTOS EXTERNOS' then 'servico'
  when '13. PISOS' then 'servico'
  when '14. PINTURA' then 'servico'
  when '22. PISCINA' then 'servico'
  when '23. COMPLEMENTOS E OUTROS SERVIÇOS' then 'servico'

  -- 05, 06, 11 e qualquer etapa não prevista: mantém o que já estiver lá.
  else i.tipo_item
end
from orcamento_versoes v
join obras o on o.id = v.obra_id
where v.id = i.orcamento_versao_id
  and o.nome = 'CASA VIDAL ALPHA'
  -- Não sobrescreve classificação feita à mão.
  and i.tipo_item is null;
