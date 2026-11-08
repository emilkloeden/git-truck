import { describe, it, expect } from "vitest"
import { CatFileLineCounter, linesFromNewlines } from "~/server/lineCount"

function batchEntry(hash: string, content: Buffer | string) {
  const body = typeof content === "string" ? Buffer.from(content) : content
  return Buffer.concat([Buffer.from(`${hash} blob ${body.length}\n`), body, Buffer.from("\n")])
}

function countAll(output: Buffer, chunkSize = output.length) {
  const counter = new CatFileLineCounter()
  for (let i = 0; i < output.length; i += chunkSize) {
    counter.push(output.subarray(i, i + chunkSize))
  }
  return counter.results
}

describe("linesFromNewlines", () => {
  it("should return 0 for empty content", () => {
    expect(linesFromNewlines(0, 0, -1)).toBe(0)
  })

  it("should count a final line without trailing newline", () => {
    expect(linesFromNewlines(1, 5, "b".charCodeAt(0))).toBe(2)
  })

  it("should not count an extra line after a trailing newline", () => {
    expect(linesFromNewlines(2, 4, 0x0a)).toBe(2)
  })
})

describe("CatFileLineCounter", () => {
  const output = Buffer.concat([
    batchEntry("aaa", "one\ntwo\nthree\n"),
    batchEntry("bbb", "no trailing newline\nsecond"),
    batchEntry("ccc", ""),
    batchEntry("ddd", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0a, 0x0a])),
    Buffer.from("eee missing\n"),
    batchEntry("fff", "\n\n\n")
  ])

  const expected = new Map<string, number | null>([
    ["aaa", 3],
    ["bbb", 2],
    ["ccc", 0],
    ["ddd", null],
    ["eee", null],
    ["fff", 3]
  ])

  it("should count lines for each object in a single chunk", () => {
    expect(countAll(output)).toEqual(expected)
  })

  it("should produce the same counts when output arrives one byte at a time", () => {
    expect(countAll(output, 1)).toEqual(expected)
  })

  it("should produce the same counts for arbitrary chunk boundaries", () => {
    for (const size of [2, 3, 7, 13]) {
      expect(countAll(output, size)).toEqual(expected)
    }
  })

  it("should treat content as text when a NUL byte appears after the sniff window", () => {
    const content = Buffer.concat([Buffer.from("x\n".repeat(5000)), Buffer.from([0x00])])
    expect(countAll(batchEntry("ggg", content), 4096).get("ggg")).toBe(5001)
  })
})
