import { Flashcard, Question } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseFlashcardsRepository } from './SupabaseFlashcardsRepository';

import { isSupabaseConfigured } from '../lib/supabaseClient';

export interface FlashcardsRepository {
  getFlashcards(): Promise<Flashcard[]>;
  saveFlashcards(flashcards: Flashcard[]): Promise<void>;
  saveFlashcard(flashcard: Flashcard): Promise<Flashcard>;
  deleteFlashcard(id: string): Promise<void>;
  getDueFlashcards(): Promise<Flashcard[]>;
  updateFlashcardSRS(cardId: string, srs: any): Promise<void>;
  createFlashcardFromQuestion(question: Question): Promise<Flashcard>;
  reviewFlashcard(cardId: string, rating: 1 | 2 | 3 | 4): Promise<Flashcard | null>;
}

class LocalStorageFlashcardsRepository implements FlashcardsRepository {
  async getFlashcards(): Promise<Flashcard[]> {
    return StorageService.getFlashcards();
  }
  async saveFlashcards(flashcards: Flashcard[]): Promise<void> {
    StorageService.saveFlashcards(flashcards);
  }
  async saveFlashcard(flashcard: Flashcard): Promise<Flashcard> {
    return StorageService.saveFlashcard(flashcard);
  }
  async deleteFlashcard(id: string): Promise<void> {
    StorageService.deleteFlashcard(id);
  }
  async getDueFlashcards(): Promise<Flashcard[]> {
    return StorageService.getDueFlashcards();
  }
  async updateFlashcardSRS(cardId: string, srs: any): Promise<void> {
    StorageService.updateFlashcardSRS(cardId, srs);
  }
  async createFlashcardFromQuestion(question: Question): Promise<Flashcard> {
    return StorageService.createFlashcardFromQuestion(question);
  }
  async reviewFlashcard(cardId: string, rating: 1 | 2 | 3 | 4): Promise<Flashcard | null> {
    return StorageService.reviewFlashcard(cardId, rating);
  }
}

class ResilientFlashcardsRepository implements FlashcardsRepository {
  private supa = new SupabaseFlashcardsRepository();
  private local = new LocalStorageFlashcardsRepository();

  async getFlashcards(): Promise<Flashcard[]> {
    if (!isSupabaseConfigured) return this.local.getFlashcards();
    try {
      const res = await this.supa.getFlashcards();
      return res && res.length > 0 ? res : this.local.getFlashcards();
    } catch {
      return this.local.getFlashcards();
    }
  }

  async saveFlashcards(flashcards: Flashcard[]): Promise<void> {
    this.local.saveFlashcards(flashcards);
    if (isSupabaseConfigured) {
      try { await this.supa.saveFlashcards(flashcards); } catch {}
    }
  }

  async saveFlashcard(flashcard: Flashcard): Promise<Flashcard> {
    const localRes = await this.local.saveFlashcard(flashcard);
    if (isSupabaseConfigured) {
      try { return await this.supa.saveFlashcard(flashcard); } catch {}
    }
    return localRes;
  }

  async deleteFlashcard(id: string): Promise<void> {
    this.local.deleteFlashcard(id);
    if (isSupabaseConfigured) {
      try { await this.supa.deleteFlashcard(id); } catch {}
    }
  }

  async getDueFlashcards(): Promise<Flashcard[]> {
    if (!isSupabaseConfigured) return this.local.getDueFlashcards();
    try {
      return await this.supa.getDueFlashcards();
    } catch {
      return this.local.getDueFlashcards();
    }
  }

  async updateFlashcardSRS(cardId: string, srs: any): Promise<void> {
    this.local.updateFlashcardSRS(cardId, srs);
    if (isSupabaseConfigured) {
      try { await this.supa.updateFlashcardSRS(cardId, srs); } catch {}
    }
  }

  async createFlashcardFromQuestion(question: Question): Promise<Flashcard> {
    const localRes = await this.local.createFlashcardFromQuestion(question);
    if (isSupabaseConfigured) {
      try { return await this.supa.createFlashcardFromQuestion(question); } catch {}
    }
    return localRes;
  }

  async reviewFlashcard(cardId: string, rating: 1 | 2 | 3 | 4): Promise<Flashcard | null> {
    const localRes = await this.local.reviewFlashcard(cardId, rating);
    if (isSupabaseConfigured) {
      try { return await this.supa.reviewFlashcard(cardId, rating); } catch {}
    }
    return localRes;
  }
}

export const flashcardsRepository: FlashcardsRepository = new ResilientFlashcardsRepository();
