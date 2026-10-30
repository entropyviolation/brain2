import { describe, it, expect, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { resetAllStores } from "@/tests/test-utils"
import { useBimChatStore } from "@/lib/ingest/bim-chat"
import { BIM_PING } from "@/lib/ingest/bim"
import { BimPhoneScreen } from "@/components/Bim/phone/bim-phone"
import { BimConsole } from "@/components/Bim/console/bim-console"

describe("BIM Chat screens", () => {
  beforeEach(() => {
    resetAllStores()
    useBimChatStore.setState({ lines: [], busy: false })
  })

  it("phone terminal sends a line and shows BIM's reply", async () => {
    render(<BimPhoneScreen />)
    fireEvent.change(screen.getByLabelText("Message BIM"), { target: { value: "ping" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => expect(screen.getByText(BIM_PING)).toBeTruthy())
    expect(screen.getByText("ping")).toBeTruthy()
  })

  it("desktop console keypad types digits and planned tabs say so", async () => {
    render(<BimConsole open onOpenChange={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "2" }))
    expect((screen.getByLabelText("Message BIM") as HTMLTextAreaElement).value).toBe("2")
    fireEvent.click(screen.getByRole("button", { name: /^GRAPH/ }))
    expect(screen.getByText(/PLANNED — NOT CONNECTED YET/)).toBeTruthy()
  })

  it("console Enter sends", async () => {
    render(<BimConsole open onOpenChange={() => {}} />)
    const box = screen.getByLabelText("Message BIM")
    fireEvent.change(box, { target: { value: "ping" } })
    fireEvent.keyDown(box, { key: "Enter" })
    await waitFor(() => expect(screen.getByText(BIM_PING)).toBeTruthy())
  })
})
