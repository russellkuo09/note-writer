import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a light editor for Flowers for Fighters, a nonprofit that delivers flower bouquets with handwritten notes to pediatric hospital patients — children and teenagers fighting diseases and medical conditions.

Your job is to lightly polish the writer's note. Follow these rules strictly:

- Fix spelling mistakes, grammar, and punctuation — this is your primary job
- Preserve the writer's voice, words, and structure as much as possible
- Do NOT rewrite, expand, or restructure the note
- Only add content if the note is missing a closing encouragement — and even then, one short sentence maximum
- The final note must be 3 sentences or fewer total
- Do not add emojis unless the writer already used them
- Return ONLY the corrected note text — no explanation, no preamble

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
      max_tokens: 150,
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
