/**
 * Choosing a Lists location (Quick Access, folder tree, Up, address)
 * exits search so the user lands on that folder's real contents.
 */

export function chooseListsLocation(
  loc: string,
  navigate: (loc: string) => void,
  clearSearch: () => void,
): void {
  clearSearch()
  navigate(loc)
}
