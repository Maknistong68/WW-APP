import { Suspense, type ComponentProps } from 'react'
import { Text } from '@react-three/drei'

/**
 * 3D text that never holds up the scene: drei's <Text> suspends while its
 * font loads (in a worker). Without its own boundary that suspends the whole
 * <Canvas> — and the page — so a slow or failing font left phones on
 * "Loading 3D…". Here the label just appears when the font is ready.
 */
export default function SafeText(props: ComponentProps<typeof Text>) {
  return (
    <Suspense fallback={null}>
      <Text {...props} />
    </Suspense>
  )
}
