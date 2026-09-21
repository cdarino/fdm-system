const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i;

/**
 * Display name for a stored document, recovered from its object path.
 *
 * Paths are written as `{client_id}/{uuid}-{sanitized-filename}` by
 * lib/storage/client-documents.ts, so the readable part is whatever follows
 * the uuid. Rows created before storage existed hold an arbitrary string, and
 * older seeds may not match at all, so anything unrecognised is returned as-is
 * rather than blanked.
 */
export function formatDocumentName(filePath: string): string {
  const basename = filePath.split('/').pop() ?? filePath;
  const match = basename.match(UUID_PREFIX);
  return match ? match[1] : basename;
}

/**
 * The same name as separate words, for indexing and display.
 *
 * Uploading "deed of sale sample.pdf" stores it as `deed_of_sale_sample.pdf`,
 * because the object path cannot hold spaces. Indexed in that form it becomes a
 * single token, so searching "deed of sale" finds nothing. Splitting it back
 * into words is what makes the file findable by the name it was given.
 */
export function humanizeDocumentName(filePath: string): string {
  return formatDocumentName(filePath)
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
