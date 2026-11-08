export const SizeMetric = {
  FILE_SIZE: "File size",
  LINE_COUNT: "Lines of code",
  MOST_COMMITS: "Commits",
  MOST_CONTRIBUTIONS: "Line changes",
  EQUAL_SIZE: "Equal",
  LAST_CHANGED: "Last changed"
}

export type SizeMetricType = keyof typeof SizeMetric
