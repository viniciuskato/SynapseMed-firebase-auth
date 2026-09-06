import { supabase } from '../lib/supabaseClient';

// ============================================================================
// Fase 4 — Supabase-backed NotesRepository
// ============================================================================
//
// Mesma observação de `SupabaseMaterialsRepository.ts`: não declara
// `implements NotesRepository` porque essa interface é síncrona
// (localStorage) e uma implementação Supabase real é assíncrona por
// natureza. Os métodos espelham os nomes/parâmetros da interface original,
// retornando Promise<T> em vez de T. Não é usada pelo singleton
// `notesRepository` consumido pelo app.
//
// Mapeamento de campos (frontend <-> banco):
//
// Record<targetId, noteText> <-> notes
//   note_text <-> noteText
//   O frontend trata `targetId` como uma chave genérica opaca (uma nota pode
//   ser sobre um compêndio, uma seção, uma questão ou um flashcard), mas o
//   schema usa 4 colunas nullable mutuamente exclusivas
//   (num_nonnulls(material_id, material_section_id, question_id,
//   flashcard_id) = 1) em vez de um alvo polimórfico solto. Não há
//   discriminador de tipo no parâmetro `targetId` da interface original —
//   LACUNA DE SCHEMA CONHECIDA. Para preservar a assinatura exata da
//   interface (targetId: string, sem um segundo parâmetro de tipo),
//   `saveNote`/`getNotes` resolvem a qual coluna um targetId pertence
//   verificando, em ordem, se ele existe como id em materials,
//   material_sections, questions ou flashcards. Isso é seguro na prática
//   porque os 4 domínios usam uuids gerados independentemente (colisão
//   cross-tabela é praticamente impossível), mas é uma consulta extra por
//   `saveNote` que não existe no LocalStorageNotesRepository.
//   `getNotes` não precisa resolver nada: lê as 4 colunas de volta e usa a
//   que estiver preenchida como chave do Record.
// ============================================================================

type NoteTargetColumn = 'material_id' | 'material_section_id' | 'question_id' | 'flashcard_id';

const NOTE_TARGET_TABLES: Array<{ table: string; column: NoteTargetColumn }> = [
  { table: 'materials', column: 'material_id' },
  { table: 'material_sections', column: 'material_section_id' },
  { table: 'questions', column: 'question_id' },
  { table: 'flashcards', column: 'flashcard_id' },
];

interface NoteRow {
  material_id: string | null;
  material_section_id: string | null;
  question_id: string | null;
  flashcard_id: string | null;
  note_text: string;
}

async function resolveNoteColumn(targetId: string): Promise<NoteTargetColumn> {
  for (const { table, column } of NOTE_TARGET_TABLES) {
    const { data, error } = await supabase.from(table).select('id').eq('id', targetId).maybeSingle();
    if (error) throw error;
    if (data) return column;
  }
  throw new Error(
    `saveNote: não foi possível determinar o tipo de destino para targetId=${targetId} ` +
      '(não encontrado em materials/material_sections/questions/flashcards)'
  );
}

export class SupabaseNotesRepository {
  async getNotes(): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('notes')
      .select('material_id, material_section_id, question_id, flashcard_id, note_text');
    if (error) throw error;

    const result: Record<string, string> = {};
    for (const row of (data ?? []) as NoteRow[]) {
      const targetId = row.material_id ?? row.material_section_id ?? row.question_id ?? row.flashcard_id;
      if (targetId) result[targetId] = row.note_text;
    }
    return result;
  }

  async saveNote(targetId: string, noteText: string): Promise<void> {
    const column = await resolveNoteColumn(targetId);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;

    // Substitui a nota existente para este alvo (mesma semântica de
    // "última nota vale" do LocalStorageNotesRepository, que sobrescreve
    // notes[targetId] a cada chamada).
    const { error: delErr } = await supabase.from('notes').delete().eq(column, targetId);
    if (delErr) throw delErr;

    const { error } = await supabase.from('notes').insert({
      user_id: userData.user?.id,
      [column]: targetId,
      note_text: noteText,
    });
    if (error) throw error;
  }
}

export const supabaseNotesRepository = new SupabaseNotesRepository();
