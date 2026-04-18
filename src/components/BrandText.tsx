// BrandText — renders "Flowers for Fighters" or "Notes for Fighters"
// in Dancing Script Bold, matching the printed note card header exactly.
// Font: Dancing Script 700, 30px, #E8637A

interface BrandTextProps {
  variant?: 'flowers' | 'notes'
  className?: string
}

export default function BrandText({ variant = 'flowers', className = '' }: BrandTextProps) {
  const text = variant === 'flowers' ? 'Flowers for Fighters' : 'Notes for Fighters'

  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-dancing), cursive',
        fontWeight: 700,
        fontSize: 30,
        color: '#E8637A',
        lineHeight: 1.1,
        display: 'inline',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )
}
