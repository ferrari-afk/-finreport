# FinReport - Guia Completo de Deployment e Teste

Instruções passo-a-passo para configurar e testar a plataforma FinReport completa.

## Etapa 1: Preparação Inicial

### 1.1 Criar conta Supabase

1. Vá para https://supabase.com e crie uma conta
2. Crie um novo projeto
3. Anotue:
   - **Project URL**: https://seu-projeto.supabase.co
   - **Project Ref**: seu-projeto (primeira parte da URL)
   - **Anon Key**: (Settings > API > Anon Key)
   - **Service Role Key**: (Settings > API > Service Role Key)

### 1.2 Clonar e configurar o repositório

```bash
cd /caminho/para/seu/projeto
git clone seu-repositorio finreport
cd finreport
npm install
```

### 1.3 Configurar variáveis de ambiente

Crie arquivo `.env.local` na raiz:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

## Etapa 2: Configurar Supabase (Banco de Dados)

### 2.1 Executar migrations

No painel do Supabase:

1. Vá para **SQL Editor**
2. Clique em **New Query**
3. Cole o conteúdo de `supabase/migrations/001_initial_schema.sql`
4. Clique em **Run**

Você deve ver "Success" com todas as tabelas criadas.

### 2.2 Criar Storage Bucket

1. Vá para **Storage**
2. Clique em **Create a new bucket**
3. Nome: `relatorios`
4. Acesso: Private
5. Clique em **Create bucket**

### 2.3 Configurar RLS para Storage

1. Clique no bucket `relatorios`
2. Vá para **Policies**
3. Clique em **New Policy → For SELECT**
   - Nome: `Users can read their own files`
   - Template: `Enable read access based on user id column`
   - Expression: `bucket_id = 'relatorios' AND ((storage.foldername(name))[1]) = auth.uid()::text`

4. Clique em **New Policy → For INSERT**
   - Nome: `Users can upload their own files`
   - Template: `Enable insert access based on user id column`
   - Expression: `bucket_id = 'relatorios'`

5. Clique em **New Policy → For DELETE**
   - Nome: `Users can delete their own files`
   - Template: `Enable delete access based on user id column`
   - Expression: `bucket_id = 'relatorios' AND ((storage.foldername(name))[1]) = auth.uid()::text`

## Etapa 3: Configurar Edge Function com IA

### 3.1 Obter chave Anthropic

1. Vá para https://console.anthropic.com
2. Crie uma conta
3. Vá para **API Keys**
4. Clique em **Create new key**
5. Copie a chave (ela aparece apenas uma vez!)

### 3.2 Adicionar secrets no Supabase

No painel do seu projeto Supabase:

1. Vá para **Settings → Secrets**
2. Clique em **Create a secret**
3. Adicione:

   ```
   ANTHROPIC_API_KEY = sua_chave_da_anthropic
   SUPABASE_URL = https://seu-projeto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY = sua-service-role-key
   ```

4. Aguarde ~1 minuto para que os secrets sejam propagados

### 3.3 Instalar CLI Supabase

```bash
npm install -g supabase
```

### 3.4 Deploy da edge function

```bash
cd finreport
supabase login  # Faça login com sua conta Supabase
supabase link --project-ref seu-project-ref
supabase functions deploy process-report
```

Você deve ver:
```
✓ Deployed function 'process-report'
Available at: https://seu-projeto.supabase.co/functions/v1/process-report
```

## Etapa 4: Testar Localmente

### 4.1 Rodar servidor de desenvolvimento

```bash
npm run dev
```

Acesse http://localhost:5173

### 4.2 Criar conta e fazer login

1. Clique em "Criar conta"
2. Email: seu-email@exemplo.com
3. Senha: qualquer senha com 6+ caracteres
4. Clique em "Criar Conta"
5. Você será redirecionado para login
6. Faça login com as credenciais

### 4.3 Cadastrar cliente

1. No dashboard, clique em "+ Novo Cliente"
2. Nome: "Empresa Teste"
3. CNPJ: "12.345.678/0001-90" (fictício)
4. Segmento: "Comércio varejista"
5. Clique em "Criar Cliente"

### 4.4 Upload de documentos

1. Clique em "+ Novo Relatório"
2. Trimestre: 1º Trimestre
3. Ano: 2026
4. **Importante**: Use PDFs ou XLSXs REAIS de demonstrações financeiras
   - Se não tiver, peça para a IA gerar exemplos em formato texto
   - Ou use planilhas Excel com dados reais

5. Arraste os arquivos ou clique para selecionar
6. Clique em "Processar"

### 4.5 Verificar processamento

Você deve ver:
1. "Enviando arquivos..."
2. "Enviando para análise com IA..."
3. "Análise concluída! ✓"

Então será redirecionado para a página da empresa com:
- Score de saúde calculado
- Indicadores em abas
- Resumo executivo
- Recomendações

## Etapa 5: Resolver Problemas Comuns

### Erro: "Variáveis de ambiente Supabase não configuradas"

✅ Solução:
```bash
# Verificar se .env.local existe
cat .env.local

# Deve ter:
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave
```

Se o arquivo existe mas o erro persiste, reinicie o servidor:
```bash
npm run dev
```

### Erro: "Relatório não encontrado" na edge function

✅ Solução:
1. Verificar que o relatório foi criado no banco
2. Verificar que os arquivos foram salvos no Storage
3. Confirmar que `arquivo_dre_url` e `arquivo_balancete_url` estão preenchidos

```sql
-- Query para verificar no SQL Editor do Supabase:
SELECT id, status, arquivo_dre_url, arquivo_balancete_url
FROM relatorios
ORDER BY created_at DESC
LIMIT 5;
```

### Erro: "Não foi possível extrair texto do PDF"

✅ Solução:
- PDF pode ser imagem (scaneado)
- Use um PDF com texto selecionável
- Ou use XLSX em vez de PDF
- Para testar, use exemplos dos seus clientes reais

### Erro: "Erro ao processar resultado da IA" / JSON inválido

✅ Solução:
1. Ver logs da edge function:
   ```bash
   supabase functions logs process-report
   ```

2. O problema pode ser:
   - API da Anthropic retornou erro (verificar chave)
   - Timeout (tentar novamente)
   - Formato de resposta diferente (reportar)

3. Se der timeout, aumentar max_tokens ou simplificar documentos

### Storage retorna 403 Forbidden

✅ Solução:
1. Verificar que RLS policies foram criadas corretamente
2. Confirmar que bucket é "relatorios" (sem acento)
3. Reconstruir policies se necessário

## Etapa 6: Deploy em Produção

### 6.1 Preparar repositório

```bash
# Verificar que tudo está commitado
git status

# Criar branch de produção
git checkout -b production
git push origin production
```

### 6.2 Opção A: Deploy no Vercel

```bash
npm install -g vercel

# Fazer login e conectar projeto
vercel login
vercel link

# Deploy
vercel deploy --prod
```

Configure as variáveis de ambiente no painel do Vercel:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### 6.2 Opção B: Deploy no Netlify

```bash
npm install -g netlify-cli

# Fazer login
netlify login

# Deploy
netlify deploy --prod
```

### 6.3 Atualizar URL no Supabase

Se você mudou a URL do frontend:

1. Supabase → Settings → API
2. Em "Allowed origins", adicione:
   - https://seu-dominio-produção.com

## Checklist Final de Testes

- [ ] Login e cadastro funcionam
- [ ] Cadastrar novo cliente
- [ ] Upload de DRE e Balancete funciona
- [ ] Edge function processa sem erro
- [ ] Indicadores aparecem na página do cliente
- [ ] Abas de indicadores funcionam
- [ ] Expandir/colapsar indicadores funciona
- [ ] Trocar período atualiza indicadores
- [ ] Score de saúde é calculado corretamente
- [ ] Resumo executivo aparece
- [ ] Recomendações aparecem

## Monitoramento em Produção

### Ver logs da edge function

```bash
supabase functions logs process-report
```

### Ver erros no Supabase

1. Painel → Database → ai_job_logs
2. Filtrar por status = 'erro'
3. Ver campo erro_mensagem

### Métricas

1. Painel → Functions → process-report
   - Invocations
   - Errors
   - Latency

## Troubleshooting Avançado

### Se nenhum indicador aparece

1. Verificar `indicadores` table:
   ```sql
   SELECT * FROM indicadores ORDER BY created_at DESC LIMIT 10;
   ```

2. Verificar `relatorios` table:
   ```sql
   SELECT id, status, score_saude, ai_resumo_executivo
   FROM relatorios
   ORDER BY created_at DESC
   LIMIT 1;
   ```

3. Verificar logs: `supabase functions logs process-report`

### Se a IA retorna erro

Pode ser:
1. **Chave Anthropic inválida**: Verificar em Settings → Secrets
2. **Quota excedida**: Ver em console.anthropic.com → Usage
3. **Documentos sem dados**: Assegurar que PDFs/XLSXs têm dados reais

### Se o Storage não funciona

```bash
# Testar acesso ao bucket
# No SQL Editor, criar policy de teste e verificar
SELECT * FROM storage.buckets WHERE name = 'relatorios';
```

## Próximos Passos

- [ ] Implementar webhook para processar automaticamente
- [ ] Adicionar notificações por email
- [ ] Criar dashboard com gráficos comparativos
- [ ] Exportar relatórios em PDF
- [ ] Integrar com sistemas contábeis (integração API)

---

**Sucesso! 🚀** Se encontrar algum problema, verifique os logs e a documentação acima.
