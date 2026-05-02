import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../components/command"

function renderCommand({
  commandClassName,
  items = [
    { value: "apple", label: "Apple" },
    { value: "banana", label: "Banana" },
    { value: "cherry", label: "Cherry" },
  ],
  showEmpty = true,
  disabledValue,
}: {
  commandClassName?: string
  items?: { value: string; label: string }[]
  showEmpty?: boolean
  disabledValue?: string
} = {}) {
  return render(
    <Command data-testid="command" className={commandClassName}>
      <CommandInput data-testid="input" placeholder="Search..." />
      <CommandList data-testid="list">
        {showEmpty && <CommandEmpty data-testid="empty">No results found.</CommandEmpty>}
        <CommandGroup data-testid="group" heading="Fruits">
          {items.map((item) => (
            <CommandItem
              key={item.value}
              data-testid={`item-${item.value}`}
              value={item.value}
              disabled={item.value === disabledValue}
            >
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator data-testid="separator" />
      </CommandList>
    </Command>,
  )
}

describe("Command", () => {
  it("renders Command wrapper", () => {
    renderCommand()
    expect(screen.getByTestId("command")).toBeInTheDocument()
    expect(screen.getByTestId("command").className).toContain("bg-bg-card")
  })

  it("CommandInput renders input", () => {
    renderCommand()
    const input = screen.getByPlaceholderText("Search...")
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe("INPUT")
  })

  it('CommandList has role="listbox"', () => {
    renderCommand()
    expect(screen.getByTestId("list")).toHaveAttribute("role", "listbox")
  })

  it('CommandItem has role="option"', () => {
    renderCommand()
    expect(screen.getByTestId("item-apple")).toHaveAttribute("role", "option")
  })

  it('CommandGroup has role="group"', () => {
    renderCommand()
    expect(screen.getByTestId("group")).toHaveAttribute("role", "group")
  })

  it("CommandGroup has aria-label matching heading", () => {
    renderCommand()
    expect(screen.getByTestId("group")).toHaveAttribute("aria-label", "Fruits")
  })

  it("typing in input updates search", async () => {
    const user = userEvent.setup()
    renderCommand()

    const input = screen.getByPlaceholderText("Search...")
    await user.type(input, "app")
    expect(input).toHaveValue("app")
  })

  it("items filter based on search value", async () => {
    const user = userEvent.setup()
    renderCommand()

    const input = screen.getByPlaceholderText("Search...")
    await user.type(input, "ban")

    expect(screen.getByTestId("item-banana")).toBeInTheDocument()
    expect(screen.queryByTestId("item-apple")).not.toBeInTheDocument()
    expect(screen.queryByTestId("item-cherry")).not.toBeInTheDocument()
  })

  it("CommandEmpty renders when shown", () => {
    renderCommand()
    expect(screen.getByTestId("empty")).toHaveTextContent("No results found.")
  })

  it("disabled item has opacity-40", () => {
    renderCommand({ disabledValue: "banana" })
    expect(screen.getByTestId("item-banana").className).toContain("opacity-40")
  })

  it("CommandItem calls onSelect when clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <Command>
        <CommandList>
          <CommandItem data-testid="selectable" onSelect={onSelect}>
            Click me
          </CommandItem>
        </CommandList>
      </Command>,
    )

    await user.click(screen.getByTestId("selectable"))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it("CommandSeparator renders", () => {
    renderCommand()
    expect(screen.getByTestId("separator")).toBeInTheDocument()
    expect(screen.getByTestId("separator").className).toContain("bg-border-subtle")
  })

  it("merges custom className", () => {
    renderCommand({ commandClassName: "my-command" })
    const el = screen.getByTestId("command")
    expect(el.className).toContain("my-command")
    expect(el.className).toContain("bg-bg-card")
  })

  it("zero hardcoded color values in classNames", () => {
    renderCommand()
    const testIds = ["command", "list", "empty", "group", "item-apple", "separator"]
    for (const id of testIds) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
