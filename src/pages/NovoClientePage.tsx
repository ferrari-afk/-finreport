import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../utils/supabase'

const SEGMENTOS = [
  'Comércio varejista',
  'Comércio atacadista',
  'Indústria',
  'Serviços',
  'Construção civil',
  'Agronegócio',
  'Saúde e clínicas',
  'Tecnologia / SaaS',
  'Educação',
  'Outro',
]

export function NovoClientePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    segmento: 'Serviços',
    segmento_personalizado: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.nome.trim()) {
      setError('Nome da empresa é obrigatório')
      return
    }

    if (formData.segmento === 'Outro' && !formData.segmento_personalizado.trim()) {
      setError('Descreva o segmento quando selecionar "Outro"')
      return
    }

    if (!user) {
      setError('Usuário não identificado')
      return
    }

    setLoading(true)

    try {
      const { data, error: insertError } = await supabase
        .from('empresas')
        .insert([
          {
            user_id: user.id,
            nome: formData.nome.trim(),
            cnpj: formData.cnpj.trim() || null,
            segmento: formData.segmento,
            segmento_personalizado:
              formData.segmento === 'Outro' ? formData.segmento_personalizado.trim() : null,
            ativo: true,
          },
        ])
        .select()
        .single()

      if (insertError) throw insertError

      navigate(`/clientes/${data.id}`)
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao criar cliente'
      setError(mensagem)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Voltar ao dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Novo Cliente</h1>
          <p className="text-gray-600 mt-2">Cadastre uma nova empresa para análise financeira</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome */}
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Empresa *
              </label>
              <input
                id="nome"
                type="text"
                name="nome"
                required
                value={formData.nome}
                onChange={handleChange}
                placeholder="Ex: Empresa XYZ Ltda"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* CNPJ */}
            <div>
              <label htmlFor="cnpj" className="block text-sm font-medium text-gray-700 mb-2">
                CNPJ (opcional)
              </label>
              <input
                id="cnpj"
                type="text"
                name="cnpj"
                value={formData.cnpj}
                onChange={handleChange}
                placeholder="XX.XXX.XXX/XXXX-XX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Segmento */}
            <div>
              <label htmlFor="segmento" className="block text-sm font-medium text-gray-700 mb-2">
                Segmento da Empresa *
              </label>
              <select
                id="segmento"
                name="segmento"
                value={formData.segmento}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SEGMENTOS.map((seg) => (
                  <option key={seg} value={seg}>
                    {seg}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                O segmento é importante para calibrar os benchmarks e indicadores
              </p>
            </div>

            {/* Segmento Personalizado */}
            {formData.segmento === 'Outro' && (
              <div>
                <label htmlFor="segmento_personalizado" className="block text-sm font-medium text-gray-700 mb-2">
                  Descreva o Segmento *
                </label>
                <input
                  id="segmento_personalizado"
                  type="text"
                  name="segmento_personalizado"
                  value={formData.segmento_personalizado}
                  onChange={handleChange}
                  placeholder="Ex: Importação de produtos eletrônicos"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 pt-6">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar Cliente'}
              </button>
              <Link
                to="/dashboard"
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 rounded-lg transition text-center"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
