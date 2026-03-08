export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum AppState {
  LANDING = 'LANDING',
  SIMULATOR = 'SIMULATOR',
  RESULTS = 'RESULTS',
  PRICING = 'PRICING'
}

export interface Testimonial {
  name: string;
  role: string;
  text: string;
  company: string;
}