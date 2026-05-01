import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import type { Empresa, Relatorio, Indicador } from '../types/database'

type CategoriaIndicador = 'liquidez' | 'rentabilidade' | 'endividamento' | 'atividade'

interface IndicadorComExpansao extends Indicador {
  expandido?: boolean
}

export function ClientPage() {
  const { id } = useParams<{ id: string }>()
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [relatorios, setRelatorios] = useState<Relatorio[]>([])
  const [relatorioAtual, setRelatorioAtual] = useState<Relatorio | null>(null)
  const [indicadores, setIndicadores] = useState<IndicadorComExpansao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [abaSelecionada, setAbaSelecionada] = useState<CategoriaIndicador>('liquidez')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (id) carregarDados()
  }, [id])

  async function carregarDados() {
    try {
      setLoading(true)
      setError(null)

      // Carregar empresa
      const { data: empresaData, error: empresaError } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', id)
        .single()

      if (empresaError) throw empresaError
      setEmpresa(empresaData)

      // Carregar todos os relatórios concluídos
      const { data: relatoriosData, error: relatoriosError } = await supabase
        .from('relatorios')
        .select('*')
        .eq('empresa_id', id)
        .eq('status', 'concluido')
        .order('created_at', { ascending: false })

      if (relatoriosError) throw relatoriosError
      setRelatorios(relatoriosData || [])

      // Usar o primeiro (mais recente)
      if (relatoriosData && relatoriosData.length > 0) {
        const relatorio = relatoriosData[0]
        setRelatorioAtual(relatorio)

        // Carregar indicadores do relatório
        const { data: indicadoresData, error: indicadoresError } = await supabase
          .from('indicadores')
          .select('*')
          .eq('relatorio_id', relatorio.id)

        if (indicadoresError) throw indicadoresError
        setIndicadores((indicadoresData || []).map((ind) => ({ ...ind, expandido: false })))
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao carregar dados'
      setError(mensagem)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpandir = (indicadorId: string) => {
    const novoExpandidos = new Set(expandidos)
    if (novoExpandidos.has(indicadorId)) {
      novoExpandidos.delete(indicadorId)
    } else {
      novoExpandidos.clear() // Apenas um expandido por vez
      novoExpandidos.add(indicadorId)
    }
    setExpandidos(novoExpandidos)
  }

  const handleMudarRelatorio = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const relatorioId = e.target.value
    const novoRelatorio = relatorios.find((r) => r.id === relatorioId)
    if (novoRelatorio) {
      setRelatorioAtual(novoRelatorio)
      setExpandidos(new Set())

      // Carregar indicadores do novo relatório
      const { data: indicadoresData, error: indicadoresError } = await supabase
        .from('indicadores')
        .select('*')
        .eq('relatorio_id', relatorioId)

      if (!indicadoresError) {
        setIndicadores((indicadoresData || []).map((ind) => ({ ...ind, expandido: false })))
      }
    }
  }

  const getBadgeSegmento = (segmento: string) => {
    const cores: Record<string, { bg: string; text: string }> = {
      'Comércio varejista': { bg: 'bg-blue-100', text: 'text-blue-700' },
      'Comércio atacadista': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
      'Indústria': { bg: 'bg-purple-100', text: 'text-purple-700' },
      'Serviços': { bg: 'bg-green-100', text: 'text-green-700' },
      'Construção civil': { bg: 'bg-orange-100', text: 'text-orange-700' },
      'Agronegócio': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      'Saúde e clínicas': { bg: 'bg-red-100', text: 'text-red-700' },
      'Tecnologia / SaaS': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
      'Educação': { bg: 'bg-pink-100', text: 'text-pink-700' },
      'Outro': { bg: 'bg-gray-100', text: 'text-gray-700' },
    }

    const cor = cores[segmento] || cores['Outro']
    return { ...cor, nome: segmento.split('/')[0].trim() }
  }

  const getCorStatus = (status: string) => {
    switch (status) {
      case 'bom':
        return { bg: '#EAF3DE', text: '#3B6D11', label: '✓ Saudável' }
      case 'atencao':
        return { bg: '#FAEEDA', text: '#633806', label: '⚠ Atenção' }
      case 'critico':
        return { bg: '#FCEBEB', text: '#A32D2D', label: '✗ Crítico' }
      default:
        return { bg: '#F8F9FA', text: '#6B7280', label: status }
    }
  }

  const contarPorStatus = () => {
    let bom = 0, atencao = 0, critico = 0

    indicadores.forEach((ind) => {
      if (ind.status === 'bom') bom++
      else if (ind.status === 'atencao') atencao++
      else if (ind.status === 'critico') critico++
    })

    return { bom, atencao, critico }
  }

  const indicadoresPorCategoria = (categoria: CategoriaIndicador) => {
    return indicadores.filter((ind) => ind.categoria === categoria)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </div>
    )
  }

  if (!empresa || !relatorioAtual) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Voltar ao dashboard
          </Link>
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">
              {error || 'Empresa não encontrada ou sem relatórios'}
            </p>
            <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
              Voltar ao dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const badgeSegmento = getBadgeSegmento(empresa.segmento)
  const { bom, atencao, critico } = contarPorStatus()
  const corScore = relatorioAtual.score_saude || 0
  const corScoreBg =
    corScore >= 70 ? 'bg-green-100' : corScore >= 40 ? 'bg-yellow-100' : 'bg-red-100'
  const corScoreText =
    corScore >= 70 ? 'text-green-700' : corScore >= 40 ? 'text-yellow-700' : 'text-red-700'

  const indicadoresAba = indicadoresPorCategoria(abaSelecionada)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Voltar */}
        <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium mb-6 inline-block">
          ← Voltar ao dashboard
        </Link>

        {/* CABEÇALHO */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{empresa.nome}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${badgeSegmento.bg} ${badgeSegmento.text}`}>
                  {badgeSegmento.nome}
                </span>
              </div>
              {empresa.cnpj && <p className="text-gray-600">CNPJ: {empresa.cnpj}</p>}
            </div>

            {/* Score Saúde Grande */}
            <div className={`text-center p-6 rounded-lg ${corScoreBg}`}>
              <p className="text-gray-600 text-sm font-medium mb-2">Saúde Financeira</p>
              <p className={`text-5xl font-bold ${corScoreText}`}>{corScore}</p>
            </div>
          </div>

          {/* Período Selector + Contadores */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div>
              <label htmlFor="periodo" className="block text-sm font-medium text-gray-700 mb-2">
                Período:
              </label>
              <select
                id="periodo"
                value={relatorioAtual.id}
                onChange={handleMudarRelatorio}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {relatorios.map((rel) => (
                  <option key={rel.id} value={rel.id}>
                    {rel.periodo}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{bom}</p>
                <p className="text-gray-600">Saudáveis</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{atencao}</p>
                <p className="text-gray-600">Atenção</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{critico}</p>
                <p className="text-gray-600">Críticos</p>
              </div>
            </div>
          </div>
        </div>

        {/* ALERTA CRÍTICO */}
        {relatorioAtual.ai_insight_critico && critico > 0 && (
          <div className="border-l-4 border-red-500 bg-red-50 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-red-900 mb-2">⚠ Principal Alerta</h3>
            <p className="text-red-800">{relatorioAtual.ai_insight_critico}</p>
          </div>
        )}

        {/* RESUMO EXECUTIVO */}
        {relatorioAtual.ai_resumo_executivo && (
          <div className="bg-gray-100 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Resumo Executivo</h3>
            <p className="text-gray-700 leading-relaxed">{relatorioAtual.ai_resumo_executivo}</p>
          </div>
        )}

        {/* RECOMENDAÇÕES */}
        {relatorioAtual.ai_recomendacoes && (
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Recomendações da IA</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatorioAtual.ai_recomendacoes.split('\n').filter(Boolean).slice(0, 3).map((rec, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-700">{rec.trim()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABAS DE INDICADORES */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 flex">
            {(['liquidez', 'rentabilidade', 'endividamento', 'atividade'] as CategoriaIndicador[]).map(
              (categoria) => {
                const labels: Record<CategoriaIndicador, string> = {
                  liquidez: 'Liquidez',
                  rentabilidade: 'Rentabilidade',
                  endividamento: 'Endividamento',
                  atividade: 'Atividade',
                }
                const ativo = abaSelecionada === categoria

                return (
                  <button
                    key={categoria}
                    onClick={() => setAbaSelecionada(categoria)}
                    className={`flex-1 px-6 py-4 font-medium border-b-2 transition ${
                      ativo
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {labels[categoria]}
                  </button>
                )
              }
            )}
          </div>

          {/* Indicadores da aba */}
          <div className="p-6 space-y-4">
            {indicadoresAba.length === 0 ? (
              <p className="text-gray-600 text-center py-8">Nenhum indicador nesta categoria</p>
            ) : (
              indicadoresAba.map((indicador) => {
                const estaExpandido = expandidos.has(indicador.id)
                const corStatus = getCorStatus(indicador.status)

                return (
                  <div
                    key={indicador.id}
                    className="border border-gray-200 rounded-lg overflow-hidden transition"
                  >
                    {/* Colapsado */}
                    <button
                      onClick={() => toggleExpandir(indicador.id)}
                      className="w-full px-6 py-4 flex items-start justify-between hover:bg-gray-50 transition"
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: corStatus.text }}
                          ></div>
                          <h4 className="font-semibold text-gray-900">{indicador.nome}</h4>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 mb-2">
                          {indicador.valor_formatado}
                        </p>
                        <p className="text-gray-700">{indicador.descricao_simples}</p>
                      </div>
                      <div className="text-2xl text-gray-400 ml-4 flex-shrink-0">
                        {estaExpandido ? '↑' : '↓'}
                      </div>
                    </button>

                    {/* Expandido */}
                    {estaExpandido && (
                      <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 space-y-4">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">O que é</h5>
                          <p className="text-gray-700">{indicador.o_que_e}</p>
                        </div>

                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">
                            Referência para o seu segmento
                          </h5>
                          <p className="text-gray-700">{indicador.benchmark_referencia}</p>
                        </div>

                        {indicador.contexto_segmento && (
                          <div>
                            <h5 className="font-semibold text-gray-900 mb-2">Contexto do setor</h5>
                            <p className="text-gray-700">{indicador.contexto_segmento}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Upload Link */}
        <div className="mt-8 text-center">
          <Link
            to={`/clientes/${empresa.id}/upload`}
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            + Novo Relatório
          </Link>
        </div>
      </div>
    </div>
  )
}
