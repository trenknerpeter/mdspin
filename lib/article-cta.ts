/**
 * Splits rendered article HTML so a call-to-action can sit part-way through it.
 *
 * Guide and blog bodies are a single HTML string from remark, injected with
 * dangerouslySetInnerHTML. To place anything mid-article we have to cut that
 * string, and `<h2>` is the only boundary that is both semantically right (a
 * section break, never mid-sentence) and reliably present — every article in
 * content/ has between 7 and 10 of them.
 *
 * Cutting before a top-level tag cannot produce unbalanced markup: everything
 * before the match is closed, everything after opens with the heading.
 */
export function splitBeforeNthH2(html: string, n: number): [string, string] {
  if (n < 1) return [html, ""]

  let index = -1
  for (let found = 0; found < n; found++) {
    index = html.indexOf("<h2", index + 1)
    // Short article, or fewer headings than asked for: leave it whole rather
    // than cutting somewhere arbitrary. Callers render the CTA only when the
    // second half is non-empty, so this degrades to "no mid-article CTA".
    if (index === -1) return [html, ""]
  }

  return [html.slice(0, index), html.slice(index)]
}
