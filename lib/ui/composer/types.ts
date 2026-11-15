export type Mode = 'comment' | 'dm' | 'note';

export interface MenuChoice {
  roughThought?: string;
  tone: string;
  instruction: string;
  personaId: string;
}
