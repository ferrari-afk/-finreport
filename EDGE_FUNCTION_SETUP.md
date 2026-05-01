# Edge Function: process-report

Esta edge function processa documentos financeiros (DRE e Balancete) com a API Claude para extrair indicadores e análises automáticas.

## Pré-requisitos

- Conta Supabase com projeto criado
- CLI do Supabase instalada: `npm install -g supabase`
- Chave da API Anthropic (https://console.anthropic.com)

## Configuração

### 1. Adicionar variáveis de ambiente no Supabase

Acesse o painel do seu projeto Supabase:

1. Vá para **Settings → Functions**
2. Clique em **Add a secret**
3. Adicione as três variáveis:

```
ANTHROPIC_API_KEY = sua_chave_da_anthropic
SUPABASE_URL = https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY = sua_chave_service_role
```

### 2. Fazer login no Supabase via CLI

```bash
supabase login
```

### 3. Linkar o projeto local

```bash
cd finreport
supabase link --project-ref seu-project-ref
```

(O project-ref é a primeira parte da URL: `https://SEU-PROJECT-REF.supabase.co`)

### 4. Deploy da edge function

```bash
supabase functions deploy process-report
```

Você deve ver algo como:
```
✓ Deployed function 'process-report'
  Available at:
  https://seu-projeto.supabase.co/functions/v1/process-report
```

## Como funciona

### Fluxo completo:

1. **Upload de documentos** (`/clientes/:id/upload`)
   - Usuário faz upload de DRE + Balancete
   - Arquivos salvos no Supabase Storage
   - Relatório criado com status "pendente"

2. **Chamada da edge function** (pode ser via Supabase Realtime ou webhook)
   ```bash
   curl -X POST https://seu-projeto.supabase.co/functions/v1/process-report \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"relatorio_id": "uuid-aqui"}'
   ```

3. **Processamento na edge function**
   - Busca relatório e dados da empresa
   - Baixa arquivos do Storage
   - Extrai texto (PDF ou XLSX)
   - Chama Claude com system prompt especificado
   - Processa JSON da resposta
   - Salva indicadores e histórico no banco
   - Atualiza relatório com status "concluido"

4. **Resultado no dashboard**
   - Indicadores aparecem em abas na página `/clientes/:id`
   - Score de saúde atualizado
   - Resumo executivo e recomendações visíveis

## Tipos de arquivo suportados

- **DRE**: PDF ou XLSX
- **Balancete**: PDF ou XLSX
- Tamanho máximo: 10 MB cada

**Importante**: Se for PDF, deve ser um PDF com texto (não scaneado/imagem).

## Tratamento de erros

Se algo der errado, a edge function:
1. Atualiza `relatorios.status` para "erro"
2. Registra a mensagem de erro em `ai_job_logs.erro_mensagem`
3. Retorna HTTP 500 com detalhes

Para debugar:
```bash
supabase functions logs process-report
```

## Indicadores calculados

A função calcula automaticamente (conforme dados disponíveis):

**LIQUIDEZ**
- Liquidez Corrente
- Liquidez Seca
- Liquidez Imediata
- Liquidez Geral

**RENTABILIDADE**
- Margem Bruta
- Margem EBITDA
- Margem Líquida
- ROA (Return on Assets)
- ROE (Return on Equity)

**ENDIVIDAMENTO**
- Endividamento Geral
- Composição do Endividamento
- Imobilização do PL

**ATIVIDADE**
- Giro de Ativos
- PMR (Prazo Médio de Recebimento)
- PMP (Prazo Médio de Pagamento)
- PME (Prazo Médio de Estoque)
- NCG (Necessidade de Capital de Giro)
- Capital de Giro

## System prompt customizado

O system prompt foi calibrado para:
- Considerar o segmento da empresa ao avaliar indicadores
- Não usar benchmarks fixos (variam por setor)
- Penalizar mais problemas de liquidez/endividamento
- Gerar análises em linguagem simples

Exemplos de variação por segmento:
- Margem bruta 20%: ótima para atacado, ruim para SaaS
- Liquidez corrente 1,1: aceitável para serviços, baixa para indústria
- PMR 60 dias: normal para B2B, alto para varejo

## Testando localmente

### Com curl:

```bash
# Substituir pelos valores reais
SUPABASE_URL="https://seu-projeto.supabase.co"
ANON_KEY="sua-chave-anonima"
RELATORIO_ID="uuid-do-relatorio"

curl -X POST "$SUPABASE_URL/functions/v1/process-report" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"relatorio_id\": \"$RELATORIO_ID\"}"
```

### Com JavaScript:

```javascript
const response = await fetch(
  'https://seu-projeto.supabase.co/functions/v1/process-report',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sua-chave-anonima',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ relatorio_id: 'uuid-aqui' }),
  }
)

const result = await response.json()
console.log(result)
```

## Atualizando a função

Após fazer mudanças no código:

```bash
supabase functions deploy process-report
```

## Troubleshooting

### "Variáveis de ambiente não configuradas"
- Verificar se ANTHROPIC_API_KEY, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY foram adicionadas
- Aguardar ~1 minuto após adicionar as secrets

### "Relatório não encontrado"
- Certificar que o relatorio_id existe no banco
- Verificar que o relatório pertence ao usuário autenticado

### "Erro ao fazer download dos arquivos"
- Verificar que os arquivos foram salvos corretamente no Storage
- Confirmar que arquivo_dre_url e arquivo_balancete_url estão preenchidos

### "Erro ao processar resultado da IA"
- Claude pode ter retornado JSON inválido
- Verificar logs: `supabase functions logs process-report`
- Tentar novamente - às vezes é apenas timeout temporal

### "Não foi possível extrair texto do PDF"
- O PDF pode ser uma imagem (scaneado)
- Converter PDF para versão com OCR
- Ou usar o XLSX do documento financeiro

## Próximos passos

1. **Automatizar a chamada da função**
   - Usar Supabase Realtime para detectar novo relatório
   - Ou chamar via webhook quando upload completa
   - Ou usar cron job do Supabase

2. **Adicionar mais indicadores**
   - Expandir a lista de indicadores calculados
   - Adicionar análises comparativas (trimestre anterior)

3. **Integrar com frontend**
   - Mostrar progresso em tempo real
   - Adicionar retry automático em caso de erro
   - Notificar usuário quando análise estiver pronta

---

Qualquer dúvida ou erro, me mostre a mensagem completa!
