export type Hospital = 'shriners' | 'whittier' | 'healthbridge' | 'pvhmc' | 'texas_childrens' | 'la_ronald_mcdonald'

export const HOSPITALS: Record<Hospital, string> = {
  shriners: "Shriners Children's SoCal",
  whittier: 'Whittier Hospital',
  healthbridge: "HealthBridge Children's",
  pvhmc: 'Pomona Valley (PVHMC)',
  texas_childrens: "Texas Children's Hospital",
  la_ronald_mcdonald: 'LA Ronald McDonald House',
}

export const HOSPITAL_SLUGS = Object.keys(HOSPITALS) as Hospital[]

export type PatientPrompt =
  | 'surgery'
  | 'teenager'
  | 'animals'
  | 'surprise'

export const PATIENT_PROMPTS: Record<PatientPrompt, string> = {
  surgery: 'A child recovering from surgery',
  teenager: "A teenager who's been here for weeks",
  animals: 'A little one who loves animals',
  surprise: 'Surprise me 🌷',
}

export type NoteStatus = 'queued' | 'printed' | 'archived'

export interface Profile {
  id: string
  name: string
  email: string
  role: 'supporter' | 'admin'
  created_at: string
  current_streak: number
  longest_streak: number
  last_note_date: string | null
  referral_code: string | null
  referred_by: string | null
  referral_count: number
  referral_bonus_minutes: number
}

export interface Note {
  id: string
  author_id: string
  author_name: string
  hospital: Hospital
  patient_prompt: string | null
  body: string
  status: NoteStatus
  created_at: string
  printed_at: string | null
  dedication: string | null
}

export interface VolunteerHour {
  id: string
  user_id: string
  note_id: string
  minutes: number
  logged_at: string
}

export const MINUTES_PER_NOTE = 15

export const BADGES = [
  {
    id: 'first_bloom',
    name: 'First Bloom',
    icon: '🌱',
    description: 'Wrote your first note',
    threshold: 1,
    type: 'notes' as const,
  },
  {
    id: 'bouquet_builder',
    name: 'Bouquet Builder',
    icon: '🌷',
    description: 'Wrote 10 notes',
    threshold: 10,
    type: 'notes' as const,
  },
  {
    id: 'fighters_friend',
    name: "Fighter's Friend",
    icon: '💐',
    description: 'Wrote 25 notes',
    threshold: 25,
    type: 'notes' as const,
  },
  {
    id: 'champion',
    name: 'Champion',
    icon: '🏆',
    description: 'Wrote 50 notes',
    threshold: 50,
    type: 'notes' as const,
  },
  {
    id: 'on_a_roll',
    name: 'On a Roll',
    icon: '🔥',
    description: '3-day streak',
    threshold: 3,
    type: 'streak' as const,
  },
  {
    id: 'week_of_kindness',
    name: 'Week of Kindness',
    icon: '🔥🔥',
    description: '7-day streak',
    threshold: 7,
    type: 'streak' as const,
  },
  {
    id: 'fighters_champion',
    name: "Fighter's Champion",
    icon: '🔥🔥🔥',
    description: '30-day streak',
    threshold: 30,
    type: 'streak' as const,
  },
]
