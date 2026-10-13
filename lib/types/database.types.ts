// Tipos do banco escritos manualmente a partir das migrations em supabase/migrations/.
// Não foi possível usar `supabase gen types` (precisa de Docker, indisponível neste
// ambiente) — mantenha este arquivo em sincronia manualmente ao alterar o schema.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "engenheiro" | "cliente";
export type TipoPessoa = "pf" | "pj";
export type TipoItemOrcamento = "material" | "servico" | "mao_de_obra";
export type ObraStatus = "planejamento" | "em_andamento" | "pausada" | "concluida";
export type PresencaStatus = "presente" | "falta" | "meia_diaria";
export type FechamentoStatus = "aberto" | "pago";
export type TipoContratoEquipe = "diaria" | "empreitada";
/** Em que condição o colaborador trabalha — diferente de `FormaPagamento`, que é por onde o dinheiro sai. */
export type RegimePagamento = "diaria" | "pacote_servico";
export type CondicaoPagamento = "a_vista" | "prazo";
export type FormaPagamento =
  | "dinheiro"
  | "pix"
  | "boleto"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "cheque"
  | "outro";
export type CompraStatus = "cotada" | "aprovada" | "recusada" | "paga";
export type ParcelaStatus = "pendente" | "paga" | "vencida";
export type DescontoTipo = "valor" | "percentual";
export type OrcamentoVersaoStatus = "rascunho" | "ativa" | "substituida";
export type LocacaoUnidade = "dia" | "hora" | "mes";
/** Condição do tempo, como aparece no RDO. */
export type DiarioCondicao = "ensolarado" | "nublado" | "chuvoso" | "chuva_forte";
export type DependenciaTipo =
  | "termino_inicio"
  | "inicio_inicio"
  | "termino_termino"
  | "inicio_termino";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          nome: string;
          telefone: string | null;
          email: string | null;
          tipo_pessoa: TipoPessoa | null;
          cpf_cnpj: string | null;
          crea: string | null;
          assinatura_path: string | null;
          logo_path: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          nome: string;
          telefone?: string | null;
          email?: string | null;
          tipo_pessoa?: TipoPessoa | null;
          cpf_cnpj?: string | null;
          crea?: string | null;
          assinatura_path?: string | null;
          logo_path?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      obras: {
        Row: {
          id: string;
          nome: string;
          status: ObraStatus;
          data_inicio: string | null;
          data_fim_prevista: string | null;
          criado_por: string;
          created_at: string;
          updated_at: string;
          // Localização
          cep: string | null;
          logradouro: string | null;
          numero: string | null;
          complemento: string | null;
          bairro: string | null;
          cidade: string | null;
          uf: string | null;
          link_maps: string | null;
          // Dados municipais
          setor: string | null;
          quadra: string | null;
          lote: string | null;
          cadastro_municipal: string | null;
          alvara_construcao: string | null;
          art_rrt_execucao: string | null;
          cno: string | null;
          // Características
          categoria: string;
          tipo_obra_id: string | null;
          metragem_quadrada: number | null;
          padrao_acabamento: string | null;
          faixa: string | null;
          quartos: number;
          suites: number;
          banheiros: number;
          financiada: boolean;
          // Imagens (path no bucket privado `obra-imagens`, não URL)
          imagem_capa_path: string | null;
          imagem_rdo_path: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          status?: ObraStatus;
          data_inicio?: string | null;
          data_fim_prevista?: string | null;
          criado_por: string;
          created_at?: string;
          updated_at?: string;
          cep?: string | null;
          logradouro?: string | null;
          numero?: string | null;
          complemento?: string | null;
          bairro?: string | null;
          cidade?: string | null;
          uf?: string | null;
          link_maps?: string | null;
          setor?: string | null;
          quadra?: string | null;
          lote?: string | null;
          cadastro_municipal?: string | null;
          alvara_construcao?: string | null;
          art_rrt_execucao?: string | null;
          cno?: string | null;
          categoria?: string;
          tipo_obra_id?: string | null;
          metragem_quadrada?: number | null;
          padrao_acabamento?: string | null;
          faixa?: string | null;
          quartos?: number;
          suites?: number;
          banheiros?: number;
          financiada?: boolean;
          imagem_capa_path?: string | null;
          imagem_rdo_path?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["obras"]["Insert"]>;
        Relationships: [];
      };
      obra_tipos: {
        Row: {
          id: string;
          nome: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["obra_tipos"]["Insert"]>;
        Relationships: [];
      };
      obra_clientes: {
        Row: {
          obra_id: string;
          cliente_id: string;
          created_at: string;
        };
        Insert: {
          obra_id: string;
          cliente_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["obra_clientes"]["Insert"]>;
        Relationships: [];
      };
      categorias_financeiras: {
        Row: {
          id: string;
          nome: string;
          /** Mapeia a categoria para o vocabulário de orcamento_itens. */
          tipo_item: TipoItemOrcamento | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          tipo_item?: TipoItemOrcamento | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categorias_financeiras"]["Insert"]>;
        Relationships: [];
      };
      fornecedores: {
        Row: {
          id: string;
          nome: string;
          cnpj_cpf: string | null;
          telefone: string | null;
          email: string | null;
          observacoes: string | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          cnpj_cpf?: string | null;
          telefone?: string | null;
          email?: string | null;
          observacoes?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fornecedores"]["Insert"]>;
        Relationships: [];
      };
      fornecedor_contatos: {
        Row: {
          id: string;
          fornecedor_id: string;
          nome: string;
          telefone: string | null;
          email: string | null;
          principal: boolean;
          observacoes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fornecedor_id: string;
          nome: string;
          telefone?: string | null;
          email?: string | null;
          principal?: boolean;
          observacoes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fornecedor_contatos"]["Insert"]>;
        Relationships: [];
      };
      /**
       * Separada de `fornecedores` de propósito: aquela tabela é legível por
       * qualquer autenticado (o portal do cliente precisa do nome), e RLS é
       * por linha, não por coluna. Dados bancários e prazo negociado não podem
       * sair junto com o nome.
       */
      fornecedor_pagamento: {
        Row: {
          fornecedor_id: string;
          forma_pagamento: FormaPagamento | null;
          dados_pagamento: string | null;
          condicao_pagamento: CondicaoPagamento | null;
          condicao_prazo: string | null;
          updated_at: string;
        };
        Insert: {
          fornecedor_id: string;
          forma_pagamento?: FormaPagamento | null;
          dados_pagamento?: string | null;
          condicao_pagamento?: CondicaoPagamento | null;
          condicao_prazo?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fornecedor_pagamento"]["Insert"]>;
        Relationships: [];
      };
      trabalhadores: {
        Row: {
          id: string;
          nome: string;
          cpf: string | null;
          funcao: string | null;
          valor_diaria_padrao: number | null;
          telefone: string | null;
          regime_pagamento: RegimePagamento;
          forma_pagamento: FormaPagamento | null;
          dados_pagamento: string | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          cpf?: string | null;
          funcao?: string | null;
          valor_diaria_padrao?: number | null;
          telefone?: string | null;
          regime_pagamento?: RegimePagamento;
          forma_pagamento?: FormaPagamento | null;
          dados_pagamento?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trabalhadores"]["Insert"]>;
        Relationships: [];
      };
      obra_trabalhadores: {
        Row: {
          obra_id: string;
          trabalhador_id: string;
          valor_diaria: number;
          data_inicio: string;
          data_fim: string | null;
          ativo: boolean;
        };
        Insert: {
          obra_id: string;
          trabalhador_id: string;
          valor_diaria: number;
          data_inicio?: string;
          data_fim?: string | null;
          ativo?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["obra_trabalhadores"]["Insert"]>;
        Relationships: [];
      };
      presencas: {
        Row: {
          id: string;
          obra_id: string;
          trabalhador_id: string;
          data: string;
          status: PresencaStatus;
          observacoes: string | null;
          registrado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          trabalhador_id: string;
          data: string;
          status?: PresencaStatus;
          observacoes?: string | null;
          registrado_por: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["presencas"]["Insert"]>;
        Relationships: [];
      };
      fechamentos_periodo: {
        Row: {
          id: string;
          obra_id: string;
          trabalhador_id: string;
          equipe_id: string | null;
          periodo_inicio: string;
          periodo_fim: string;
          dias_trabalhados: number;
          valor_diaria: number;
          valor_total: number;
          status: FechamentoStatus;
          data_pagamento: string | null;
          comprovante_path: string | null;
          observacoes: string | null;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          trabalhador_id: string;
          equipe_id?: string | null;
          periodo_inicio: string;
          periodo_fim: string;
          dias_trabalhados?: number;
          valor_diaria: number;
          status?: FechamentoStatus;
          data_pagamento?: string | null;
          comprovante_path?: string | null;
          observacoes?: string | null;
          criado_por: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fechamentos_periodo"]["Insert"]>;
        Relationships: [];
      };
      equipes: {
        Row: {
          id: string;
          nome: string;
          responsavel_id: string | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          responsavel_id?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["equipes"]["Insert"]>;
        Relationships: [];
      };
      obra_equipes: {
        Row: {
          obra_id: string;
          equipe_id: string;
          tipo_contrato: TipoContratoEquipe;
          unidade_medida: string | null;
          valor_unidade: number | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          obra_id: string;
          equipe_id: string;
          tipo_contrato?: TipoContratoEquipe;
          unidade_medida?: string | null;
          valor_unidade?: number | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["obra_equipes"]["Insert"]>;
        Relationships: [];
      };
      equipe_trabalhadores: {
        Row: {
          equipe_id: string;
          trabalhador_id: string;
        };
        Insert: {
          equipe_id: string;
          trabalhador_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["equipe_trabalhadores"]["Insert"]>;
        Relationships: [];
      };
      fechamentos_entrega: {
        Row: {
          id: string;
          obra_id: string;
          equipe_id: string;
          periodo_inicio: string;
          periodo_fim: string;
          quantidade_entregue: number;
          unidade_medida: string;
          valor_unidade: number;
          valor_total: number;
          status: FechamentoStatus;
          data_pagamento: string | null;
          comprovante_path: string | null;
          observacoes: string | null;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          equipe_id: string;
          periodo_inicio: string;
          periodo_fim: string;
          quantidade_entregue: number;
          unidade_medida: string;
          valor_unidade: number;
          status?: FechamentoStatus;
          data_pagamento?: string | null;
          comprovante_path?: string | null;
          observacoes?: string | null;
          criado_por: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fechamentos_entrega"]["Insert"]>;
        Relationships: [];
      };
      cronograma_etapas: {
        Row: {
          id: string;
          obra_id: string;
          nome: string;
          ordem: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          nome: string;
          ordem: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cronograma_etapas"]["Insert"]>;
        Relationships: [];
      };
      cronograma_tarefas: {
        Row: {
          id: string;
          etapa_id: string;
          obra_id: string;
          nome: string;
          duracao_dias: number;
          orcamento_item_id: string | null;
          restricao_inicio_nao_antes_de: string | null;
          baseline_inicio: string | null;
          baseline_fim: string | null;
          data_inicio_cedo: string | null;
          data_fim_cedo: string | null;
          data_inicio_tarde: string | null;
          data_fim_tarde: string | null;
          folga_dias: number | null;
          critica: boolean;
          data_inicio_real: string | null;
          data_fim_real: string | null;
          lembrete_dias_antes: number | null;
          ordem: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          etapa_id: string;
          obra_id: string;
          nome: string;
          duracao_dias?: number;
          orcamento_item_id?: string | null;
          restricao_inicio_nao_antes_de?: string | null;
          baseline_inicio?: string | null;
          baseline_fim?: string | null;
          data_inicio_cedo?: string | null;
          data_fim_cedo?: string | null;
          data_inicio_tarde?: string | null;
          data_fim_tarde?: string | null;
          folga_dias?: number | null;
          critica?: boolean;
          data_inicio_real?: string | null;
          data_fim_real?: string | null;
          lembrete_dias_antes?: number | null;
          ordem: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cronograma_tarefas"]["Insert"]>;
        Relationships: [];
      };
      cronograma_dependencias: {
        Row: {
          id: string;
          tarefa_predecessora_id: string;
          tarefa_sucessora_id: string;
          tipo: DependenciaTipo;
          lag_dias: number;
        };
        Insert: {
          id?: string;
          tarefa_predecessora_id: string;
          tarefa_sucessora_id: string;
          tipo?: DependenciaTipo;
          lag_dias?: number;
        };
        Update: Partial<Database["public"]["Tables"]["cronograma_dependencias"]["Insert"]>;
        Relationships: [];
      };
      funcoes: {
        Row: { id: string; nome: string; ativo: boolean; created_at: string };
        Insert: { id?: string; nome: string; ativo?: boolean; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["funcoes"]["Insert"]>;
        Relationships: [];
      };
      /** Quantas pessoas de cada função estiveram na obra no dia (0057). */
      diario_efetivo_funcoes: {
        Row: {
          id: string;
          diario_id: string;
          funcao_id: string;
          quantidade: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          diario_id: string;
          funcao_id: string;
          quantidade: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["diario_efetivo_funcoes"]["Insert"]>;
        Relationships: [];
      };
      diario_obra: {
        Row: {
          id: string;
          obra_id: string;
          data: string;
          /** Condição do tempo do dia. Substituiu clima_manha/tarde/noite. */
          clima: DiarioCondicao | null;
          atividades: string | null;
          ocorrencias: string | null;
          visitas: string | null;
          temperatura: number | null;
          /** DESCONTINUADA (0052): só registros antigos. Nenhuma tela lê ou escreve. */
          umidade: number | null;
          /** Equipamentos em obra que não vêm de uma locação cadastrada. */
          equipamentos_extras: string | null;
          /** Entregas recebidas que não vêm de uma ordem de compra. */
          entregas_extras: string | null;
          efetivo_snapshot: Json | null;
          /** Nomes dos responsáveis das equipes, congelados no fechamento (0055). */
          responsaveis_snapshot: Json | null;
          equipamentos_snapshot: Json | null;
          tarefas_snapshot: Json | null;
          entregas_snapshot: Json | null;
          fechado_em: string | null;
          fechado_por: string | null;
          reaberto_em: string | null;
          registrado_por: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          data: string;
          clima?: DiarioCondicao | null;
          atividades?: string | null;
          ocorrencias?: string | null;
          visitas?: string | null;
          temperatura?: number | null;
          umidade?: number | null;
          equipamentos_extras?: string | null;
          entregas_extras?: string | null;
          efetivo_snapshot?: Json | null;
          responsaveis_snapshot?: Json | null;
          equipamentos_snapshot?: Json | null;
          tarefas_snapshot?: Json | null;
          entregas_snapshot?: Json | null;
          fechado_em?: string | null;
          fechado_por?: string | null;
          reaberto_em?: string | null;
          registrado_por: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["diario_obra"]["Insert"]>;
        Relationships: [];
      };
      diario_fotos: {
        Row: {
          id: string;
          diario_id: string;
          obra_id: string;
          path: string;
          legenda: string | null;
          enviado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          diario_id: string;
          obra_id: string;
          path: string;
          legenda?: string | null;
          enviado_por: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["diario_fotos"]["Insert"]>;
        Relationships: [];
      };
      locacoes_equipamento: {
        Row: {
          id: string;
          obra_id: string;
          fornecedor_id: string;
          equipamento: string;
          quantidade: number;
          unidade: LocacaoUnidade;
          valor_unitario: number;
          data_inicio: string;
          horas_utilizadas: number;
          data_devolucao: string | null;
          /** Só na cobrança mensal: vencimento da primeira mensalidade. */
          data_primeiro_vencimento: string | null;
          /** Só na cobrança mensal: quantas mensalidades o contrato prevê. */
          meses_contratados: number | null;
          observacoes: string | null;
          criado_por: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          fornecedor_id: string;
          equipamento: string;
          quantidade?: number;
          unidade?: LocacaoUnidade;
          valor_unitario: number;
          data_inicio: string;
          horas_utilizadas?: number;
          data_devolucao?: string | null;
          data_primeiro_vencimento?: string | null;
          meses_contratados?: number | null;
          observacoes?: string | null;
          criado_por: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["locacoes_equipamento"]["Insert"]>;
        Relationships: [];
      };
      cronograma_folgas: {
        Row: {
          id: string;
          obra_id: string;
          data_inicio: string;
          data_fim: string;
          descricao: string | null;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          data_inicio: string;
          data_fim: string;
          descricao?: string | null;
          criado_por: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cronograma_folgas"]["Insert"]>;
        Relationships: [];
      };
      compras: {
        Row: {
          id: string;
          obra_id: string;
          fornecedor_id: string;
          descricao: string;
          valor_total: number;
          forma_pagamento: FormaPagamento;
          status: CompraStatus;
          anexo_cotacao_path: string | null;
          data_cotacao: string;
          aprovado_por: string | null;
          aprovado_em: string | null;
          motivo_recusa: string | null;
          desconto_tipo: DescontoTipo | null;
          desconto_valor: number | null;
          requer_aprovacao_cliente: boolean;
          pagamento_apos_recebimento: boolean;
          /** Nome da etapa do orçamento, para comparar orçado × comprado. */
          orcamento_etapa: string | null;
          /** O que a ordem compra. Deduzido da categoria escolhida. */
          tipo_item: TipoItemOrcamento | null;
          /** Categoria financeira — "que tipo de pagamento é este". */
          categoria_id: string | null;
          /** Entrega da ORDEM inteira, não de cada parcela. */
          data_entrega_prevista: string | null;
          data_entrega_real: string | null;
          recebimento_confirmado_por: string | null;
          recebimento_confirmado_em: string | null;
          /** Despesa já paga, sem cotação, aprovação, entrega nem parcelamento. */
          eh_lancamento: boolean;
          /**
           * Preenchida quando a ordem foi gerada por uma locação mensal (0053).
           * Essas ordens contam como Equipamentos, não como compras.
           */
          locacao_id: string | null;
          /** Número da NF. Nulo quando a compra não tem nota. */
          nota_fiscal_numero: string | null;
          nota_fiscal_emissao: string | null;
          criado_por: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          fornecedor_id: string;
          descricao: string;
          valor_total: number;
          forma_pagamento: FormaPagamento;
          status?: CompraStatus;
          anexo_cotacao_path?: string | null;
          data_cotacao?: string;
          aprovado_por?: string | null;
          aprovado_em?: string | null;
          motivo_recusa?: string | null;
          desconto_tipo?: DescontoTipo | null;
          desconto_valor?: number | null;
          requer_aprovacao_cliente?: boolean;
          pagamento_apos_recebimento?: boolean;
          orcamento_etapa?: string | null;
          tipo_item?: TipoItemOrcamento | null;
          categoria_id?: string | null;
          data_entrega_prevista?: string | null;
          data_entrega_real?: string | null;
          recebimento_confirmado_por?: string | null;
          recebimento_confirmado_em?: string | null;
          eh_lancamento?: boolean;
          locacao_id?: string | null;
          nota_fiscal_numero?: string | null;
          nota_fiscal_emissao?: string | null;
          criado_por: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["compras"]["Insert"]>;
        Relationships: [];
      };
      compra_anexos: {
        Row: {
          id: string;
          compra_id: string;
          bucket: "cotacoes" | "comprovantes-pagamento";
          path: string;
          nome: string;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          compra_id: string;
          bucket: "cotacoes" | "comprovantes-pagamento";
          path: string;
          nome: string;
          criado_por?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["compra_anexos"]["Insert"]>;
        Relationships: [];
      };
      compra_itens: {
        Row: {
          id: string;
          compra_id: string;
          orcamento_item_id: string | null;
          descricao: string;
          unidade: string;
          quantidade: number;
          preco_unitario: number;
          desconto_tipo: DescontoTipo | null;
          desconto_valor: number | null;
          subtotal: number;
          total_liquido: number;
          ordem: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          compra_id: string;
          orcamento_item_id?: string | null;
          descricao: string;
          unidade: string;
          quantidade?: number;
          preco_unitario?: number;
          desconto_tipo?: DescontoTipo | null;
          desconto_valor?: number | null;
          ordem: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["compra_itens"]["Insert"]>;
        Relationships: [];
      };
      compra_parcelas: {
        Row: {
          id: string;
          compra_id: string;
          numero_parcela: number;
          valor: number;
          data_vencimento: string;
          data_pagamento: string | null;
          status: ParcelaStatus;
          comprovante_pagamento_path: string | null;
          /** Data em que o pagamento foi lançado. Null = ainda não foi enviado. */
          pagamento_enviado_em: string | null;
          pagamento_enviado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          compra_id: string;
          numero_parcela: number;
          valor: number;
          data_vencimento: string;
          data_pagamento?: string | null;
          status?: ParcelaStatus;
          comprovante_pagamento_path?: string | null;
          pagamento_enviado_em?: string | null;
          pagamento_enviado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["compra_parcelas"]["Insert"]>;
        Relationships: [];
      };
      orcamento_mapeamentos: {
        Row: {
          obra_id: string;
          linha_cabecalho: number;
          mapa_colunas: Json;
          updated_at: string;
        };
        Insert: {
          obra_id: string;
          linha_cabecalho: number;
          mapa_colunas: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orcamento_mapeamentos"]["Insert"]>;
        Relationships: [];
      };
      orcamento_versoes: {
        Row: {
          id: string;
          obra_id: string;
          titulo: string | null;
          etapas: string[];
          mes_referencia: string | null;
          arquivo_original_path: string | null;
          status: OrcamentoVersaoStatus;
          observacoes: string | null;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          titulo?: string | null;
          etapas?: string[];
          mes_referencia?: string | null;
          arquivo_original_path?: string | null;
          status?: OrcamentoVersaoStatus;
          observacoes?: string | null;
          criado_por: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orcamento_versoes"]["Insert"]>;
        Relationships: [];
      };
      sinapi_tabelas: {
        Row: {
          id: string;
          mes_referencia: string;
          arquivo_original_path: string;
          status: OrcamentoVersaoStatus;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          mes_referencia: string;
          arquivo_original_path: string;
          status?: OrcamentoVersaoStatus;
          criado_por: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sinapi_tabelas"]["Insert"]>;
        Relationships: [];
      };
      sinapi_itens: {
        Row: {
          id: string;
          sinapi_tabela_id: string;
          codigo: string;
          descricao: string;
          unidade: string;
          preco_unitario: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sinapi_tabela_id: string;
          codigo: string;
          descricao: string;
          unidade: string;
          preco_unitario?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sinapi_itens"]["Insert"]>;
        Relationships: [];
      };
      sinapi_mapeamento: {
        Row: {
          id: boolean;
          linha_cabecalho: number;
          mapa_colunas: Json;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          linha_cabecalho: number;
          mapa_colunas: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sinapi_mapeamento"]["Insert"]>;
        Relationships: [];
      };
      orcamento_itens: {
        Row: {
          id: string;
          orcamento_versao_id: string;
          ordem: number;
          codigo_sinapi: string | null;
          descricao: string;
          unidade: string;
          quantidade: number;
          preco_unitario: number;
          preco_total: number;
          etapa: string | null;
          tipo_item: TipoItemOrcamento | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          orcamento_versao_id: string;
          ordem: number;
          codigo_sinapi?: string | null;
          descricao: string;
          unidade: string;
          quantidade?: number;
          preco_unitario?: number;
          etapa?: string | null;
          tipo_item?: TipoItemOrcamento | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orcamento_itens"]["Insert"]>;
        Relationships: [];
      };
      avanco_registros: {
        Row: {
          id: string;
          obra_id: string;
          /** O avanço é medido na tarefa do cronograma, não no item do orçamento. */
          cronograma_tarefa_id: string;
          data_medicao: string;
          /** 0 a 100, informado pelo engenheiro. */
          percentual: number;
          observacoes: string | null;
          registrado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          cronograma_tarefa_id: string;
          data_medicao?: string;
          percentual: number;
          observacoes?: string | null;
          registrado_por: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["avanco_registros"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      vw_compra_parcelas: {
        Row: Database["public"]["Tables"]["compra_parcelas"]["Row"] & {
          status_efetivo: ParcelaStatus;
          pagamento_apos_recebimento: boolean;
          /** Falsa enquanto a compra depende de recebimento e a mercadoria não chegou. */
          liberada_para_pagamento: boolean;
          /** Entrega da ordem. A da parcela ficou obsoleta — ver 0045. */
          entrega_prevista_ordem: string | null;
          entrega_real_ordem: string | null;
        };
        Relationships: [];
      };
      vw_custo_mao_de_obra: {
        Row: {
          obra_id: string;
          total: number | null;
          pago: number | null;
          aberto: number | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      vw_equipe_ativa_obra: {
        Row: {
          obra_id: string;
          trabalhadores_ativos: number;
        };
        Relationships: [];
      };
      vw_avanco_atual: {
        Row: {
          cronograma_tarefa_id: string;
          obra_id: string;
          data_medicao: string;
          percentual: number;
        };
        Relationships: [];
      };
      /** Parcela + compra + fornecedor achatados, para buscar e paginar no banco (0050). */
      vw_lancamentos_cliente: {
        Row: Database["public"]["Views"]["vw_compra_parcelas"]["Row"] & {
          obra_id: string;
          descricao: string;
          tipo_item: TipoItemOrcamento | null;
          forma_pagamento: FormaPagamento;
          eh_lancamento: boolean;
          criado_por: string | null;
          fornecedor_nome: string;
        };
        Relationships: [];
      };
      /** Soma por forma de pagamento, agregada no banco (0050). */
      vw_lancamentos_resumo_forma: {
        Row: {
          obra_id: string;
          forma_pagamento: FormaPagamento;
          total: number;
        };
        Relationships: [];
      };
      vw_progresso_obra: {
        Row: {
          obra_id: string;
          /** Null quando a obra não tem orçamento ativo. */
          orcamento_versao_id: string | null;
          valor_orcado_total: number;
          valor_executado_ponderado: number;
          percentual_fisico: number;
          total_tarefas: number;
          tarefas_concluidas: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_engenheiro: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      /** Soma de `valor_total` das compras que casam com o filtro da listagem (0056). */
      somar_compras_da_obra: {
        Args: { p_obra_id: string; p_tipo?: string | null; p_busca?: string | null };
        Returns: number;
      };
      /** Null quando deu tudo certo; a mensagem para o usuário quando não (0054). */
      sincronizar_mensalidades_locacao: {
        Args: { p_locacao_id: string };
        Returns: string | null;
      };
      cliente_tem_acesso_obra: {
        Args: { p_obra_id: string };
        Returns: boolean;
      };
      calcular_dias_trabalhados: {
        Args: {
          p_obra_id: string;
          p_trabalhador_id: string;
          p_inicio: string;
          p_fim: string;
        };
        Returns: number;
      };
      aprovar_compra: {
        Args: { p_compra_id: string };
        Returns: undefined;
      };
      recusar_compra: {
        Args: { p_compra_id: string; p_motivo: string };
        Returns: undefined;
      };
      pagar_parcela: {
        Args: { p_parcela_id: string; p_comprovante_path: string };
        Returns: undefined;
      };
      aprovar_e_pagar_parcela: {
        Args: { p_compra_id: string; p_parcela_id: string; p_comprovante_path: string };
        Returns: undefined;
      };
      cli_marcar_entrega_lancamento: {
        Args: { p_compra_id: string; p_entregue: boolean };
        Returns: undefined;
      };
      logo_da_empresa: {
        Args: Record<string, never>;
        Returns: { logo_path: string | null; nome: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      obra_status: ObraStatus;
      presenca_status: PresencaStatus;
      fechamento_status: FechamentoStatus;
      forma_pagamento: FormaPagamento;
      compra_status: CompraStatus;
      parcela_status: ParcelaStatus;
      orcamento_versao_status: OrcamentoVersaoStatus;
      desconto_tipo: DescontoTipo;
      regime_pagamento: RegimePagamento;
      condicao_pagamento: CondicaoPagamento;
      locacao_unidade: LocacaoUnidade;
      diario_clima: DiarioCondicao;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
