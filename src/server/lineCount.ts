const NEWLINE = 0x0a
const NUL = 0x00
/** Same heuristic as git: a NUL byte within the first 8000 bytes marks the content as binary */
const BINARY_SNIFF_LENGTH = 8000

type ParserState =
  | { kind: "header"; pending: Buffer[] }
  | {
      kind: "content"
      hash: string
      size: number
      remaining: number
      newlines: number
      binary: boolean
      lastByte: number
    }
  | { kind: "trailer" }

/**
 * Counts lines in a value of `size` bytes ending with `lastByte`, where `newlines` is the number of `\n` bytes.
 * A final line without a trailing newline still counts as a line.
 */
export function linesFromNewlines(newlines: number, size: number, lastByte: number): number {
  if (size === 0) return 0
  return lastByte === NEWLINE ? newlines : newlines + 1
}

/**
 * Incremental parser for the output of `git cat-file --batch`.
 *
 * Each object is emitted as `<hash> <type> <size>\n<content>\n` (or `<hash> missing\n`).
 * Content is never buffered, so arbitrarily large blobs can be streamed through.
 * Binary blobs and missing objects are recorded as `null`.
 */
export class CatFileLineCounter {
  readonly results = new Map<string, number | null>()
  private state: ParserState = { kind: "header", pending: [] }

  push(chunk: Buffer) {
    let offset = 0
    while (offset < chunk.length) {
      switch (this.state.kind) {
        case "header": {
          const end = chunk.indexOf(NEWLINE, offset)
          if (end === -1) {
            this.state.pending.push(chunk.subarray(offset))
            return
          }
          const header = Buffer.concat([...this.state.pending, chunk.subarray(offset, end)]).toString()
          offset = end + 1
          this.startObject(header)
          break
        }
        case "content": {
          const s = this.state
          const take = Math.min(s.remaining, chunk.length - offset)
          const slice = chunk.subarray(offset, offset + take)
          const consumed = s.size - s.remaining

          if (!s.binary && consumed < BINARY_SNIFF_LENGTH) {
            s.binary = slice.subarray(0, BINARY_SNIFF_LENGTH - consumed).includes(NUL)
          }
          if (!s.binary) {
            for (let i = slice.indexOf(NEWLINE); i !== -1; i = slice.indexOf(NEWLINE, i + 1)) s.newlines++
          }
          if (take > 0) s.lastByte = slice[take - 1]

          s.remaining -= take
          offset += take
          if (s.remaining === 0) {
            this.results.set(s.hash, s.binary ? null : linesFromNewlines(s.newlines, s.size, s.lastByte))
            this.state = { kind: "trailer" }
          }
          break
        }
        case "trailer": {
          // Skip the newline git writes after every object's content
          offset++
          this.state = { kind: "header", pending: [] }
          break
        }
      }
    }
  }

  private startObject(header: string) {
    const [hash, type, sizeText] = header.split(" ")
    const size = Number(sizeText)

    if (type === "missing" || type === "ambiguous" || !Number.isFinite(size)) {
      this.results.set(hash, null)
      this.state = { kind: "header", pending: [] }
      return
    }

    this.state = { kind: "content", hash, size, remaining: size, newlines: 0, binary: false, lastByte: -1 }
    if (size === 0) {
      this.results.set(hash, 0)
      this.state = { kind: "trailer" }
    }
  }
}
