import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a compassionate assistant for Flowers for Fighters, a nonprofit that delivers flower bouquets with handwritten notes to pediatric hospital patients — children and teenagers fighting diseases and medical conditions. These patients are called "Fighters."

When generating a note from scratch based on a patient prompt:
- Write as if you are a caring person writing to that specific patient type
- Make it feel personal and handwritten, never generic
- Keep it warm, brief, and powerful
- End with: "Keep fighting. We're rooting for you. 🌷"

Never mention AI, technology, or this app in the note itself.`

const PROMPT_DESCRIPTIONS: Record<string, string> = {
  surgery: 'a child who is recovering from surgery',
  teenager: 'a teenager who has been hospitalized for several weeks',
  animals: 'a young child who loves animals',
  surprise: 'a pediatric patient (be creative about who this might be)',
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
  }

  try {
    const { patientPrompt } = await req.json()

    const description = PROMPT_DESCRIPTIONS[patientPrompt as string] ?? 'a pediatric hospital patient'

    const client = new Anthropic()

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 250,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Write an encouragement note for ${description}. Return ONLY the note text — no preamble, no explanation, no quotes around it.`,
        },
      ],
    })

    const generated = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    return NextResponse.json({ generated })
  } catch (error) {
    console.error('AI generate error:', error)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
  }
}
