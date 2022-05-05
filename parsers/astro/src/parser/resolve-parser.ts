
/** Get parser name */
export function getParserName(
    attrs: Record<string, string | undefined>,
    parser: any,
): string {
    if (parser) {
        if (typeof parser === "string" && parser !== "espree") {
            return parser
        } else if (typeof parser === "object") {
            const name = parser[attrs.lang || "js"]
            if (typeof name === "string") {
                return getParserName(attrs, name)
            }
        }
    }
    return "espree"
}
