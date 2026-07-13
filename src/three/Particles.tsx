'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { particleVertexShader, particleFragmentShader } from './shaders'

interface Props {
  count?: number
  size?: number
  animate?: boolean
}

// GPU point cloud distributed along a torus-knot path — a glowing "loop" of particles
// that swirls over time and parallaxes toward the pointer.
export default function Particles({ count = 32000, size = 26, animate = true }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const { viewport } = useThree()

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const randoms = new Float32Array(count)
    const p = 2
    const q = 3

    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2 * 3
      const r = Math.cos(q * t) + 2.4
      let x = r * Math.cos(p * t)
      let y = r * Math.sin(p * t)
      let z = -Math.sin(q * t) * 1.4

      // scatter around the curve to give the loop volume
      const spread = 0.55 * Math.pow(Math.random(), 0.6)
      x += (Math.random() - 0.5) * spread
      y += (Math.random() - 0.5) * spread
      z += (Math.random() - 0.5) * spread

      const s = 0.9 / 2.0
      positions[i * 3] = x * s
      positions[i * 3 + 1] = y * s
      positions[i * 3 + 2] = z * s
      scales[i] = 0.4 + Math.random() * 1.2
      randoms[i] = Math.random()
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    g.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: size },
          uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
          uColorA: { value: new THREE.Color('#7c5cff') },
          uColorB: { value: new THREE.Color('#22d3ee') },
          uColorC: { value: new THREE.Color('#e879f9') },
        },
      }),
    [size],
  )

  useFrame((state, delta) => {
    if (animate) material.uniforms.uTime.value += delta
    const g = groupRef.current
    if (!g) return
    const px = state.pointer.x
    const py = state.pointer.y
    g.rotation.y += (px * 0.4 - g.rotation.y) * 0.04
    g.rotation.x += (-py * 0.25 - g.rotation.x) * 0.04
    if (animate) g.rotation.z += delta * 0.02
  })

  const scale = Math.min(viewport.width, viewport.height) * 0.42

  return (
    <group ref={groupRef} scale={scale}>
      <points geometry={geometry} material={material} />
    </group>
  )
}
