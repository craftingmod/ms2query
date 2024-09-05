import { baseConfig, type BaseConfig } from "./base/BaseConfig.ts"

export const MS2BotDefaultConfig = {
  ...baseConfig,
} satisfies BaseConfig

export type MS2BotConfig = typeof MS2BotDefaultConfig