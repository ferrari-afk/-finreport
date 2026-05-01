import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import type { Empresa } from '../types/database'

interface ProcessoUpload {
  etapa: 'aguardando' | 'uploading' | 'processando' | 'concluido' | 'erro'
  mensagem: string
}

export function UploadPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [arquivoDre, setArquivoDre] = useState<File | null>(null)
  const [arquivoBalancete, setArquivoBalancete] = useState<File | null>(null)
  const [trimestre, setTrimestre] = useState('1')
  const [ano, setAno] = useState(new Date().getFullYear().toString())
  const [uploading, setUploading] = useState(false)
  const [processo, setProcesso] = useState<ProcessoUpload>({
    etapa: 'aguardando',
    mensagem: '',
  })

  const dragActiveRef = useRef(false)

  useEffect(() => {
    carregarEmpresa()
  }, [id])

  async function carregarEmpresa() {
    try {
      const { data, error: dbError } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', id)
        .single()

      if (dbError) throw dbError
      setEmpresa(data)
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao carregar empresa'
      setError(mensagem)
    } finally {
      setLoading(false)
    }
  }

  const validarArquivo = (file: File) => {
    const tipos = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!tipos.includes(file.type)) {
      throw new Error('Apenas PDF e XLSX são aceitos')
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Arquivo não pode exceder 10MB')
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragActiveRef.current = true
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragActiveRef.current = false
  }

  const handleDrop = (e: React.DragEvent, tipo: 'dre' | 'balancete') => {
    e.preventDefault()
    dragActiveRef.current = false

    const file = e.dataTransfer.files[0]
    if (file) {
      try {
        validarArquivo(file)
        if (tipo === 'dre') {
          setArquivoDre(file)
        } else {
          setArquivoBalancete(file)
        }
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao processar arquivo')
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, tipo: 'dre' | 'balancete') => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        validarArquivo(file)
        if (tipo === 'dre') {
          setArquivoDre(file)
        } else {
          setArquivoBalancete(file)
        }
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao processar arquivo')
      }
    }
  }

  const handleUpload = async () => {
    if (!arquivoDre || !arquivoBalancete) {
      setError('Envie os dois arquivos (DRE e Balancete)')
      return
    }

    if (!id) return

    setError(null)
    setUploading(true)
    setProcesso({ etapa: 'uploading', mensagem: 'Enviando arquivos...' })

    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('Usuário não autenticado')

      const pasta = `${user.id}/${id}/${Date.now()}`

      // Upload DRE
      setProcesso({ etapa: 'uploading', mensagem: 'Enviando DRE...' })
      const { data: dataDre, error: erroDre } = await supabase.storage
        .from('relatorios')
        .upload(`${pasta}/dre`, arquivoDre)

      if (erroDre) throw erroDre

      // Upload Balancete
      setProcesso({ etapa: 'uploading', mensagem: 'Enviando Balancete...' })
      const { data: dataBalancete, error: erroBalancete } = await supabase.storage
        .from('relatorios')
        .upload(`${pasta}/balancete`, arquivoBalancete)

      if (erroBalancete) throw erroBalancete

      // Criar registro em relatorios
      setProcesso({ etapa: 'processando', mensagem: 'Criando registro do relatório...' })
      const periodo = `${trimestre}T${ano}`
      const { data: relatorioData, error: erroRelatorio } = await supabase
        .from('relatorios')
        .insert([
          {
            empresa_id: id,
            periodo,
            trimestre: parseInt(trimestre),
            ano: parseInt(ano),
            status: 'pendente',
            arquivo_dre_url: dataDre?.path,
            arquivo_balancete_url: dataBalancete?.path,
          },
        ])
        .select()
        .single()

      if (erroRelatorio) throw erroRelatorio

      // Chamar edge function para processar com IA
      setProcesso({ etapa: 'processando', mensagem: 'Enviando para análise com IA...' })

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/process-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ relatorio_id: relatorioData.id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao processar análise')
      }

      const resultado = await response.json()
      console.log('Análise concluída:', resultado)

      setProcesso({
        etapa: 'concluido',
        mensagem: 'Análise concluída! Redirecionando...',
      })

      setTimeout(() => {
        navigate(`/clientes/${id}`)
      }, 2000)
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao fazer upload'
      setProcesso({ etapa: 'erro', mensagem })
      setError(mensagem)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!empresa) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Voltar
          </Link>
          <div className="mt-8 text-center">
            <p className="text-gray-600">{error || 'Empresa não encontrada'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <Link to={`/clientes/${id}`} className="text-blue-600 hover:text-blue-700 font-medium">
          ← Voltar a {empresa.nome}
        </Link>

        <div className="mt-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Novo Relatório</h1>
          <p className="text-gray-600 mt-2">Envie a DRE e Balancete do trimestre</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {processo.etapa === 'aguardando' && (
            <div className="p-8">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {/* Período */}
              <div className="mb-8 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="trimestre" className="block text-sm font-medium text-gray-700 mb-2">
                    Trimestre
                  </label>
                  <select
                    id="trimestre"
                    value={trimestre}
                    onChange={(e) => setTrimestre(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1">1º Trimestre</option>
                    <option value="2">2º Trimestre</option>
                    <option value="3">3º Trimestre</option>
                    <option value="4">4º Trimestre</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ano" className="block text-sm font-medium text-gray-700 mb-2">
                    Ano
                  </label>
                  <input
                    id="ano"
                    type="number"
                    value={ano}
                    onChange={(e) => setAno(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Upload DRE */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Demonstração de Resultado (DRE)
                </label>
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'dre')}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                    dragActiveRef.current
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                  }`}
                >
                  {arquivoDre ? (
                    <div className="text-center">
                      <p className="text-green-700 font-medium mb-2">✓ {arquivoDre.name}</p>
                      <p className="text-sm text-gray-600">{(arquivoDre.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-700 font-medium mb-2">Arraste ou selecione o arquivo</p>
                      <p className="text-sm text-gray-600 mb-3">PDF ou XLSX, máx 10MB</p>
                      <input
                        type="file"
                        accept=".pdf,.xlsx"
                        onChange={(e) => handleInputChange(e, 'dre')}
                        className="hidden"
                        id="input-dre"
                      />
                      <label htmlFor="input-dre" className="cursor-pointer text-blue-600 hover:text-blue-700">
                        Clique para selecionar
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Balancete */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Balancete ou Balanço Patrimonial
                </label>
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'balancete')}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                    dragActiveRef.current
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                  }`}
                >
                  {arquivoBalancete ? (
                    <div className="text-center">
                      <p className="text-green-700 font-medium mb-2">✓ {arquivoBalancete.name}</p>
                      <p className="text-sm text-gray-600">{(arquivoBalancete.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-700 font-medium mb-2">Arraste ou selecione o arquivo</p>
                      <p className="text-sm text-gray-600 mb-3">PDF ou XLSX, máx 10MB</p>
                      <input
                        type="file"
                        accept=".pdf,.xlsx"
                        onChange={(e) => handleInputChange(e, 'balancete')}
                        className="hidden"
                        id="input-balancete"
                      />
                      <label htmlFor="input-balancete" className="cursor-pointer text-blue-600 hover:text-blue-700">
                        Clique para selecionar
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleUpload}
                  disabled={!arquivoDre || !arquivoBalancete || uploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                >
                  Processar
                </button>
                <Link
                  to={`/clientes/${id}`}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 rounded-lg transition text-center"
                >
                  Cancelar
                </Link>
              </div>
            </div>
          )}

          {/* Estados de progresso */}
          {(processo.etapa === 'uploading' || processo.etapa === 'processando') && (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-6"></div>
              <p className="text-lg font-semibold text-gray-900 mb-2">{processo.mensagem}</p>
              <p className="text-gray-600">Isto pode levar alguns momentos...</p>
            </div>
          )}

          {processo.etapa === 'concluido' && (
            <div className="p-12 text-center">
              <div className="text-5xl mb-6">✓</div>
              <p className="text-lg font-semibold text-green-700 mb-2">{processo.mensagem}</p>
              <p className="text-gray-600">Redirecionando em breve...</p>
            </div>
          )}

          {processo.etapa === 'erro' && (
            <div className="p-12 text-center">
              <div className="text-5xl mb-6">✗</div>
              <p className="text-lg font-semibold text-red-700 mb-6">{processo.mensagem}</p>
              <button
                onClick={() => {
                  setProcesso({ etapa: 'aguardando', mensagem: '' })
                  setArquivoDre(null)
                  setArquivoBalancete(null)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
