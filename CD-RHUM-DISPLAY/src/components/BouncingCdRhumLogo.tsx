import { useEffect, useRef, useState } from 'preact/hooks'

const COLORS = [
  '#FF1B8D',
  '#FF6359',
  '#FF7A47',
  '#FFAA24',
  '#FFD900',
  '#8DC680',
  '#54BDC0',
  '#1BB3FF',
]

function randomColor(except: string) {
  const available = COLORS.filter((color) => color !== except)
  return available[Math.floor(Math.random() * available.length)]
}

export function BouncingCdRhumLogo() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const logoRef = useRef<HTMLDivElement | null>(null)

  const [color, setColor] = useState(COLORS[0])

  useEffect(() => {
    const container = containerRef.current
    const logo = logoRef.current

    if (!container || !logo) return

    let x = 8
    let y = 8
    let vx = 1
    let vy = 0.2
    let frameId = 0

    const animate = () => {
      const maxX = Math.max(0, container.clientWidth - logo.clientWidth)
      const maxY = Math.max(0, container.clientHeight - logo.clientHeight)

      x += vx
      y += vy

      let collided = false

      if (x <= 0) {
        x = 0
        vx = Math.abs(vx)
        collided = true
      } else if (x >= maxX) {
        x = maxX
        vx = -Math.abs(vx)
        collided = true
      }

      if (y <= 0) {
        y = 0
        vy = Math.abs(vy)
        collided = true
      } else if (y >= maxY) {
        y = maxY
        vy = -Math.abs(vy)
        collided = true
      }

      if (collided) {
        setColor((current) => randomColor(current))
      }

      logo.style.transform = `translate(${x}px, ${y}px)`
      frameId = requestAnimationFrame(animate)
    }

    logo.style.transform = `translate(${x}px, ${y}px)`
    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div ref={containerRef} class="cd-rhum-logo-stage">
      <div ref={logoRef} class="cd-rhum-logo" style={{ color }}>
        CD-RHUM
      </div>
    </div>
  )
}
