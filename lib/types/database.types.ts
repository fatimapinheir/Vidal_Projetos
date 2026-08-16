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
export type ObraTipo = "residencial" | "comercial";
export type ObraStatus = "planejamento" | "em_andamento" | "pausada" | "concluida";
export type PresencaStatus = "presente" | "falta" | "meia_diaria";
export type FechamentoStatus = "aberto" | "pago";
export type TipoContratoEquipe = "diaria" | "empreitada";
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
export type LocacaoUnidade = "dia" | "hora";
export type DiarioClima = "praticavel" | "chuva" | "impraticavel";
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
          created_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          nome: string;
          telefone?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      obras: {
        Row: {
          id: string;
          nome: string;
          endereco: string | null;
          tipo: ObraTipo;
          status: ObraStatus;
          data_inicio: string | null;
          data_fim_prevista: string | null;
          criado_por: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          endereco?: string | null;
          tipo?: ObraTipo;
          status?: ObraStatus;
          data_inicio?: string | null;
          data_fim_prevista?: string | null;
          criado_por: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["obras"]["Insert"]>;
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
      fornecedores: {
        Row: {
          id: string;
          nome: string;
          cnpj_cpf: string | null;
          telefone: string | null;
          email: string | null;
          observacoes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          cnpj_cpf?: string | null;
          telefone?: string | null;
          email?: string | null;
          observacoes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fornecedores"]["Insert"]>;
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
          obra_id: string;
          nome: string;
          tipo_contrato: TipoContratoEquipe;
          responsavel_id: string | null;
          unidade_medida: string | null;
          valor_unidade: number | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          nome: string;
          tipo_contrato?: TipoContratoEquipe;
          responsavel_id?: string | null;
          unidade_medida?: string | null;
          valor_unidade?: number | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["equipes"]["Insert"]>;
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
      diario_obra: {
        Row: {
          id: string;
          obra_id: string;
          data: string;
          clima_manha: DiarioClima | null;
          clima_tarde: DiarioClima | null;
          clima_noite: DiarioClima | null;
          atividades: string | null;
          ocorrencias: string | null;
          visitas: string | null;
          efetivo_snapshot: Json | null;
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
          clima_manha?: DiarioClima | null;
          clima_tarde?: DiarioClima | null;
          clima_noite?: DiarioClima | null;
          atividades?: string | null;
          ocorrencias?: string | null;
          visitas?: string | null;
          efetivo_snapshot?: Json | null;
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
          criado_por: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["compras"]["Insert"]>;
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
          data_entrega_prevista: string | null;
          data_entrega_real: string | null;
          data_pagamento: string | null;
          status: ParcelaStatus;
          comprovante_pagamento_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          compra_id: string;
          numero_parcela: number;
          valor: number;
          data_vencimento: string;
          data_entrega_prevista?: string | null;
          data_entrega_real?: string | null;
          data_pagamento?: string | null;
          status?: ParcelaStatus;
          comprovante_pagamento_path?: string | null;
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
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orcamento_itens"]["Insert"]>;
        Relationships: [];
      };
      avanco_registros: {
        Row: {
          id: string;
          obra_id: string;
          orcamento_item_id: string;
          data_medicao: string;
          quantidade_executada_acumulada: number;
          observacoes: string | null;
          registrado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          orcamento_item_id: string;
          data_medicao?: string;
          quantidade_executada_acumulada: number;
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
        };
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
          orcamento_item_id: string;
          obra_id: string;
          data_medicao: string;
          quantidade_executada_acumulada: number;
        };
        Relationships: [];
      };
      vw_progresso_obra: {
        Row: {
          obra_id: string;
          orcamento_versao_id: string;
          valor_orcado_total: number;
          valor_executado_ponderado: number;
          percentual_fisico: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_engenheiro: {
        Args: Record<string, never>;
        Returns: boolean;
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
    };
    Enums: {
      user_role: UserRole;
      obra_tipo: ObraTipo;
      obra_status: ObraStatus;
      presenca_status: PresencaStatus;
      fechamento_status: FechamentoStatus;
      forma_pagamento: FormaPagamento;
      compra_status: CompraStatus;
      parcela_status: ParcelaStatus;
      orcamento_versao_status: OrcamentoVersaoStatus;
      desconto_tipo: DescontoTipo;
      locacao_unidade: LocacaoUnidade;
      diario_clima: DiarioClima;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
