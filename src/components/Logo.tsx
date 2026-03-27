
// Logo component — uses the real Flowers for Fighters logo from /public/logo.png
// To update the logo: replace /public/logo.png with the new file.

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { w: 100, h: 40 },
  md: { w: 140, h: 56 },
  lg: { w: 200, h: 80 },
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const { w, h } = sizes[size]

  return (
    <div className={`flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/logo.png?v=2`}
        alt="Flowers for Fighters"
        width={w}
        style={{ height: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}
