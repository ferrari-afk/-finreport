-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tabela: empresas
create table if not exists empresas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  cnpj text,
  segmento text not null check (segmento in ('Comércio varejista', 'Comércio atacadista', 'Indústria', 'Serviços', 'Construção civil', 'Agronegócio', 'Saúde e clínicas', 'Tecnologia / SaaS', 'Educação', 'Outro')),
  segmento_personalizado text,
  ativo boolean default true,
  created_at timestamp with time zone default now()
);

-- Tabela: relatorios
create table if not exists relatorios (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  periodo text not null,
  trimestre integer not null check (trimestre >= 1 and trimestre <= 4),
  ano integer not null,
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'concluido', 'erro')),
  arquivo_dre_url text,
  arquivo_balancete_url text,
  ai_resumo_executivo text,
  ai_insight_critico text,
  ai_recomendacoes text,
  score_saude integer check (score_saude >= 0 and score_saude <= 100),
  processado_em timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Tabela: indicadores
create table if not exists indicadores (
  id uuid primary key default uuid_generate_v4(),
  relatorio_id uuid not null references relatorios(id) on delete cascade,
  categoria text not null check (categoria in ('liquidez', 'rentabilidade', 'endividamento', 'atividade')),
  nome text not null,
  valor numeric not null,
  valor_formatado text not null,
  o_que_e text not null,
  descricao_simples text not null,
  benchmark_referencia text not null,
  contexto_segmento text,
  status text not null check (status in ('bom', 'atencao', 'critico')),
  created_at timestamp with time zone default now()
);

-- Tabela: historico_indicadores
create table if not exists historico_indicadores (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  indicador_nome text not null,
  categoria text not null,
  valor numeric not null,
  status text not null,
  periodo text not null,
  trimestre integer not null,
  ano integer not null,
  created_at timestamp with time zone default now()
);

-- Tabela: ai_job_logs
create table if not exists ai_job_logs (
  id uuid primary key default uuid_generate_v4(),
  relatorio_id uuid not null references relatorios(id) on delete cascade,
  tipo_job text not null,
  status text not null check (status in ('iniciado', 'sucesso', 'erro')),
  erro_mensagem text,
  tokens_usados integer,
  iniciado_em timestamp with time zone default now(),
  finalizado_em timestamp with time zone
);

-- Create indexes for better query performance
create index idx_empresas_user_id on empresas(user_id);
create index idx_relatorios_empresa_id on relatorios(empresa_id);
create index idx_relatorios_status on relatorios(status);
create index idx_indicadores_relatorio_id on indicadores(relatorio_id);
create index idx_historico_empresa_id on historico_indicadores(empresa_id);
create index idx_ai_logs_relatorio_id on ai_job_logs(relatorio_id);

-- Row Level Security (RLS) Policies
alter table empresas enable row level security;
alter table relatorios enable row level security;
alter table indicadores enable row level security;
alter table historico_indicadores enable row level security;
alter table ai_job_logs enable row level security;

-- Políticas para empresas: usuário só pode ver suas próprias empresas
create policy "Usuários podem ver suas próprias empresas"
  on empresas for select
  using (auth.uid() = user_id);

create policy "Usuários podem criar empresas"
  on empresas for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar suas próprias empresas"
  on empresas for update
  using (auth.uid() = user_id);

create policy "Usuários podem deletar suas próprias empresas"
  on empresas for delete
  using (auth.uid() = user_id);

-- Políticas para relatorios: usuário só pode ver relatorios de suas empresas
create policy "Usuários podem ver relatorios de suas empresas"
  on relatorios for select
  using (
    empresa_id in (
      select id from empresas where user_id = auth.uid()
    )
  );

create policy "Usuários podem criar relatorios em suas empresas"
  on relatorios for insert
  with check (
    empresa_id in (
      select id from empresas where user_id = auth.uid()
    )
  );

create policy "Usuários podem atualizar relatorios de suas empresas"
  on relatorios for update
  using (
    empresa_id in (
      select id from empresas where user_id = auth.uid()
    )
  );

create policy "Usuários podem deletar relatorios de suas empresas"
  on relatorios for delete
  using (
    empresa_id in (
      select id from empresas where user_id = auth.uid()
    )
  );

-- Políticas para indicadores: usuário só pode ver indicadores de relatorios de suas empresas
create policy "Usuários podem ver indicadores de seus relatorios"
  on indicadores for select
  using (
    relatorio_id in (
      select id from relatorios where empresa_id in (
        select id from empresas where user_id = auth.uid()
      )
    )
  );

create policy "Usuários podem criar indicadores em seus relatorios"
  on indicadores for insert
  with check (
    relatorio_id in (
      select id from relatorios where empresa_id in (
        select id from empresas where user_id = auth.uid()
      )
    )
  );

create policy "Usuários podem atualizar indicadores de seus relatorios"
  on indicadores for update
  using (
    relatorio_id in (
      select id from relatorios where empresa_id in (
        select id from empresas where user_id = auth.uid()
      )
    )
  );

create policy "Usuários podem deletar indicadores de seus relatorios"
  on indicadores for delete
  using (
    relatorio_id in (
      select id from relatorios where empresa_id in (
        select id from empresas where user_id = auth.uid()
      )
    )
  );

-- Políticas para historico_indicadores
create policy "Usuários podem ver historico de suas empresas"
  on historico_indicadores for select
  using (
    empresa_id in (
      select id from empresas where user_id = auth.uid()
    )
  );

create policy "Usuários podem criar historico em suas empresas"
  on historico_indicadores for insert
  with check (
    empresa_id in (
      select id from empresas where user_id = auth.uid()
    )
  );

-- Políticas para ai_job_logs
create policy "Usuários podem ver logs de seus relatorios"
  on ai_job_logs for select
  using (
    relatorio_id in (
      select id from relatorios where empresa_id in (
        select id from empresas where user_id = auth.uid()
      )
    )
  );

create policy "Usuários podem criar logs em seus relatorios"
  on ai_job_logs for insert
  with check (
    relatorio_id in (
      select id from relatorios where empresa_id in (
        select id from empresas where user_id = auth.uid()
      )
    )
  );
