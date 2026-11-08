/**
 * Normalizes customer names consistently across the application:
 * - Trims and collapses consecutive whitespace
 * - Capitalizes standard names ("ayuen" -> "Ayuen")
 * - Handles hyphenated names ("mary-jane" -> "Mary-Jane")
 * - Handles apostrophes ("o'brien" -> "O'Brien", "d'angelo" -> "D'Angelo")
 */
export function normalizeCustomerName(rawName: string | null | undefined): string {
  if (!rawName) return '';
  
  // Collapse whitespace
  const clean = rawName.trim().replace(/\s+/g, ' ');
  if (!clean) return '';

  return clean
    .split(' ')
    .map((word) => {
      // Split on hyphens
      return word
        .split('-')
        .map((part) => {
          // Split on apostrophes
          return part
            .split("'")
            .map((subpart) => {
              if (!subpart) return '';
              return subpart.charAt(0).toUpperCase() + subpart.slice(1).toLowerCase();
            })
            .join("'");
        })
        .join('-');
    })
    .join(' ');
}
