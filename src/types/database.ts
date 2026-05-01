export type Empresa = {
  id: string
  user_id: string
  nome: string
  cnpj?: string
  segmento: 'Comércio varejista' | 'Comércio atacadista' | 'Indústria' | 'Serviços' | 'Construção civil' | 'Agronegócio' | 'Saúde e clínicas' | 'Tecnologia / SaaS' | 'Educação' | 'Outro'
  segmento_personalizado?: string
  ativo: boolean
  created_at: string
}

export type Relatorio = {
  id: string
  empresa_id: string
  periodo: string
  trimestre: number
  ano: number
  status: 'pendente' | 'processando' | 'concluido' | 'erro'
  arquivo_dre_url?: string
  arquivo_balancete_url?: string
  ai_resumo_executivo?: string
  ai_insight_critico?: string
  ai_recomendacoes?: string
  score_saude?: number
  processado_em?: string
  created_at: string
}

export type Indicador = {
  id: string
  relatorio_id: string
  categoria: 'liquidez' | 'rentabilidade' | 'endividamento' | 'atividade'
  nome: string
  valor: number
  valor_formatado: string
  o_que_e: string
  descricao_simples: string
  benchmark_referencia: string
  contexto_segmento?: string
  status: 'bom' | 'atencao' | 'critico'
  created_at: string
}

export type HistoricoIndicador = {
  id: string
  empresa_id: string
  indicador_nome: string
  categoria: string
  valor: number
  status: string
  periodo: string
  trimestre: number
  ano: number
  created_at: string
}

export type AIJobLog = {
  id: string
  relatorio_id: string
  tipo_job: string
  status: 'iniciado' | 'sucesso' | 'erro'
  erro_mensagem?: string
  tokens_usados?: number
  iniciado_em: string
  finalizado_em?: string
}

export type User = {
  id: string
  email: string
  created_at: string
}
