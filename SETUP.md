# FinReport - Guia de Setup

Plataforma SaaS financeira para análise automática de demonstrações financeiras com IA.

## Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta Supabase (criar em https://supabase.com)

## Configuração Local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com suas credenciais Supabase:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

**Como obter essas credenciais:**
1. Acesse https://app.supabase.com
2. Abra seu projeto
3. Vá para Settings > API
4. Copie a URL do projeto e a chave anônima (anon key)

### 3. Criar banco de dados no Supabase

#### Opção A: Via SQL Editor (recomendado)

1. No Supabase, vá para SQL Editor
2. Clique em "New Query"
3. Cole o conteúdo de `supabase/migrations/001_initial_schema.sql`
4. Clique em "Run"

#### Opção B: Via Supabase CLI

```bash
npm install -g supabase
supabase link --project-ref seu-project-ref
supabase db push
```

### 4. Ativar autenticação por email/senha

1. No Supabase, vá para Authentication > Providers
2. Certifique-se de que "Email" está habilitado
3. (Opcional) Desabilite "Auto Confirm" se quiser confirmação de email

### 5. Executar o servidor de desenvolvimento

```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:5173`

## Estrutura do Projeto

```
finreport/
├── src/
│   ├── components/       # Componentes reutilizáveis
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Páginas da aplicação
│   ├── types/           # Tipos TypeScript
│   ├── utils/           # Utilitários (Supabase client, etc)
│   ├── App.tsx          # Componente raiz com roteamento
│   └── main.tsx         # Entry point
├── supabase/
│   └── migrations/      # Migrações SQL
├── .env.local           # Variáveis de ambiente (não commitada)
└── tailwind.config.js   # Configuração Tailwind CSS
```

## Tabelas do Banco de Dados

### empresas
Cadastro de clientes (empresas) do contador

Campos:
- `id`: UUID (primary key)
- `user_id`: UUID (referência ao usuário)
- `nome`: Nome da empresa
- `cnpj`: CNPJ
- `segmento`: Tipo de negócio (varejista, atacadista, indústria, etc)
- `segmento_personalizado`: Para segmento "Outro"
- `ativo`: Boolean
- `created_at`: Timestamp

### relatorios
Análises financeiras de cada cliente

Campos:
- `id`: UUID (primary key)
- `empresa_id`: UUID (FK)
- `periodo`: Ex: "1T2026"
- `trimestre`: 1-4
- `ano`: Ano fiscal
- `status`: pendente | processando | concluido | erro
- `arquivo_dre_url`: URL do PDF/XLSX da DRE
- `arquivo_balancete_url`: URL do PDF/XLSX do balancete
- `ai_resumo_executivo`: Resumo gerado pela IA
- `ai_insight_critico`: Principal alerta
- `ai_recomendacoes`: 3 ações sugeridas
- `score_saude`: Pontuação 0-100
- `processado_em`: Timestamp
- `created_at`: Timestamp

### indicadores
Métricas financeiras calculadas

Campos:
- `id`: UUID
- `relatorio_id`: UUID (FK)
- `categoria`: liquidez | rentabilidade | endividamento | atividade
- `nome`: Nome do indicador (ex: Índice de Liquidez Corrente)
- `valor`: Valor numérico
- `valor_formatado`: Formatado (ex: "3,67")
- `o_que_e`: Definição simples
- `descricao_simples`: Interpretação do resultado
- `benchmark_referencia`: Valor ideal para o segmento
- `contexto_segmento`: Observações específicas
- `status`: bom | atencao | critico
- `created_at`: Timestamp

### historico_indicadores
Série histórica de indicadores para gráficos

### ai_job_logs
Logs de processamento da IA

## Segurança

Todas as tabelas têm **Row Level Security (RLS)** habilitada:
- Cada usuário só pode ver seus próprios clientes e dados
- Operações de insert/update/delete são permitidas apenas pelo proprietário
- A service role key do Supabase é usada apenas no backend (Edge Functions)

## Próximos passos (Etapa 3)

- Criar dashboard com lista de clientes
- Implementar upload de documentos
- Integrar API Claude para análise automática
- Criar visualizações de indicadores (Recharts)
- Implementar sistema de storage para arquivos

## Troubleshooting

### Erro: "Variáveis de ambiente Supabase não configuradas"
- Verifique se `.env.local` existe e tem as variáveis corretas
- Reinicie o servidor de desenvolvimento (`npm run dev`)

### Erro de RLS ao fazer queries
- Certifique-se de que está autenticado (user_id deve estar no contexto)
- Verifique as políticas RLS na tabela (SQL Editor do Supabase)

### Erro de CORS
- Adicione sua URL local às "Allowed origins" em Supabase Settings > API

## Desenvolvimento

```bash
# Executar testes
npm run test

# Build para produção
npm run build

# Preview da build
npm run preview
```

## Deploy

Para deployar em produção:
1. Fazer commit e push para GitHub
2. (Opcional) Configurar CI/CD com GitHub Actions
3. Deploy em Vercel, Netlify ou outro provider
4. Configurar variáveis de ambiente na plataforma de deploy

---

**Precisa de ajuda?** Verifique a documentação do Supabase em https://supabase.com/docs
