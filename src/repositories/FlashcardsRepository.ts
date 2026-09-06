import { Flashcard, Question } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseFlashcardsRepository } from './SupabaseFlashcardsRepository';

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

// Não implementa mais `FlashcardsRepository` (agora assíncrona) — mantida
// como código morto, documentado, sem uso pelo singleton (ver Etapa Fase 4-5 wiring).
class LocalStorageFlashcardsRepository {
  getFlashcards(): Flashcard[] {
    return StorageService.getFlashcards();
  }
  saveFlashcards(flashcards: Flashcard[]): void {
    StorageService.saveFlashcards(flashcards);
  }
  saveFlashcard(flashcard: Flashcard): Flashcard {
    return StorageService.saveFlashcard(flashcard);
  }
  deleteFlashcard(id: string): void {
    StorageService.deleteFlashcard(id);
  }
  getDueFlashcards(): Flashcard[] {
    return StorageService.getDueFlashcards();
  }
  updateFlashcardSRS(cardId: string, srs: any): void {
    StorageService.updateFlashcardSRS(cardId, srs);
  }
  createFlashcardFromQuestion(question: Question): Flashcard {
    return StorageService.createFlashcardFromQuestion(question);
  }
  reviewFlashcard(cardId: string, rating: 1 | 2 | 3 | 4): Flashcard | null {
    return StorageService.reviewFlashcard(cardId, rating);
  }
}

export const flashcardsRepository: FlashcardsRepository = new SupabaseFlashcardsRepository();
