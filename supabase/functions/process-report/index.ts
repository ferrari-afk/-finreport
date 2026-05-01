import { createClient } from 'supabase-js'
import { Anthropic } from 'anthropic'
import * as XLSX from 'xlsx'

interface ProcessReportRequest {
  relatorio_id: string
}

interface IndicadorIA {
  categoria: string
  nome: string
  valor: number
  valor_formatado: string
  o_que_e: string
  descricao_simples: string
  benchmark_referencia: string
  contexto_segmento: string | null
  status: 'bom' | 'atencao' | 'critico'
}

interface RespostaIA {
  periodo: string
  trimestre: number
  ano: number
  score_saude: number
  ai_resumo_executivo: string
  ai_insight_critico: string
  ai_recomendacoes: string
  indicadores: IndicadorIA[]
}

Deno.serve(async (req: Request) => {
  try {
    // Validar request
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const { relatorio_id } = (await req.json()) as ProcessReportRequest

    if (!relatorio_id) {
      return new Response(JSON.stringify({ error: 'relatorio_id é obrigatório' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Inicializar clientes
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey || !anthropicApiKey) {
      throw new Error('Variáveis de ambiente não configuradas')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    const anthropic = new Anthropic({ apiKey: anthropicApiKey })

    // 1. Buscar relatório e dados da empresa
    console.log(`[1/8] Buscando relatório ${relatorio_id}...`)
    const { data: relatorioData, error: relatorioError } = await supabase
      .from('relatorios')
      .select(
        `
        id,
        empresa_id,
        periodo,
        trimestre,
        ano,
        arquivo_dre_url,
        arquivo_balancete_url,
        empresas (
          nome,
          segmento,
          segmento_personalizado
        )
      `
      )
      .eq('id', relatorio_id)
      .single()

    if (relatorioError || !relatorioData) {
      throw new Error(`Relatório não encontrado: ${relatorioError?.message}`)
    }

    const relatorio = relatorioData as any
    const empresa = relatorio.empresas
    const segmento = empresa.segmento === 'Outro' ? empresa.segmento_personalizado : empresa.segmento

    // 2. Atualizar status para "processando"
    console.log('[2/8] Atualizando status para processando...')
    await supabase
      .from('relatorios')
      .update({ status: 'processando' })
      .eq('id', relatorio_id)

    // 3. Registrar início em ai_job_logs
    console.log('[3/8] Registrando job log...')
    const { data: jobLogData, error: jobLogError } = await supabase
      .from('ai_job_logs')
      .insert({
        relatorio_id,
        tipo_job: 'process_report',
        status: 'iniciado',
        iniciado_em: new Date().toISOString(),
      })
      .select()
      .single()

    if (jobLogError) throw jobLogError

    const jobLogId = (jobLogData as any).id

    // 4. Baixar arquivos usando URLs assinadas
    console.log('[4/8] Baixando arquivos do storage...')

    const { data: urlDreData } = await supabase.storage
      .from('relatorios')
      .createSignedUrl(relatorio.arquivo_dre_url, 3600)

    const { data: urlBalanceteData } = await supabase.storage
      .from('relatorios')
      .createSignedUrl(relatorio.arquivo_balancete_url, 3600)

    if (!urlDreData?.signedUrl || !urlBalanceteData?.signedUrl) {
      throw new Error('Não foi possível gerar URLs assinadas para os arquivos')
    }

    // Baixar conteúdo dos arquivos
    const responseDre = await fetch(urlDreData.signedUrl)
    const responseBalancete = await fetch(urlBalanceteData.signedUrl)

    if (!responseDre.ok || !responseBalancete.ok) {
      throw new Error('Erro ao fazer download dos arquivos')
    }

    const arrayBufferDre = await responseDre.arrayBuffer()
    const arrayBufferBalancete = await responseBalancete.arrayBuffer()

    // 5. Extrair texto dos arquivos
    console.log('[5/8] Extraindo texto dos arquivos...')

    const textoDre = await extrairTexto(
      arrayBufferDre,
      relatorio.arquivo_dre_url,
      'DRE'
    )
    const textoBalancete = await extrairTexto(
      arrayBufferBalancete,
      relatorio.arquivo_balancete_url,
      'Balancete'
    )

    // 6. Chamar API Anthropic
    console.log('[6/8] Chamando Claude para análise...')

    const mensagemUsuario = `Empresa: ${empresa.nome}
Segmento: ${segmento}

CONTEÚDO DA DRE:
${textoDre}

CONTEÚDO DO BALANCETE:
${textoBalancete}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `Você é um analista financeiro sênior especializado em pequenas e médias
empresas brasileiras. Receberá o conteúdo de documentos financeiros
(DRE e Balancete) de uma empresa e o seu segmento de atuação.

Sua tarefa é calcular os indicadores financeiros disponíveis,
interpretá-los considerando o segmento informado, e retornar
SOMENTE um JSON válido — sem texto adicional, sem markdown,
sem blocos de código, sem explicações fora do JSON.

INDICADORES A CALCULAR (use os que tiver dados disponíveis):

LIQUIDEZ:
  liquidez_corrente = Ativo Circulante / Passivo Circulante
  liquidez_seca = (Ativo Circulante - Estoques) / Passivo Circulante
  liquidez_imediata = Disponibilidades / Passivo Circulante
  liquidez_geral = (AC + ARLP) / (PC + PELP)

RENTABILIDADE:
  margem_bruta = Lucro Bruto / Receita Líquida * 100
  margem_ebitda = (Resultado Operacional + Depreciação) / Receita Líquida * 100
  margem_liquida = Lucro Líquido / Receita Líquida * 100
  roa = Lucro Líquido / Ativo Total * 100
  roe = Lucro Líquido / Patrimônio Líquido * 100

ENDIVIDAMENTO:
  endividamento_geral = Passivo Total / Ativo Total * 100
  composicao_endividamento = Passivo Circulante / Passivo Total * 100
  imobilizacao_pl = Ativo Imobilizado / Patrimônio Líquido * 100

ATIVIDADE:
  giro_ativos = Receita Líquida / Ativo Total
  pmr = (Contas a Receber / Receita Bruta) * 90
  pmp = (Fornecedores / Compras) * 90
  pme = (Estoques / CMV) * 90
  ncg = AC Operacional - PC Operacional
  capital_giro = Ativo Circulante - Passivo Circulante

REGRAS DE STATUS — calibradas pelo segmento:
  Não use benchmarks fixos iguais para todos.
  Considere as características do segmento informado.
  Exemplos de variação:
    Margem bruta 20%: ótimo para atacado, ruim para SaaS
    Liquidez corrente 1,1: aceitável para serviços, baixo para indústria
    PMR 60 dias: normal para B2B industrial, alto para varejo
  Status: 'bom' | 'atencao' | 'critico'

SCORE DE SAÚDE (0 a 100):
  Calcule uma pontuação geral considerando todos os indicadores
  e o contexto do segmento. Penalize mais os indicadores críticos
  de endividamento e liquidez do que os de rentabilidade.

RETORNE EXATAMENTE NESTE FORMATO JSON (válido):
{
  "periodo": "${relatorio.periodo}",
  "trimestre": ${relatorio.trimestre},
  "ano": ${relatorio.ano},
  "score_saude": 38,
  "ai_resumo_executivo": "Texto de 2 a 3 frases resumindo a saúde financeira em linguagem acessível para o dono da empresa. Sem siglas não explicadas. Seja direto e útil.",
  "ai_insight_critico": "Uma frase descrevendo o maior risco identificado e por que merece atenção imediata.",
  "ai_recomendacoes": "1. Ação prática e específica.\\n2. Segunda ação com impacto real.\\n3. Terceira ação para o médio prazo.",
  "indicadores": [
    {
      "categoria": "liquidez",
      "nome": "Liquidez Corrente",
      "valor": 1.02,
      "valor_formatado": "1,02",
      "o_que_e": "Definição simples para o dono da empresa entender sem precisar de formação financeira.",
      "descricao_simples": "Interpretação do resultado desta empresa específica. Mencione os valores reais.",
      "benchmark_referencia": "Qual é o ideal para o segmento desta empresa e como o resultado se compara.",
      "contexto_segmento": "Observação do setor quando relevante. null se não houver nada específico a dizer.",
      "status": "bom"
    }
  ]
}`,
      messages: [
        {
          role: 'user',
          content: mensagemUsuario,
        },
      ],
    })

    // Extrair conteúdo da resposta
    const conteudoResposta = response.content[0]
    if (conteudoResposta.type !== 'text') {
      throw new Error('Resposta inesperada da API')
    }

    // Parse JSON
    console.log('[7/8] Processando resultado da IA...')
    let resultadoIA: RespostaIA

    try {
      // Limpar markdown se houver
      let jsonText = conteudoResposta.text.trim()
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7)
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3)
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3)
      }

      resultadoIA = JSON.parse(jsonText.trim())
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', conteudoResposta.text)
      throw new Error(`Erro ao processar resultado da IA: ${parseError.message}`)
    }

    // 7. Salvar indicadores no banco
    console.log('[8/8] Salvando dados no banco...')

    // Inserir indicadores
    const { error: indicadoresError } = await supabase
      .from('indicadores')
      .insert(
        resultadoIA.indicadores.map((ind) => ({
          relatorio_id,
          categoria: ind.categoria,
          nome: ind.nome,
          valor: ind.valor,
          valor_formatado: ind.valor_formatado,
          o_que_e: ind.o_que_e,
          descricao_simples: ind.descricao_simples,
          benchmark_referencia: ind.benchmark_referencia,
          contexto_segmento: ind.contexto_segmento,
          status: ind.status,
        }))
      )

    if (indicadoresError) throw indicadoresError

    // Inserir em histórico
    const { error: historicoError } = await supabase
      .from('historico_indicadores')
      .insert(
        resultadoIA.indicadores.map((ind) => ({
          empresa_id: relatorio.empresa_id,
          indicador_nome: ind.nome,
          categoria: ind.categoria,
          valor: ind.valor,
          status: ind.status,
          periodo: resultadoIA.periodo,
          trimestre: resultadoIA.trimestre,
          ano: resultadoIA.ano,
        }))
      )

    if (historicoError) throw historicoError

    // Atualizar relatório
    const { error: updateError } = await supabase
      .from('relatorios')
      .update({
        status: 'concluido',
        ai_resumo_executivo: resultadoIA.ai_resumo_executivo,
        ai_insight_critico: resultadoIA.ai_insight_critico,
        ai_recomendacoes: resultadoIA.ai_recomendacoes,
        score_saude: resultadoIA.score_saude,
        processado_em: new Date().toISOString(),
      })
      .eq('id', relatorio_id)

    if (updateError) throw updateError

    // Atualizar job log
    const { error: updateJobError } = await supabase
      .from('ai_job_logs')
      .update({
        status: 'sucesso',
        tokens_usados: response.usage.output_tokens + response.usage.input_tokens,
        finalizado_em: new Date().toISOString(),
      })
      .eq('id', jobLogId)

    if (updateJobError) throw updateJobError

    console.log('✓ Processamento concluído com sucesso!')

    return new Response(
      JSON.stringify({
        success: true,
        relatorio_id,
        score_saude: resultadoIA.score_saude,
        indicadores_criados: resultadoIA.indicadores.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro no processamento:', error)

    const mensagemErro = error instanceof Error ? error.message : 'Erro desconhecido'

    // Tentar atualizar relatório e job log com erro
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      if (supabaseUrl && supabaseServiceRoleKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

        const body = await this.text?.() || ''
        const { relatorio_id } = body ? JSON.parse(body) : {}

        if (relatorio_id) {
          await supabase
            .from('relatorios')
            .update({ status: 'erro' })
            .eq('id', relatorio_id)

          await supabase
            .from('ai_job_logs')
            .update({
              status: 'erro',
              erro_mensagem: mensagemErro,
              finalizado_em: new Date().toISOString(),
            })
            .eq('relatorio_id', relatorio_id)
        }
      }
    } catch (_) {
      // Ignorar erros ao tentar registrar
    }

    return new Response(
      JSON.stringify({
        error: mensagemErro,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function extrairTexto(
  arrayBuffer: ArrayBuffer,
  nomeArquivo: string,
  tipo: string
): Promise<string> {
  try {
    // Detectar tipo by extension
    if (nomeArquivo.endsWith('.xlsx') || nomeArquivo.endsWith('.xls')) {
      return extrairXLSX(arrayBuffer)
    } else if (nomeArquivo.endsWith('.pdf')) {
      return extrairPDF(arrayBuffer)
    } else {
      // Tentar como XLSX por padrão
      try {
        return extrairXLSX(arrayBuffer)
      } catch {
        return extrairPDF(arrayBuffer)
      }
    }
  } catch (error) {
    throw new Error(`Erro ao extrair texto do ${tipo}: ${error.message}`)
  }
}

function extrairXLSX(arrayBuffer: ArrayBuffer): string {
  try {
    const uint8Array = new Uint8Array(arrayBuffer)
    const workbook = XLSX.read(uint8Array, { type: 'array' })

    let texto = ''
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      texto += `\n=== Sheet: ${sheetName} ===\n`
      texto += XLSX.utils.sheet_to_csv(sheet)
    })

    return texto
  } catch (error) {
    throw new Error(`Erro ao processar XLSX: ${error.message}`)
  }
}

function extrairPDF(arrayBuffer: ArrayBuffer): string {
  // Para PDF, retornar um placeholder
  // Em produção, usar uma biblioteca como pdfjs
  const texto = new TextDecoder().decode(new Uint8Array(arrayBuffer))

  // Tentar extrair apenas o texto legível
  const linhas = texto
    .split('\n')
    .filter((linha) => linha.trim().length > 0)
    .filter((linha) => !linha.startsWith('%') && !linha.startsWith('stream'))
    .join('\n')

  if (linhas.length < 50) {
    throw new Error(
      'Não foi possível extrair texto do PDF. Certifique-se de que é um PDF com texto (não imagem/scaneado)'
    )
  }

  return linhas.slice(0, 50000) // Limitar a 50k chars
}
