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
