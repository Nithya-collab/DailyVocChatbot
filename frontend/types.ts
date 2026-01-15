
export enum Platform {
  WhatsApp = 'WhatsApp',
  Telegram = 'Telegram',
  Discord = 'Discord',
  Instagram = 'Instagram'
}

export interface VocabWord {
  id: string;
  word: string;
  definition: string;
  example: string;
  imageUrl: string;
  pronunciation: string;
  tamilMeaning?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  platform: Platform;
  reminderTime: string; // e.g., "10:00"
  currentWords: VocabWord[];
  lastGenerated: string; // ISO date
}

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: Date;
  attachment?: string;
}

export interface ScheduleIntent {
  action: 'remind' | 'other';
  delayMinutes?: number;
  absoluteTime?: string;
}
