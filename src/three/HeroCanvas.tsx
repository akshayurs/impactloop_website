'use client'

import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import LoopMesh from './LoopMesh'
import Particles from './Particles'

interface Props {
  active: boolean
  lowPower: boolean
}

export default function HeroCanvas({ active, lowPower }: Props) {
  const caOffset = useMemo(() => new THREE.Vector2(0.0009, 0.0012), [])

  const effects = [
    <Bloom
      key="bloom"
      intensity={lowPower ? 0.9 : 1.4}
      luminanceThreshold={0.18}
      luminanceSmoothing={0.5}
      mipmapBlur
    />,
  ]
  if (!lowPower) {
    effects.push(
      <ChromaticAberration key="ca" offset={caOffset} radialModulation modulationOffset={0.4} />,
    )
  }
  effects.push(<Vignette key="vignette" offset={0.28} darkness={0.72} />)

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={lowPower ? [1, 1.35] : [1, 1.6]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 4.2], fov: 42 }}
    >
      <LoopMesh amplitude={lowPower ? 0.22 : 0.3} />
      {!lowPower && (
        <group position={[0, 0, -2.5]}>
          <Particles count={4000} size={16} />
        </group>
      )}

      <EffectComposer multisampling={0}>{effects}</EffectComposer>
    </Canvas>
  )
}
