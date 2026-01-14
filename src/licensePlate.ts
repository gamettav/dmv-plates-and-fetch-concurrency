const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const PLATE_LENGTH = 6

function toBigInt(value: number | bigint, name: string): bigint {
  if (typeof value === 'bigint') return value
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer number or bigint`)
  }
  return BigInt(value)
}

function pow(base: bigint, exp: number): bigint {
  let result = 1n
  for (let i = 0; i < exp; i++) result *= base
  return result
}

function blockSize(letterCount: number): bigint {
  const digitCount = PLATE_LENGTH - letterCount
  return pow(10n, digitCount) * pow(26n, letterCount)
}

export const TOTAL_PLATES: bigint = (() => {
  let total = 0n
  for (let letters = 0; letters <= PLATE_LENGTH; letters++)
    total += blockSize(letters)
  return total
})()

function lettersFromIndex(letterIndex: bigint, letterCount: number): string {
  if (letterCount === 0) return ''

  let x = letterIndex
  const chars: string[] = new Array(letterCount)
  for (let pos = letterCount - 1; pos >= 0; pos--) {
    const rem = x % 26n
    chars[pos] = ALPHABET[Number(rem)]
    x = x / 26n
  }
  return chars.join('')
}

function digitsFromIndex(digitIndex: bigint, digitCount: number): string {
  if (digitCount === 0) return ''
  const s = digitIndex.toString(10)
  return s.padStart(digitCount, '0')
}

/**
 * 0-based index into the DMV plate sequence (index 0 => "000000").
 */
export function licensePlateAtIndex(index: number | bigint): string {
  let n = toBigInt(index, 'index')
  if (n < 0n) throw new Error('index must be non-negative')
  if (n >= TOTAL_PLATES) throw new Error('index out of range')

  let letterCount = 0
  while (letterCount <= PLATE_LENGTH) {
    const size = blockSize(letterCount)
    if (n < size) break
    n -= size
    letterCount++
  }

  const digitCount = PLATE_LENGTH - letterCount
  const digitRange = pow(10n, digitCount)

  const digitIndex = n % digitRange
  const letterIndex = n / digitRange

  return (
    digitsFromIndex(digitIndex, digitCount) +
    lettersFromIndex(letterIndex, letterCount)
  )
}

/**
 * 1-based "nth" plate in the sequence (n=1 => "000000").
 */
export function licensePlateNth(n: number | bigint): string {
  const nth = toBigInt(n, 'n')
  if (nth < 1n) throw new Error('n must be >= 1')
  return licensePlateAtIndex(nth - 1n)
}

export const plateAtIndex = licensePlateAtIndex
export const nthPlate = licensePlateNth
