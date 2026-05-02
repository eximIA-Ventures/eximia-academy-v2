# @eximia/ui - Component Catalog / Catalogo de Componentes

> AI-agent reference. All imports from `@eximia/ui`. All components accept `className`.

## 1. Quick Start / Inicio Rapido

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent, cn } from "@eximia/ui"
```

Components use **CVA variants** + **Tailwind CSS**. Compound components use React Context -- always nest children inside the root.

## 2. Design Tokens / Tokens de Design

```tsx
import { tokens, colors, typography, spacing, radius, shadows } from "@eximia/ui"
```

| Token | Value | | Token | Value |
|-------|-------|-|-------|-------|
| `bg-app` | `#0f0f0f` | | `text-primary` | `#ffffff` |
| `bg-card` | `#1e1e1e` | | `text-secondary` | `#a0a0a0` |
| `bg-surface` | `#1a1a1a` | | `text-muted` | `#666666` |
| `bg-elevated` | `#242424` | | `accent-blue-mid` | `#2a6ab0` |
| `bg-hover` | `#2a2a2a` | | `semantic-success` | `#4b9560` |
| `border-subtle` | `rgba(255,255,255,0.06)` | | `semantic-error` | `#fe4338` |
| `border-medium` | `rgba(255,255,255,0.1)` | | `semantic-warning` | `#f6a609` |
| `radius-sm/md/lg/xl` | `6/12/18/24px` | | `shadow-card` | `0 2px 8px rgba(0,0,0,0.4)` |
| Font: Inter | Sidebar: 200px | | TopBar: 56px | `shadow-elevated` see tokens |

---

## 3. Atoms / Atomos (15)

### Button
`import { Button } from "@eximia/ui"`
Props: `variant` (`default`|`destructive`|`outline`|`secondary`|`ghost`|`link`), `size` (`default`|`sm`|`lg`|`icon`), `disabled`
```tsx
<Button variant="default" size="default">Save</Button>
```

### Input
`import { Input } from "@eximia/ui"`
Props: `inputSize` (`sm`|`default`|`lg`), `error` (boolean), `leadingIcon`, `trailingIcon`
```tsx
<Input placeholder="Search..." leadingIcon={<SearchIcon />} />
```

### Badge
`import { Badge } from "@eximia/ui"`
Props: `variant` (`default`|`success`|`warning`|`error`|`info`|`draft`|`archived`), `badgeSize` (`sm`|`default`)
```tsx
<Badge variant="success">Active</Badge>
```

### Label
`import { Label } from "@eximia/ui"`
Props: `required` (shows red asterisk), `disabled`, `htmlFor`
```tsx
<Label htmlFor="email" required>Email</Label>
```

### Textarea
`import { Textarea } from "@eximia/ui"`
Props: `error` (boolean) + standard textarea attrs
```tsx
<Textarea placeholder="Description..." rows={4} />
```

### Toggle
`import { Toggle } from "@eximia/ui"`
Props: `checked` (boolean), `onCheckedChange` (callback), `disabled`
```tsx
<Toggle checked={enabled} onCheckedChange={setEnabled} />
```

### ProgressBar
`import { ProgressBar } from "@eximia/ui"`
Props: `value` (number, required), `max` (default 100), `variant` (`default`|`success`|`warning`), `size` (`sm`|`md`|`lg`), `label`, `showValue`
```tsx
<ProgressBar value={65} variant="success" showValue />
```

### Avatar
`import { Avatar } from "@eximia/ui"`
Props: `src`, `alt`, `fallback` (string, required), `size` (`sm`|`default`|`lg`)
```tsx
<Avatar src="/img/user.jpg" fallback="HC" size="default" />
```

### Separator
`import { Separator } from "@eximia/ui"`
Props: `orientation` (`horizontal`|`vertical`), `decorative` (boolean)
```tsx
<Separator />
```

### Card (compound)
`import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@eximia/ui"`
Sub-components accept `className` only. No custom props.
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Subtitle</CardDescription>
  </CardHeader>
  <CardContent>Body</CardContent>
  <CardFooter><Button>Action</Button></CardFooter>
</Card>
```

### Checkbox
`import { Checkbox } from "@eximia/ui"`
Props: `checked`, `onCheckedChange`, `disabled`, `children` (label)
```tsx
<Checkbox checked={agreed} onCheckedChange={setAgreed}>I agree</Checkbox>
```

### RadioGroup + RadioItem
`import { RadioGroup, RadioItem } from "@eximia/ui"`
RadioGroup: `value`, `onValueChange`, `disabled`, `name` | RadioItem: `value` (required), `disabled`, `children`
```tsx
<RadioGroup value={plan} onValueChange={setPlan}>
  <RadioItem value="free">Free</RadioItem>
  <RadioItem value="pro">Pro</RadioItem>
</RadioGroup>
```

### Select
`import { Select } from "@eximia/ui"`
Props: `selectSize` (`sm`|`default`|`lg`), `error` (boolean) + standard select attrs
```tsx
<Select><option value="">Choose...</option><option value="a">A</option></Select>
```

### Skeleton
`import { Skeleton } from "@eximia/ui"`
Props: `className` only -- use Tailwind for dimensions
```tsx
<Skeleton className="h-4 w-48 rounded-md" />
```

### Tooltip (compound)
`import { Tooltip, TooltipTrigger, TooltipContent } from "@eximia/ui"`
TooltipContent: `side` (`top`|`bottom`|`left`|`right`)
```tsx
<Tooltip>
  <TooltipTrigger><Button variant="ghost">?</Button></TooltipTrigger>
  <TooltipContent side="top">Help text</TooltipContent>
</Tooltip>
```

---

## 4. Molecules / Moleculas (7)

### FormField
`import { FormField } from "@eximia/ui"`
Props: `label` (required), `htmlFor`, `error` (string message), `required`, `disabled`, `children`
```tsx
<FormField label="Email" htmlFor="email" error={errors.email} required>
  <Input id="email" error={!!errors.email} />
</FormField>
```

### Tabs (compound)
`import { Tabs, TabsList, TabsTrigger, TabsContent } from "@eximia/ui"`
Tabs: `value`, `onValueChange` | TabsTrigger: `value`, `disabled` | TabsContent: `value`
```tsx
<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="modules">Modules</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Content here</TabsContent>
</Tabs>
```

### Breadcrumb (compound)
`import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@eximia/ui"`
BreadcrumbLink: `href`
```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem><BreadcrumbPage>Current</BreadcrumbPage></BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

### AvatarGroup
`import { AvatarGroup } from "@eximia/ui"`
Props: `max` (number, default 3) -- shows "+N" overflow
```tsx
<AvatarGroup max={3}>
  <Avatar fallback="AB" /><Avatar fallback="CD" /><Avatar fallback="EF" /><Avatar fallback="GH" />
</AvatarGroup>
```

### Pagination (compound)
`import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from "@eximia/ui"`
PaginationLink: `isActive`, `disabled`
```tsx
<Pagination>
  <PaginationContent>
    <PaginationItem><PaginationPrevious /></PaginationItem>
    <PaginationItem><PaginationLink isActive>1</PaginationLink></PaginationItem>
    <PaginationItem><PaginationLink>2</PaginationLink></PaginationItem>
    <PaginationItem><PaginationNext /></PaginationItem>
  </PaginationContent>
</Pagination>
```

### DropdownMenu (compound)
`import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@eximia/ui"`
DropdownMenu: `open`, `onOpenChange` (both optional, uncontrolled by default) | DropdownMenuItem: `disabled`
```tsx
<DropdownMenu>
  <DropdownMenuTrigger><Button variant="ghost">Menu</Button></DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Accordion (compound)
`import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@eximia/ui"`
Accordion: `type` (`single`|`multiple`), `value`, `onValueChange` | AccordionItem: `value` (required), `disabled`
```tsx
<Accordion type="single" value={openItem} onValueChange={setOpenItem}>
  <AccordionItem value="faq-1">
    <AccordionTrigger>Question?</AccordionTrigger>
    <AccordionContent>Answer.</AccordionContent>
  </AccordionItem>
</Accordion>
```

---

## 5. Organisms / Organismos (7)

### Modal (compound)
`import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter, ModalClose } from "@eximia/ui"`
Modal: `open`, `onOpenChange` | ModalContent: `size` (`sm`|`md`|`lg`|`xl`)
```tsx
<Modal open={isOpen} onOpenChange={setIsOpen}>
  <ModalOverlay />
  <ModalContent size="md">
    <ModalHeader>
      <ModalTitle>Confirm</ModalTitle>
      <ModalDescription>Are you sure?</ModalDescription>
    </ModalHeader>
    <ModalFooter>
      <ModalClose>Cancel</ModalClose>
      <Button onClick={handleConfirm}>Yes</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

### Sidebar (compound)
`import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarItem, SidebarSection, SidebarLabel } from "@eximia/ui"`
Sidebar: `collapsed` (boolean, default false -- 200px / 64px) | SidebarItem: `isActive`, `disabled`
```tsx
<Sidebar collapsed={false}>
  <SidebarHeader>Logo</SidebarHeader>
  <SidebarContent>
    <SidebarSection>
      <SidebarLabel>Menu</SidebarLabel>
      <SidebarItem isActive>Dashboard</SidebarItem>
      <SidebarItem>Courses</SidebarItem>
    </SidebarSection>
  </SidebarContent>
  <SidebarFooter>User info</SidebarFooter>
</Sidebar>
```

### TopBar (compound)
`import { TopBar, TopBarLeft, TopBarCenter, TopBarRight } from "@eximia/ui"`
Layout-only, no custom props. Height 56px, sticky.
```tsx
<TopBar>
  <TopBarLeft><h1>Title</h1></TopBarLeft>
  <TopBarCenter><Input placeholder="Search..." /></TopBarCenter>
  <TopBarRight><Avatar fallback="HC" /></TopBarRight>
</TopBar>
```

### Sheet (compound)
`import { Sheet, SheetOverlay, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@eximia/ui"`
Sheet: `open`, `onOpenChange` | SheetContent: `side` (`right`|`left`|`top`|`bottom`)
```tsx
<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetOverlay />
  <SheetContent side="right">
    <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
    <div>Controls here</div>
    <SheetFooter><Button>Apply</Button></SheetFooter>
  </SheetContent>
</Sheet>
```

### Toast + useToast
`import { ToastProvider, useToast } from "@eximia/ui"`
Wrap app with `<ToastProvider>`. Hook returns `{ toast, toasts }`.
ToastData: `variant` (`default`|`success`|`error`|`warning`|`info`), `title`, `description`, `duration` (ms, default 5000)
```tsx
// Root: <ToastProvider>{children}</ToastProvider>
const { toast } = useToast()
toast({ variant: "success", title: "Saved!", description: "Changes applied." })
```

### Table (compound)
`import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, TableFooter } from "@eximia/ui"`
No custom props -- semantic HTML wrappers with Overlens styling.
```tsx
<Table>
  <TableHeader>
    <TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead></TableRow>
  </TableHeader>
  <TableBody>
    <TableRow><TableCell>Module 1</TableCell><TableCell><Badge variant="success">Done</Badge></TableCell></TableRow>
  </TableBody>
</Table>
```

### Command (compound)
`import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@eximia/ui"`
Command: `filter` (fn) | CommandGroup: `heading` | CommandItem: `value`, `onSelect`, `disabled`
```tsx
<Command>
  <CommandInput placeholder="Type a command..." />
  <CommandList>
    <CommandEmpty>No results.</CommandEmpty>
    <CommandGroup heading="Actions">
      <CommandItem value="create" onSelect={handleCreate}>Create</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Nav">
      <CommandItem value="home" onSelect={() => navigate("/")}>Home</CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

---

## Utilities

### cn
`import { cn } from "@eximia/ui"`
Merges Tailwind classes with conflict resolution (clsx + tailwind-merge).
```tsx
<div className={cn("bg-bg-card p-4", isActive && "ring-2 ring-accent-blue-mid", className)} />
```
