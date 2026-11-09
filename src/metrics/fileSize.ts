import type { DatabaseInfo, GitBlobObject, GitObject } from "~/shared/model"
import { type MetricCache, type SegmentBucket, type SegmentedMetric } from "~/metrics/metrics"
import { noEntryColor, UNKNOWN_CATEGORY } from "~/const"
import { mdiResize } from "@mdi/js"
import { hslToHex, isBlob, rgbToHex } from "~/shared/util"
import { interpolateCool } from "d3"
import { getPrettyThresholds, SpectrumTranslater, uniqueSorted } from "~/metrics/metricUtils"
import { feature_flags } from "~/feature_flags"
import { SegmentLegend, type SegmentLegendData } from "~/components/legend/SegmentLegend"
import type { GradLegendData } from "~/components/legend/GradiantLegend"
import byteSize from "byte-size"

export const FileSizeMetric: SegmentedMetric = {
  name: "File size",
  description: "Files are colored based on their file size in bytes.",
  icon: mdiResize,
  inspectionPanels: [
    {
      id: "file-size-panel",
      title: "File Size",
      content: SegmentLegend,
      description: "Files are colored based on their file size in bytes.",
      actions: { search: false, clear: false }
    }
  ],
  getTooltipContent(obj: GitObject, _dbi: DatabaseInfo) {
    if (!isBlob(obj)) {
      // TODO: Aggregate folder size
      return "FileSizeMetric is only defined for blobs"
    }
    // const count = contributors.length || 0
    const fileSizeInBytes = obj.byteSize
    if (fileSizeInBytes === undefined || fileSizeInBytes === null) {
      return "Size unknown"
    }
    const formattedSize = byteSize(fileSizeInBytes)

    return formattedSize.toString()

    // return `${count} contributor${count !== 1 ? "s" : ""}`
  },

  getCategories(obj: GitObject, dbi: DatabaseInfo) {
    const categories = this.getBuckets(dbi)
    const lastIndex = categories.length - 1

    return categories
      .filter((g, i) =>
        i === lastIndex ? obj.byteSize >= g.range[0] : obj.byteSize >= g.range[0] && obj.byteSize < g.range[1]
      )
      ?.map((c) => c.text)
  },

  //For now we don't use _root for calculation
  metricFunctionFactory({ databaseInfo: dbi }, _root) {
    const fileSizeGroupings = this.getBuckets(dbi)
    const fileSizeMapper = new FileSizeTranslater(dbi.minFileSize, dbi.maxFileSize)

    return (blob: GitBlobObject, cache: MetricCache) => {
      cache.buckets ??= fileSizeGroupings

      if (feature_flags.fileSizeAsGrad) {
        if (!cache.legend) {
          cache.legend = {
            minValue: dbi.minFileSize,
            maxValue: dbi.maxFileSize,
            minValueAltFormat: undefined,
            maxValueAltFormat: undefined,
            minColor: fileSizeMapper.getColor(dbi.minFileSize),
            maxColor: fileSizeMapper.getColor(dbi.maxFileSize)
          } satisfies GradLegendData
        }
        fileSizeMapper.setColor(blob, cache, dbi.fileSizes)
      } else {
        if (!cache.legend) {
          cache.legend = {
            steps: fileSizeGroupings.length,
            textGenerator: (n) => fileSizeGroupings[n].text,
            colorGenerator: (n) => fileSizeGroupings[n].color,
            offsetStepCalc: (blob) => {
              const size = dbi.fileSizes[blob.path]
              return size === undefined ? -1 : FileSizeMetric.getBucketIndex(blob, dbi, fileSizeGroupings)
            }
          } satisfies SegmentLegendData
        }
        const fileSize = dbi.fileSizes[blob.path]
        if (fileSize === undefined) {
          cache.categoriesMap.set(blob.path, [{ category: UNKNOWN_CATEGORY, color: noEntryColor }])
          return
        }

        const index = FileSizeMetric.getBucketIndex(blob, dbi, fileSizeGroupings)
        if (index < 0) {
          cache.categoriesMap.set(blob.path, [{ category: UNKNOWN_CATEGORY, color: noEntryColor }])
          return
        }

        const color = fileSizeGroupings[index]?.color
        if (!color) {
          cache.categoriesMap.set(blob.path, [{ category: UNKNOWN_CATEGORY, color: noEntryColor }])
          return
        }

        cache.categoriesMap.set(blob.path, [{ category: UNKNOWN_CATEGORY, color }])
      }
    }
  },
  getBuckets(dbi: DatabaseInfo) {
    const min = Math.max(0, dbi.minFileSize)
    const max = Math.max(min, dbi.maxFileSize)

    const thresholds = getPrettyThresholds(min, max, 7)
    const edges = uniqueSorted([min, ...thresholds, max])

    const groupingsWithoutColor = Array.from({ length: Math.max(1, edges.length - 1) }, (_, i) => {
      const low = edges[i] ?? min
      const high = edges[i + 1] ?? max
      const text = i === 0 ? `<= ${byteSize(high, { precision: 0 })}` : `> ${byteSize(low, { precision: 0 })}`
      return {
        text,
        range: [low, high] as [number, number]
      }
    })

    const colorDenominator = Math.max(1, groupingsWithoutColor.length - 1)

    return groupingsWithoutColor.map((g, i) => ({
      ...g,
      color: rgbToHex(interpolateCool(i / colorDenominator))
    }))
  },

  getBucketIndex(obj, dbi, buckets?: readonly SegmentBucket[]) {
    const categories = buckets ?? this.getBuckets(dbi)
    const lastIndex = categories.length - 1
    return categories.findIndex((g, i) =>
      i === lastIndex ? obj.byteSize >= g.range[0] : obj.byteSize >= g.range[0] && obj.byteSize < g.range[1]
    )
  }
} as const

class FileSizeTranslater {
  readonly translater: SpectrumTranslater
  readonly min_lightness = 50
  readonly max_lightness = 95

  constructor(min: number, max: number) {
    this.translater = new SpectrumTranslater(min, max, this.min_lightness, this.max_lightness)
  }

  getColor(value: number): `#${string}` {
    return hslToHex(20, 100, this.translater.inverseTranslate(value))
  }

  setColor(blob: GitBlobObject, cache: MetricCache, fileSizePerFile: Record<string, number>) {
    const existing = fileSizePerFile[blob.path]
    const color = existing === undefined ? noEntryColor : this.getColor(existing)
    cache.categoriesMap.set(blob.path, [{ category: UNKNOWN_CATEGORY, color }])
  }
}
