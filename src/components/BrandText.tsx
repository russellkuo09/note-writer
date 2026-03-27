// BrandText — renders "Flowers for Fighters" or "Notes for Fighters" with
// drop-cap-style inline sizing in Dancing Script Bold.
// F/N (first word): 38px  |  f (for): 28px  |  F (Fighters): 38px  |  rest: 22px

interface BrandTextProps {
  variant?: 'flowers' | 'notes'
  className?: string
}

function StyledWord({ word, firstSize, restSize }: { word: string; firstSize: number; restSize: number }) {
  return (
    <span style={{ display: 'inline', whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: firstSize, lineHeight: 1 }}>{word[0]}</span>
      <span style={{ fontSize: restSize, lineHeight: 1 }}>{word.slice(1)}</span>
    </span>
  )
}

export default function BrandText({ variant = 'flowers', className = '' }: BrandTextProps) {
  const firstName = variant === 'flowers' ? 'Flowers' : 'Notes'

  return (
    <span
      className={className}
      style={{
        fontFamily: '"Dancing Script", cursive',
        fontWeight: 700,
        color: '#E8637A',
        display: 'inline',
      }}
    >
      <StyledWord word={firstName} firstSize={38} restSize={22} />
      {' '}
      <StyledWord word="for" firstSize={28} restSize={22} />
      {' '}
      <StyledWord word="Fighters" firstSize={38} restSize={22} />
    </span>
  )
}
