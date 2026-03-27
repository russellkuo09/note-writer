import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a compassionate assistant for Flowers for Fighters, a nonprofit that delivers flower bouquets with handwritten notes to pediatric hospital patients — children and teenagers fighting diseases and medical conditions. These patients are called "Fighters."

When polishing a note:
- Preserve the writer's personal voice completely — do not make it sound AI-generated
- Keep it warm, hopeful, and human
- Never use clinical language or reference illness directly
- The tone should feel like a caring stranger wrote it by hand
- Always end with encouragement to keep fighting
- Keep it under 150 words
- Do not add excessive emojis — one or two maximum

Never mention AI, technology, or this app in the note itself.`

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
  }

  try {
    const { note, patientPrompt } = await req.json()

    if (!note || typeof note !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const client = new Anthropic()

    const contextNote = patientPrompt
      ? `This note is for: ${patientPrompt}\n\nNote to polish:\n${note}`
      : `Note to polish:\n${note}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Please polish this encouragement note for a pediatric hospital patient. Return ONLY the polished note text — no preamble, no explanation.\n\n${contextNote}`,
        },
      ],
    })

    const polished = message.content[0].type === 'text' ? message.content[0].text.trim() : note

    return NextResponse.json({ polished })
  } catch (error) {
    console.error('AI polish error:', error)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
  }
}
