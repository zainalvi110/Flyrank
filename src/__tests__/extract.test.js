import { describe, it, expect } from 'vitest'
import { parseModelJson, validateItems, heuristicExtract, toMarkdown } from '../lib/extract.js'

describe('parseModelJson', () => {
  it('parses clean JSON', () => {
    expect(parseModelJson('{"items":[]}')).toEqual({ items: [] })
  })
  it('survives markdown fences and chatty preamble', () => {
    const raw = 'Sure! Here you go:\n```json\n{"items":[{"task":"Send deck"}]}\n```'
    expect(parseModelJson(raw).items[0].task).toBe('Send deck')
  })
  it('throws on empty or non-JSON output', () => {
    expect(() => parseModelJson('')).toThrow()
    expect(() => parseModelJson('I cannot help with that')).toThrow()
  })
})

describe('validateItems', () => {
  it('fills in defaults for missing fields', () => {
    const [item] = validateItems({ items: [{ task: 'Email legal' }] })
    expect(item).toMatchObject({ owner: 'Unassigned', due: 'No date given', priority: 'medium' })
  })
  it('drops junk entries instead of rendering them', () => {
    expect(validateItems({ items: [null, { task: 'x' }, { owner: 'Sam' }] })).toHaveLength(0)
  })
  it('normalises an unexpected priority to medium', () => {
    expect(validateItems({ items: [{ task: 'Fix test', priority: 'URGENT!!' }] })[0].priority).toBe('medium')
  })
  it('accepts a bare array and caps the list at 25', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ task: `Task ${i}` }))
    expect(validateItems(many)).toHaveLength(25)
  })
})

describe('heuristicExtract (offline fallback)', () => {
  it('keeps commitment lines and skips discussion', () => {
    const items = heuristicExtract('Priya will send the deck by Friday\nWe talked about the weather')
    expect(items).toHaveLength(1)
    expect(items[0].owner).toBe('Priya')
    expect(items[0].due).toMatch(/Friday/)
  })
  it('returns an empty list rather than throwing on empty input', () => {
    expect(heuristicExtract()).toEqual([])
  })
})

describe('toMarkdown', () => {
  it('renders a checkbox line per item', () => {
    const md = toMarkdown([{ task: 'Email legal', owner: 'Sam', due: 'Friday', priority: 'high' }])
    expect(md).toBe('- [ ] Email legal — Sam (Friday, high)')
  })
})
