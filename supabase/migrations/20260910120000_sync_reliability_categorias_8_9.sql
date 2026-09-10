-- ----------------------------------------------------------------------------
-- Sincronização confiável — categorias 8 (reações) e 9 (feedback +
-- status editorial). Prompt 07-F.
--
-- Ao contrário das categorias 1-7, o inventário desta rodada concluiu que
-- NENHUM contrato novo de "toggle -> set" era necessário aqui:
--
--   * question_reactions já era um "set" idempotente desde a criação
--     (20260907130000_feedback_contextual.sql): `setReaction` sempre fazia
--     upsert por `unique (user_id, question_id)` — um índice ÚNICO COMUM
--     (não parcial), então `.upsert(..., { onConflict: 'user_id,question_id' })`
--     já funciona (ver AGENTS.md, armadilha #14, sobre índices parciais x
--     onConflict do PostgREST). Reenviar o MESMO valor converge sempre para
--     o mesmo estado; remover uma reação já removida é um DELETE que afeta 0
--     linhas, nunca um erro. O único problema real era a AUSÊNCIA de retry
--     (ResilientQuestionReactionsRepository engolia erro em `catch {}`) —
--     corrigido só no cliente (syncQueue), sem mudança de schema. Por isso
--     esta migration não toca em `question_reactions`.
--
--   * feedback (envio) já usa um `id` gerado no cliente (crypto.randomUUID())
--     ANTES de qualquer tentativa de rede, reaproveitado em qualquer retry da
--     MESMA submissão (o objeto `UserFeedback` monta o `id` uma vez e ele
--     atravessa localStorage + fila sem ser regenerado). Como `id` já é a
--     chave primária da tabela `feedback`, ele já cumpre o papel de
--     `client_op_id`: reenviar o mesmo INSERT falha com `23505` (unique
--     violation na PK), tratado no handler como sucesso idempotente — nunca
--     duplica linha. Duas submissões DELIBERADAMENTE distintas (inclusive
--     com texto igual) sempre têm `id`s diferentes (nova chamada de
--     `crypto.randomUUID()`), então nunca são fundidas por engano. Por isso
--     esta migration também NÃO adiciona uma coluna `client_op_id` nova —
--     seria redundante com `id`, que já é gerado no cliente e nunca
--     regenerado entre tentativas.
--
-- O que esta migration de fato precisa resolver:
--
--   1. `feedback` não tinha `updated_at` — mudança de status editorial
--      (pendente -> em_analise -> resolvido) não registrava quando
--      aconteceu. Adicionado, com trigger que só atualiza em UPDATE real
--      (nunca no INSERT inicial, que já tem `created_at`).
--   2. A única proteção server-side para "só editor pode mudar status" era
--      RLS (`feedback_admin_update_status`) + privilégio de coluna
--      (`grant update (status)`). Isso já bloqueia um estudante de verdade
--      (RLS nega a linha), mas de forma SILENCIOSA — um UPDATE que a RLS
--      barra afeta 0 linhas sem lançar erro nenhum ao cliente, então o
--      código do admin (`AdminCMSView.handleAdvanceFeedbackStatus`) não
--      teria como distinguir "atualizado" de "silenciosamente ignorado" se
--      um dia fosse chamado por engano por alguém sem privilégio. Trocado
--      por uma RPC (`set_feedback_status`, mesmo padrão de
--      `publish_question`: `security definer` + checagem explícita de
--      `app.is_admin_active`, exceção clara em vez de no-op silencioso) —
--      RLS continua ativa como camada 2 (defesa em profundidade), a RPC é o
--      caminho novo usado pelo cliente.
-- ----------------------------------------------------------------------------

alter table public.feedback
  add column updated_at timestamptz not null default now();

create or replace function public.set_feedback_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.set_feedback_updated_at();

-- set_feedback_status: única via para alterar o status de triagem de um
-- feedback. Idempotente (marcar o mesmo status de novo não é erro nem
-- gera efeito colateral — só não reescreve `updated_at` à toa quando o
-- status já é o pedido) e preserva o restante da linha (nunca toca em
-- title/description/question_id/material_id/user_id).
create or replace function public.set_feedback_status(p_feedback_id uuid, p_status text)
returns public.feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.feedback;
begin
  if not app.is_admin_active(auth.uid()) then
    raise exception 'apenas administradores ativos podem alterar o status de um feedback';
  end if;

  if p_status not in ('pendente', 'em_analise', 'resolvido') then
    raise exception 'status inválido: %', p_status;
  end if;

  select * into v_result from public.feedback where id = p_feedback_id;
  if not found then
    raise exception 'feedback não encontrado: %', p_feedback_id;
  end if;

  if v_result.status = p_status then
    -- Idempotente: já está no status pedido, devolve a linha sem tocar em
    -- updated_at (reenviar a mesma ação não deve parecer uma mudança nova).
    return v_result;
  end if;

  update public.feedback
    set status = p_status
    where id = p_feedback_id
    returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.set_feedback_status(uuid, text) from public;
grant execute on function public.set_feedback_status(uuid, text) to authenticated;
