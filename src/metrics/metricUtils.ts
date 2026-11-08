import languageMap from "language-map/languages.json" with { type: "json" }
import type { GitObject, HexColor } from "~/shared/model"
import { isBlob } from "~/shared/util"
import { reduceTree } from "~/shared/utils/tree"
import { scaleLinear, scaleLog } from "d3"

interface ColorResult {
  lang: string
  color: HexColor | null
}

/**
 * Counts all leaf nodes (blobs) in a tree recursively.
 * @param root The root GitObject to count leaf nodes from
 * @returns The total number of leaf nodes (blobs)
 */
export function countLeafNodes(root: GitObject): number {
  if (root.type === "blob") {
    return 1
  }

  return reduceTree(root, (prev, curr) => prev + (isBlob(curr) ? 1 : 0), 0)
}

const extensionToColor = new Map<string, ColorResult>()

for (const [lang, { color, extensions }] of Object.entries(
  languageMap as Record<
    string,
    {
      color?: string
      extensions?: string[]
    }
  >
)) {
  if (!extensions) {
    continue
  }

  for (const ext of extensions) {
    const extWithoutDot = ext.startsWith(".") ? ext.slice(1) : ext
    extensionToColor.set(extWithoutDot, {
      lang,
      color: (color ?? null) as HexColor | null
    })
  }
}

export function getColorFromExtension(extension: string): ColorResult | null {
  const colorResult = extensionToColor.get(extension)
  if (!colorResult) return null
  return colorResult
}

export class SpectrumTranslater {
  readonly scale: number
  readonly offset: number
  readonly target_max: number
  readonly target_min: number
  readonly isZeroRange: boolean

  constructor(input_min: number, input_max: number, target_min: number, target_max: number) {
    this.isZeroRange = input_min === input_max
    this.scale = (target_max - target_min) / (input_max - input_min)
    this.offset = input_min * this.scale - target_min
    this.target_max = target_max
    this.target_min = target_min
  }

  translate(input: number) {
    return input * this.scale - this.offset
  }

  inverseTranslate(input: number) {
    // When min equals max, use the maximum (inverse) gradient value to avoid black
    if (this.isZeroRange) {
      return this.target_min
    }
    return this.target_max - this.translate(input) + this.target_min
  }
}

export function getMinMaxValuesForMetric(
  root: GitObject,
  perFileMap: Record<string, number>
): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity

  function traverse(node: GitObject) {
    if (node.type === "blob") {
      const value = perFileMap[node.path]
      if (value !== undefined) {
        min = Math.min(min, value)
        max = Math.max(max, value)
      }
    } else {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  traverse(root)
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max }
}

export function uniqueSorted(values: number[]): number[] {
  return values
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b)
    .filter((v, i, arr) => i === 0 || v > arr[i - 1])
}

export function getPrettyThresholds(min: number, max: number, desiredBuckets = 7): number[] {
  if (max <= min) return [max]

  // Prefer logarithmic nice ticks (suits heavily skewed values like file sizes); fallback to linear when needed.
  const logMin = Math.max(1, min)
  let ticks = scaleLog().domain([logMin, max]).nice().ticks(desiredBuckets)

  if (ticks.length < 2) {
    ticks = scaleLinear().domain([min, max]).nice().ticks(desiredBuckets)
  }

  // Cap to desiredBuckets to avoid overwhelming legends
  const filtered = uniqueSorted(ticks).filter((t) => t > min && t < max)
  if (filtered.length > desiredBuckets) {
    const step = Math.ceil(filtered.length / desiredBuckets)
    return filtered.filter((_, i) => i % step === 0)
  }
  return filtered
}
