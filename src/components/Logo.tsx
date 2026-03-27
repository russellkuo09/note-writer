// Logo component — shows the bouquet image + Dancing Script brand text.
// To swap the image: replace /public/logo.png.
// To swap the text style: update BrandText.tsx.

import BrandText from './BrandText'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const imgSizes = {
  sm: 36,
  md: 48,
  lg: 64,
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const imgW = imgSizes[size]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png?v=2"
        alt="Flowers for Fighters"
        width={imgW}
        style={{ height: 'auto', objectFit: 'contain', flexShrink: 0 }}
      />
      <BrandText variant="flowers" />
    </div>
  )
}
