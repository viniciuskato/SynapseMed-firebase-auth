import { Question, QuestionOption } from '../types';
import { supabase } from '../lib/supabaseClient';

// ============================================================================
// Fase 3 — Supabase-backed QuestionsRepository
// ============================================================================
//
// Mesma observação de `SupabaseMaterialsRepository.ts`: não declara
// `implements QuestionsRepository` porque essa interface é síncrona
// (localStorage) e uma implementação Supabase real é assíncrona por natureza
// (I/O de rede). Os métodos espelham os nomes/parâmetros da interface
// original, retornando Promise<T> em vez de T. Não é usada pelo singleton
// `questionsRepository` consumido pelo app.
//
// Mapeamento de campos (frontend <-> banco):
//
// Question <-> questions (+ question_options + question_option_keys + question_answer_keys)
//   id <-> id | disciplineId <-> discipline_id | themeId <-> theme_id
//   compendiumRefId <-> material_id | compendiumSectionId <-> material_section_id
//   cycle <-> cycle | difficulty <-> difficulty | institution <-> institution
//   year <-> year | clinicalVignette <-> clinical_vignette
//   questionStem <-> question_stem | tags <-> tags
//   generalCommentary <-> question_answer_keys.general_commentary
//   highYieldSummary <-> question_answer_keys.high_yield_summary
//   options <-> question_options (join question_option_keys)
//     letter <-> letter | text <-> option_text
//     isCorrect <-> question_option_keys.is_correct
//     explanation <-> question_option_keys.explanation
//
//   Campos do frontend SEM equivalente no schema atual (não persistidos):
//     options[].mechanismReference, flashcardTemplate, isPremiumOnly
//
//   `saveCustomQuestion` não tem tabela/flag equivalente a "custom" para
//   questions no schema (isso existe só em `flashcards.is_custom`). Aqui é
//   implementado como um alias de `saveQuestion` — mesmo comportamento do
//   LocalStorageQuestionsRepository, que também delega para saveQuestion.
//
//   IDs de question_options são gerados pelo banco (gen_random_uuid()) e não
//   são expostos no tipo QuestionOption do frontend (que só tem `letter` como
//   chave natural dentro da questão). Por isso, saveQuestion sempre apaga e
//   reinsere as opções da questão (mesma semântica de "substituição total" do
//   LocalStorageQuestionsRepository).
// ============================================================================

interface QuestionRow {
  id: string;
  discipline_id: string;
  theme_id: string;
  material_id: string | null;
  material_section_id: string | null;
  cycle: string;
  difficulty: string;
  institution: string | null;
  year: number | null;
  clinical_vignette: string;
  question_stem: string;
  tags: string[];
}

interface QuestionOptionRow {
  id: string;
  question_id: string;
  letter: string;
  option_text: string;
  sort_order: number;
}

interface QuestionOptionKeyRow {
  option_id: string;
  question_id: string;
  is_correct: boolean;
  explanation: string;
}

interface QuestionAnswerKeyRow {
  question_id: string;
  general_commentary: string;
  high_yield_summary: string;
}

function buildQuestion(
  q: QuestionRow,
  options: QuestionOptionRow[],
  optionKeys: QuestionOptionKeyRow[],
  answerKeys: QuestionAnswerKeyRow[]
): Question {
  const answerKey = answerKeys.find((a) => a.question_id === q.id);
  const opts: QuestionOption[] = options
    .filter((o) => o.question_id === q.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((o) => {
      const key = optionKeys.find((k) => k.option_id === o.id);
      return {
        letter: o.letter as QuestionOption['letter'],
        text: o.option_text,
        isCorrect: key?.is_correct ?? false,
        explanation: key?.explanation ?? '',
      };
    });

  return {
    id: q.id,
    disciplineId: q.discipline_id,
    themeId: q.theme_id,
    compendiumRefId: q.material_id ?? '',
    compendiumSectionId: q.material_section_id ?? undefined,
    cycle: q.cycle as Question['cycle'],
    difficulty: q.difficulty as Question['difficulty'],
    institution: q.institution ?? '',
    year: q.year ?? 0,
    clinicalVignette: q.clinical_vignette,
    questionStem: q.question_stem,
    options: opts,
    generalCommentary: answerKey?.general_commentary ?? '',
    highYieldSummary: answerKey?.high_yield_summary ?? '',
    tags: q.tags ?? [],
  };
}

export class SupabaseQuestionsRepository {
  async getQuestions(): Promise<Question[]> {
    const [
      { data: questions, error: qErr },
      { data: options, error: oErr },
      { data: optionKeys, error: okErr },
      { data: answerKeys, error: akErr },
    ] = await Promise.all([
      supabase.from('questions').select('*'),
      supabase.from('question_options').select('*').order('sort_order'),
      supabase.from('question_option_keys').select('*'),
      supabase.from('question_answer_keys').select('*'),
    ]);
    if (qErr) throw qErr;
    if (oErr) throw oErr;
    if (okErr) throw okErr;
    if (akErr) throw akErr;

    return (questions ?? []).map((q) => buildQuestion(q, options ?? [], optionKeys ?? [], answerKeys ?? []));
  }

  async saveQuestions(questions: Question[]): Promise<void> {
    for (const q of questions) {
      await this.saveQuestion(q);
    }
  }

  async saveQuestion(question: Question): Promise<void> {
    const questionRow = {
      id: question.id,
      discipline_id: question.disciplineId,
      theme_id: question.themeId,
      material_id: question.compendiumRefId || null,
      material_section_id: question.compendiumSectionId || null,
      cycle: question.cycle,
      difficulty: question.difficulty,
      institution: question.institution || null,
      year: question.year || null,
      clinical_vignette: question.clinicalVignette,
      question_stem: question.questionStem,
      tags: question.tags ?? [],
    };
    const { error: qErr } = await supabase.from('questions').upsert(questionRow);
    if (qErr) throw qErr;

    const { error: akErr } = await supabase.from('question_answer_keys').upsert({
      question_id: question.id,
      general_commentary: question.generalCommentary || '',
      high_yield_summary: question.highYieldSummary || '',
    });
    if (akErr) throw akErr;

    // question_option_keys referencia question_options.id via FK com
    // ON DELETE CASCADE, então apagar as opções já limpa as chaves.
    const { error: delErr } = await supabase.from('question_options').delete().eq('question_id', question.id);
    if (delErr) throw delErr;

    if (question.options.length === 0) return;

    const optionRows = question.options.map((o, i) => ({
      question_id: question.id,
      letter: o.letter,
      option_text: o.text,
      sort_order: i,
    }));
    const { data: insertedOptions, error: insErr } = await supabase
      .from('question_options')
      .insert(optionRows)
      .select('*');
    if (insErr) throw insErr;

    const optionKeyRows = (insertedOptions ?? []).map((row: QuestionOptionRow) => {
      const original = question.options.find((o) => o.letter === row.letter);
      return {
        option_id: row.id,
        is_correct: original?.isCorrect ?? false,
        explanation: original?.explanation ?? '',
      };
    });
    if (optionKeyRows.length > 0) {
      const { error: okErr } = await supabase.from('question_option_keys').upsert(optionKeyRows);
      if (okErr) throw okErr;
    }
  }

  async deleteQuestion(id: string): Promise<void> {
    // question_options/question_answer_keys têm ON DELETE CASCADE em question_id.
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw error;
  }

  async saveCustomQuestion(question: Question): Promise<void> {
    // Sem equivalente de "custom" para questions no schema atual — mesmo
    // comportamento do LocalStorageQuestionsRepository (delega a saveQuestion).
    await this.saveQuestion(question);
  }
}

export const supabaseQuestionsRepository = new SupabaseQuestionsRepository();
