import { Flashcard, Question } from '../types';
import { StorageService } from '../services/storage';

export interface FlashcardsRepository {
  getFlashcards(): Flashcard[];
  saveFlashcards(flashcards: Flashcard[]): void;
  saveFlashcard(flashcard: Flashcard): Flashcard;
  deleteFlashcard(id: string): void;
  getDueFlashcards(): Flashcard[];
  updateFlashcardSRS(cardId: string, srs: any): void;
  createFlashcardFromQuestion(question: Question): Flashcard;
  reviewFlashcard(cardId: string, rating: 1 | 2 | 3 | 4): Flashcard | null;
}

class LocalStorageFlashcardsRepository implements FlashcardsRepository {
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

export const flashcardsRepository: FlashcardsRepository = new LocalStorageFlashcardsRepository();
