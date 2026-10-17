import { fireEvent, screen } from "@testing-library/react"

/**
 * Picks an option on a `NativeSelect` by its value (or, failing that, its
 * label), the way `fireEvent.change` or `user.selectOptions` did on a native select.
 * Clicks the trigger open (a touch-style click, so no pointer events are
 * needed), then clicks the option in the portal.
 */
export function pickOption(trigger: HTMLElement, value: string) {
  fireEvent.click(trigger)
  const options = screen.getAllByRole("option")
  const option =
    options.find((el) => el.getAttribute("data-value") === value) ??
    options.find((el) => el.textContent?.trim() === value)
  if (!option) throw new Error(`No option with value "${value}" in ${trigger.getAttribute("aria-label") ?? "select"}`)
  fireEvent.click(option)
}
