export type Hospital = 'shriners' | 'whittier' | 'healthbridge' | 'pvhmc'

export const HOSPITALS: Record<Hospital, string> = {
  shriners: "Shriners Children's SoCal",
  whittier: 'Whittier Hospital',
  healthbridge: "HealthBridge Children's",
  pvhmc: 'Pomona Valley (PVHMC)',
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
  surprise: 'Surprise me 🌸',
}

export type NoteStatus = 'queued' | 'printed' | 'archived'

export interface Profile {
  id: string
  name: string
  email: string
  role: 'supporter' | 'admin'
  created_at: string
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
  },
  {
    id: 'bouquet_builder',
    name: 'Bouquet Builder',
    icon: '🌸',
    description: 'Wrote 10 notes',
    threshold: 10,
  },
  {
    id: 'fighters_friend',
    name: "Fighter's Friend",
    icon: '💐',
    description: 'Wrote 25 notes',
    threshold: 25,
  },
  {
    id: 'champion',
    name: 'Champion',
    icon: '🏆',
    description: 'Wrote 50 notes',
    threshold: 50,
  },
]
