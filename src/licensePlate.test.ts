import { describe, expect, it } from 'vitest'
import {
  TOTAL_PLATES,
  licensePlateAtIndex,
  licensePlateNth
} from './licensePlate'

describe('licensePlate', () => {
  it('matches the documented sequence boundaries', () => {
    expect(licensePlateAtIndex(0)).toBe('000000')
    expect(licensePlateAtIndex(1)).toBe('000001')
    expect(licensePlateAtIndex(999_999)).toBe('999999')
    expect(licensePlateAtIndex(1_000_000)).toBe('00000A')

    expect(licensePlateAtIndex(1_099_999)).toBe('99999A')
    expect(licensePlateAtIndex(1_100_000)).toBe('00000B')

    expect(licensePlateAtIndex(3_599_999)).toBe('99999Z')
    expect(licensePlateAtIndex(3_600_000)).toBe('0000AA')
  })

  it('supports 1-based nth access', () => {
    expect(licensePlateNth(1)).toBe('000000')
    expect(licensePlateNth(1_000_000)).toBe('999999')
    expect(licensePlateNth(1_000_001)).toBe('00000A')
  })

  it('has a final value of ZZZZZZ', () => {
    expect(licensePlateAtIndex(TOTAL_PLATES - 1n)).toBe('ZZZZZZ')
    expect(licensePlateNth(TOTAL_PLATES)).toBe('ZZZZZZ')
  })

  it('throws on out-of-range input', () => {
    expect(() => licensePlateAtIndex(-1)).toThrow()
    expect(() => licensePlateAtIndex(TOTAL_PLATES)).toThrow()
    expect(() => licensePlateNth(0)).toThrow()
    expect(() => licensePlateNth(TOTAL_PLATES + 1n)).toThrow()
  })
})
