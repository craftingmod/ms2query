export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function forceNull<T>(value: T | null | undefined): T | null {
  if (value === undefined) {
    return null
  }
  return value
}