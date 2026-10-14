declare module 'lottie-web/build/player/lottie_light.min.js' {
  type AnimationOptions = {
    container: Element
    renderer: 'svg'
    loop: boolean
    autoplay: boolean
    animationData: unknown
  }

  type AnimationInstance = { destroy(): void; pause(): void; play(): void }
  const lottie: { loadAnimation(options: AnimationOptions): AnimationInstance }
  export default lottie
}
