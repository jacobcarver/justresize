/** A schema.org data block. It is data, not script: browsers do not execute it. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // "<" is escaped so no string in the data can close the tag early.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
