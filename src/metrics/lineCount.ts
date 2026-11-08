import type { DatabaseInfo, GitBlobObject, GitObject, RawGitObject } from "~/shared/model"
import { type MetricCache, type SegmentBucket, type SegmentedMetric } from "~/metrics/metrics"
import { noEntryColor, UNKNOWN_CATEGORY } from "~/const"
import { mdiFormatListNumbered } from "@mdi/js"
import { isBlob, rgbToHex } from "~/shared/util"
import { interpolateCool } from "d3"
import { getPrettyThresholds, uniqueSorted } from "~/metrics/metricUtils"
import { SegmentLegend, type SegmentLegendData } from "~/components/legend/SegmentLegend"

const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })

export function formatLineCount(lineCount: number): string {
  return `${lineCount.toLocaleString("en")} line${lineCount === 1 ? "" : "s"}`
}

function isInBucket(value: number, bucket: SegmentBucket, isLast: boolean) {
  return isLast ? value >= bucket.range[0] : value >= bucket.range[0] && value < bucket.range[1]
}

export const LineCountMetric: SegmentedMetric = {
  name: "Lines of code",
  description: "Files are colored based on their number of lines. Binary files are not counted.",
  icon: mdiFormatListNumbered,
  inspectionPanels: [
    {
      id: "line-count-panel",
      title: "Lines of Code",
      content: SegmentLegend,
      description: "Files are colored based on their number of lines. Binary files are not counted.",
      actions: { search: false, clear: false }
    }
  ],
  getTooltipContent(obj: GitObject, _dbi: DatabaseInfo) {
    if (obj.lineCount === undefined) {
      return isBlob(obj) ? "Binary file" : "Lines unknown"
    }
    return formatLineCount(obj.lineCount)
  },

  getCategories(obj: GitObject, dbi: DatabaseInfo) {
    const buckets = this.getBuckets(dbi)
    const index = this.getBucketIndex(obj, dbi, buckets)
    return index < 0 ? [] : [buckets[index].text]
  },

  metricFunctionFactory({ databaseInfo: dbi }, _root) {
    const buckets = this.getBuckets(dbi)

    return (blob: GitBlobObject, cache: MetricCache) => {
      cache.buckets ??= buckets
      cache.legend ??= {
        steps: buckets.length,
        textGenerator: (n) => buckets[n].text,
        colorGenerator: (n) => buckets[n].color,
        offsetStepCalc: (blob) => LineCountMetric.getBucketIndex(blob, dbi, buckets)
      } satisfies SegmentLegendData

      const color = buckets[LineCountMetric.getBucketIndex(blob, dbi, buckets)]?.color ?? noEntryColor
      cache.categoriesMap.set(blob.path, [{ category: UNKNOWN_CATEGORY, color }])
    }
  },

  getBuckets(dbi: DatabaseInfo) {
    const min = Math.max(0, dbi.minLineCount)
    const max = Math.max(min, dbi.maxLineCount)

    const edges = uniqueSorted([min, ...getPrettyThresholds(min, max, 7), max])

    const groupingsWithoutColor = Array.from({ length: Math.max(1, edges.length - 1) }, (_, i) => {
      const low = edges[i] ?? min
      const high = edges[i + 1] ?? max
      const text = i === 0 ? `<= ${compactNumber.format(high)} lines` : `> ${compactNumber.format(low)} lines`
      return { text, range: [low, high] as [number, number] }
    })

    const colorDenominator = Math.max(1, groupingsWithoutColor.length - 1)

    return groupingsWithoutColor.map((g, i) => ({
      ...g,
      color: rgbToHex(interpolateCool(i / colorDenominator))
    }))
  },

  getBucketIndex(obj: RawGitObject, dbi, buckets?: readonly SegmentBucket[]) {
    const lineCount = dbi.lineCounts[obj.path]
    if (lineCount === undefined) return -1
    const categories = buckets ?? this.getBuckets(dbi)
    return categories.findIndex((b, i) => isInBucket(lineCount, b, i === categories.length - 1))
  }
} as const
