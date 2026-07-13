'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { loopVertexShader, loopFragmentShader } from './shaders'

interface Props {
  amplitude?: number
  animate?: boolean
}

// Morphing torus-knot ("the loop") with noise displacement + iridescent fresnel.
export default function LoopMesh({ amplitude = 0.28, animate = true }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const scrollRef = useRef(0)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: loopVertexShader,
        fragmentShader: loopFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: amplitude },
          uColorA: { value: new THREE.Color('#7c5cff') },
          uColorB: { value: new THREE.Color('#22d3ee') },
          uColorC: { value: new THREE.Color('#e879f9') },
        },
      }),
    [amplitude],
  )

  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return

    if (animate) {
      material.uniforms.uTime.value += delta
    }

    // Mouse / touch parallax — ease group toward pointer.
    const px = state.pointer.x
    const py = state.pointer.y
    g.rotation.x += (-py * 0.35 - g.rotation.x) * 0.05
    g.rotation.z += (px * 0.15 - g.rotation.z) * 0.05
    if (animate) g.rotation.y += delta * 0.18

    // Subtle scroll-linked scale + drift.
    const progress = window.scrollY / Math.max(window.innerHeight, 1)
    scrollRef.current += (progress - scrollRef.current) * 0.08
    const sc = 1 - Math.min(scrollRef.current, 1) * 0.25
    g.scale.setScalar(sc)
    g.position.y = -scrollRef.current * 0.6
  })

  return (
    <group ref={groupRef}>
      <mesh material={material}>
        <torusKnotGeometry args={[1, 0.32, 240, 32, 2, 3]} />
      </mesh>
    </group>
  )
}
