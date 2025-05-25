import { createTamagui } from '@tamagui/core'
import { themes, tokens } from '@tamagui/themes'

const config = createTamagui({
  themes,
  tokens,  // Убираем createTokens()
  shorthands: {
    p: 'padding',
    m: 'margin',
    bg: 'backgroundColor',
  },
})

export type AppTamaguiConfig = typeof config
export default config
