type HeadTag =
  | [tagName: string, textContent: string]
  | [tagName: string, attrs: Record<string, string>]

export function setHeadTags(route: string, tags: HeadTag[]) {
  for (const tag of tags) {
  }
}
