import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { Empresa, Relatorio } from '../types/database'

interface EmpresaComRelatorio extends Empresa {
  ultimoRelatorio?: Relatorio
}

export function DashboardPage() {
  const [empresas, setEmpresas] = useState<EmpresaComRelatorio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    carregarEmpresas()
  }, [])

  async function carregarEmpresas() {
    try {
      setLoading(true)
      setError(null)

      // Buscar empresas do usuário logado
      const { data: empresasData, error: empresasError } = await supabase
        .from('empresas')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false })

      if (empresasError) throw empresasError

      // Para cada empresa, buscar o último relatório
      const empresasComRelatorios = await Promise.all(
        (empresasData || []).map(async (empresa) => {
          const { data: relatorioData } = await supabase
            .from('relatorios')
            .select('*')
            .eq('empresa_id', empresa.id)
            .eq('status', 'concluido')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          return {
            ...empresa,
            ultimoRelatorio: relatorioData || undefined,
          }
        })
      )

      setEmpresas(empresasComRelatorios)
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao carregar empresas'
      setError(mensagem)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getNomeBadgeSegmento = (segmento: string) => {
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

  const getCorScore = (score?: number) => {
    if (!score) return 'bg-gray-100'
    if (score >= 70) return 'bg-green-100'
    if (score >= 40) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getCorBarraScore = (score?: number) => {
    if (!score) return 'bg-gray-400'
    if (score >= 70) return 'bg-green-500'
    if (score >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Acompanhe a saúde financeira de seus clientes</p>
          </div>
          <Link
            to="/clientes/novo"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            + Novo Cliente
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando empresas...</p>
            </div>
          </div>
        ) : empresas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Nenhum cliente cadastrado ainda</p>
            <Link
              to="/clientes/novo"
              className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              Cadastrar primeiro cliente
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {empresas.map((empresa) => {
              const badgeSegmento = getNomeBadgeSegmento(empresa.segmento)
              const score = empresa.ultimoRelatorio?.score_saude
              const periodo = empresa.ultimoRelatorio?.periodo
              const status = empresa.ultimoRelatorio?.status

              return (
                <Link
                  key={empresa.id}
                  to={`/clientes/${empresa.id}`}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-200 p-6 transition block"
                >
                  {/* Nome e Segmento */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{empresa.nome}</h3>
                      {empresa.cnpj && <p className="text-sm text-gray-500 mt-1">{empresa.cnpj}</p>}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${badgeSegmento.bg} ${badgeSegmento.text}`}>
                      {badgeSegmento.nome}
                    </span>
                  </div>

                  {/* Score de Saúde */}
                  {score !== undefined ? (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Saúde Financeira</span>
                        <span className="text-lg font-bold text-gray-900">{score}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition ${getCorBarraScore(score)}`}
                          style={{ width: `${Math.min(score, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                      <p className="text-sm text-gray-600">Nenhum relatório processado</p>
                    </div>
                  )}

                  {/* Período e Status */}
                  {periodo && status && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <span className="text-sm text-gray-600">{periodo}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        status === 'concluido'
                          ? 'bg-green-100 text-green-700'
                          : status === 'processando'
                          ? 'bg-blue-100 text-blue-700'
                          : status === 'erro'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {status === 'concluido' && 'Concluído'}
                        {status === 'processando' && 'Processando'}
                        {status === 'erro' && 'Erro'}
                        {status === 'pendente' && 'Pendente'}
                      </span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
