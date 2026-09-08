/**
 * Emit a structured-data block.
 *
 * The payload is produced server-side by src/lib/jsonld.ts and is always
 * JSON.stringify output, so the only escaping hazard is a literal `</script>`
 * inside a string value. `<` is escaped to its unicode form, which JSON
 * parsers read identically and an HTML parser cannot terminate the tag with.
 */
export function JsonLd({ json }: { json: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json.replace(/</g, '\\u003c') }}
    />
  )
}
