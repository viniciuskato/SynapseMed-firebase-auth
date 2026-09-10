import { QuestionReactionValue } from '../types';
import { supabase } from '../lib/supabaseClient';
import { QuestionReactionsRepository } from './QuestionReactionsRepository';

export class SupabaseQuestionReactionsRepository implements QuestionReactionsRepository {
  async getMyReaction(questionId: string): Promise<QuestionReactionValue | null> {
    const { data, error } = await supabase
      .from('question_reactions')
      .select('reaction')
      .eq('question_id', questionId)
      .maybeSingle();
    if (error) throw error;
    return (data?.reaction as QuestionReactionValue | undefined) ?? null;
  }

  // Busca TODAS as reações do usuário autenticado numa única consulta — a
  // policy `question_reactions_owner_all` (user_id = auth.uid()) já restringe
  // o resultado às próprias linhas, sem precisar filtrar por questionId aqui.
  // Usado por <QuestionsView> para hidratar todos os cartões de uma vez em
  // vez de um SELECT por questão (Prompt 10-A).
  async getMyReactions(): Promise<Record<string, QuestionReactionValue>> {
    const { data, error } = await supabase.from('question_reactions').select('question_id, reaction');
    if (error) throw error;
    const result: Record<string, QuestionReactionValue> = {};
    for (const row of data ?? []) {
      result[row.question_id as string] = row.reaction as QuestionReactionValue;
    }
    return result;
  }

  async setReaction(questionId: string, reaction: QuestionReactionValue): Promise<void> {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;

    const { error } = await supabase
      .from('question_reactions')
      .upsert(
        { user_id: userData.user?.id, question_id: questionId, reaction },
        { onConflict: 'user_id,question_id' }
      );
    if (error) throw error;
  }

  async removeReaction(questionId: string): Promise<void> {
    const { error } = await supabase.from('question_reactions').delete().eq('question_id', questionId);
    if (error) throw error;
  }
}

export const supabaseQuestionReactionsRepository = new SupabaseQuestionReactionsRepository();
