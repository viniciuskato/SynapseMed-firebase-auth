import { Discipline, Theme, Compendium, CompendiumSection } from '../types';
import { supabase } from '../lib/supabaseClient';
import { MaterialsRepository } from './MaterialsRepository';

// ============================================================================
// Fase 3 — Supabase-backed MaterialsRepository
// ============================================================================
//
// Fase 4-5 wiring: `MaterialsRepository` foi convertida para assíncrona e
// esta classe passou a declarar `implements MaterialsRepository` e a ser o
// singleton `materialsRepository` consumido pelo app.
//
// Mapeamento de campos (frontend <-> banco):
//
// Discipline <-> disciplines
//   id <-> id | name <-> name | code <-> code | icon <-> icon
//   description <-> description | cycle <-> cycle | color <-> color
//   themesCount: não persistido (derivado, calculado sob demanda se necessário)
//
// Theme <-> themes
//   id <-> id | disciplineId <-> discipline_id | name <-> name
//   description <-> description | highYield <-> high_yield | order <-> sort_order
//
// Compendium <-> materials (+ material_sections + material_references)
//   id <-> materials.id | disciplineId <-> discipline_id | themeId <-> theme_id
//   title <-> title | subtitle <-> subtitle
//   estimatedReadTimeMinutes <-> estimated_read_time_minutes
//   lastUpdated <-> updated_at (ISO string) | author <-> author
//   mode <-> mode | studyLens <-> study_lens | tags <-> tags
//   sections <-> material_sections (uma linha por seção, ordenada por sort_order)
//     CompendiumSection.id <-> id | title <-> title
//     mechanismTag <-> mechanism_tag | content <-> content
//     keyTakeaways <-> key_takeaways | clinicalPearl <-> clinical_pearl
//     warningAlert <-> warning_alert
//   references <-> material_references.citation_text (ordenada por sort_order)
//
//   Campos do frontend SEM equivalente no schema atual (não persistidos —
//   lacuna conhecida, não um bug de mapeamento):
//     editorialStatus (domínio 'completo'/'em_atualizacao'/'em_revisao' não
//       bate com materials.status 'draft'/'published'/'archived')
//     dependencies, diagramSvgKey (por seção), isPremiumOnly
//   material_references.url também não é populado a partir do frontend
//   (Compendium.references é só string[] de texto de citação).
// ============================================================================

interface DisciplineRow {
  id: string;
  name: string;
  code: string;
  icon: string | null;
  description: string | null;
  cycle: string;
  color: string | null;
  sort_order: number;
}

interface ThemeRow {
  id: string;
  discipline_id: string;
  name: string;
  description: string | null;
  high_yield: boolean;
  sort_order: number;
}

interface MaterialRow {
  id: string;
  discipline_id: string;
  theme_id: string;
  title: string;
  subtitle: string | null;
  mode: string | null;
  study_lens: string | null;
  estimated_read_time_minutes: number | null;
  author: string | null;
  tags: string[];
  updated_at: string;
}

interface MaterialSectionRow {
  id: string;
  material_id: string;
  sort_order: number;
  title: string;
  mechanism_tag: string | null;
  content: string;
  key_takeaways: string[];
  clinical_pearl: string | null;
  warning_alert: string | null;
}

interface MaterialReferenceRow {
  id: string;
  material_id: string;
  citation_text: string;
  url: string | null;
  sort_order: number;
}

function rowToDiscipline(row: DisciplineRow): Discipline {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    icon: row.icon ?? '',
    description: row.description ?? '',
    cycle: row.cycle as Discipline['cycle'],
    color: row.color ?? '',
  };
}

function disciplineToRow(d: Discipline, sortOrder: number): DisciplineRow {
  return {
    id: d.id,
    name: d.name,
    code: d.code,
    icon: d.icon || null,
    description: d.description || null,
    cycle: d.cycle,
    color: d.color || null,
    sort_order: sortOrder,
  };
}

function rowToTheme(row: ThemeRow): Theme {
  return {
    id: row.id,
    disciplineId: row.discipline_id,
    name: row.name,
    description: row.description ?? '',
    highYield: row.high_yield,
    order: row.sort_order,
  };
}

function themeToRow(t: Theme): ThemeRow {
  return {
    id: t.id,
    discipline_id: t.disciplineId,
    name: t.name,
    description: t.description || null,
    high_yield: t.highYield,
    sort_order: t.order,
  };
}

function rowToSection(row: MaterialSectionRow): CompendiumSection {
  return {
    id: row.id,
    title: row.title,
    mechanismTag: row.mechanism_tag ?? undefined,
    content: row.content,
    keyTakeaways: row.key_takeaways ?? [],
    clinicalPearl: row.clinical_pearl ?? undefined,
    warningAlert: row.warning_alert ?? undefined,
  };
}

function buildCompendium(
  material: MaterialRow,
  sections: MaterialSectionRow[],
  references: MaterialReferenceRow[]
): Compendium {
  return {
    id: material.id,
    disciplineId: material.discipline_id,
    themeId: material.theme_id,
    title: material.title,
    subtitle: material.subtitle ?? '',
    estimatedReadTimeMinutes: material.estimated_read_time_minutes ?? 0,
    lastUpdated: material.updated_at,
    author: material.author ?? '',
    mode: (material.mode as Compendium['mode']) ?? undefined,
    studyLens: (material.study_lens as Compendium['studyLens']) ?? undefined,
    tags: material.tags ?? [],
    sections: sections
      .filter((s) => s.material_id === material.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(rowToSection),
    references: references
      .filter((r) => r.material_id === material.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => r.citation_text),
  };
}

export class SupabaseMaterialsRepository implements MaterialsRepository {
  async getDisciplines(): Promise<Discipline[]> {
    const { data, error } = await supabase.from('disciplines').select('*').order('sort_order');
    if (error) throw error;
    return (data ?? []).map(rowToDiscipline);
  }

  async saveDisciplines(disciplines: Discipline[]): Promise<void> {
    const rows = disciplines.map((d, i) => disciplineToRow(d, i));
    const { error } = await supabase.from('disciplines').upsert(rows);
    if (error) throw error;
  }

  async getThemes(): Promise<Theme[]> {
    const { data, error } = await supabase.from('themes').select('*').order('sort_order');
    if (error) throw error;
    return (data ?? []).map(rowToTheme);
  }

  async saveThemes(themes: Theme[]): Promise<void> {
    const rows = themes.map(themeToRow);
    const { error } = await supabase.from('themes').upsert(rows);
    if (error) throw error;
  }

  async getCompendiums(): Promise<Compendium[]> {
    const [{ data: materials, error: mErr }, { data: sections, error: sErr }, { data: refs, error: rErr }] =
      await Promise.all([
        supabase.from('materials').select('*'),
        supabase.from('material_sections').select('*').order('sort_order'),
        supabase.from('material_references').select('*').order('sort_order'),
      ]);
    if (mErr) throw mErr;
    if (sErr) throw sErr;
    if (rErr) throw rErr;
    return (materials ?? []).map((m) => buildCompendium(m, sections ?? [], refs ?? []));
  }

  async saveCompendiums(compendiums: Compendium[]): Promise<void> {
    for (const c of compendiums) {
      await this.saveCompendium(c);
    }
  }

  async saveCompendium(compendium: Compendium): Promise<void> {
    const materialRow = {
      id: compendium.id,
      discipline_id: compendium.disciplineId,
      theme_id: compendium.themeId,
      title: compendium.title,
      subtitle: compendium.subtitle || null,
      mode: compendium.mode ?? null,
      study_lens: compendium.studyLens ?? null,
      estimated_read_time_minutes: compendium.estimatedReadTimeMinutes ?? null,
      author: compendium.author || null,
      tags: compendium.tags ?? [],
    };
    const { error: upsertErr } = await supabase.from('materials').upsert(materialRow);
    if (upsertErr) throw upsertErr;

    // Substitui seções e referências por completo (o modelo de frontend não
    // rastreia diffs incrementais — mesma semântica do LocalStorageRepository,
    // que sobrescreve o compêndio inteiro a cada save).
    const { error: delSecErr } = await supabase
      .from('material_sections')
      .delete()
      .eq('material_id', compendium.id);
    if (delSecErr) throw delSecErr;

    const { error: delRefErr } = await supabase
      .from('material_references')
      .delete()
      .eq('material_id', compendium.id);
    if (delRefErr) throw delRefErr;

    if (compendium.sections.length > 0) {
      const sectionRows = compendium.sections.map((s, i) => ({
        id: s.id,
        material_id: compendium.id,
        sort_order: i,
        title: s.title,
        mechanism_tag: s.mechanismTag ?? null,
        content: s.content,
        key_takeaways: s.keyTakeaways ?? [],
        clinical_pearl: s.clinicalPearl ?? null,
        warning_alert: s.warningAlert ?? null,
      }));
      const { error } = await supabase.from('material_sections').insert(sectionRows);
      if (error) throw error;
    }

    if (compendium.references.length > 0) {
      const refRows = compendium.references.map((text, i) => ({
        material_id: compendium.id,
        citation_text: text,
        sort_order: i,
      }));
      const { error } = await supabase.from('material_references').insert(refRows);
      if (error) throw error;
    }
  }

  async deleteCompendium(id: string): Promise<void> {
    // material_sections/material_references têm ON DELETE CASCADE em material_id.
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
  }
}

export const supabaseMaterialsRepository = new SupabaseMaterialsRepository();
