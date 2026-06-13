'use client'
import React, { memo } from 'react'

interface PremiumStarProps {
  activo: boolean
  size?: number | string
  className?: string
}

export const PremiumStar = memo(({ activo, size = 32, className = '' }: PremiumStarProps) => {
  // SVG 5-point star path
  const path = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
  
  const sizeClass = typeof size === 'number' ? `${size}px` : size

  if (activo) {
    return (
      <svg
        style={{ width: sizeClass, height: sizeClass }}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-[0_0_10px_rgba(245,158,11,0.45)] transition-all duration-300 transform hover:scale-110 ${className}`}
      >
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
        </defs>
        <path
          d={path}
          fill="url(#goldGradient)"
          stroke="#ca8a04"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg
      style={{ width: sizeClass, height: sizeClass }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-300 ${className}`}
    >
      <path
        d={path}
        fill="#f4f4f5"
        stroke="#d4d4d8"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
})

PremiumStar.displayName = 'PremiumStar'
