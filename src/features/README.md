# Features

Domain-driven home for business logic. Each subfolder owns one concept end-to-end.

## Convention

Inside each feature folder you'll find some or all of:

```
features/<domain>/
├── schemas.ts       Zod schemas — the source of truth for shape & validation
├── types.ts         TS types (mostly z.infer<typeof ...> — no parallel types)
├── queries.ts       Server-side reads (called from React Server Components)
├── actions.ts       Server Actions (mutations, called from forms or client)
├── components/      Feature-specific React components (server + client)
└── README.md        Optional notes on this feature's design choices
```

## Rules

1. **Schemas are the source of truth.** Define the Zod schema first, then derive TS types via `z.infer`. Never hand-write parallel types that could drift.
2. **Queries live with the feature, not in API routes.** A Server Component imports `queries.ts` directly and awaits it. No HTTP roundtrip.
3. **Mutations are Server Actions, not API routes.** Use `actions.ts` and validate input with the matching schema's `safeParse`. Return discriminated unions, not throws.
4. **Cross-feature coupling goes through the feature's public surface.** If `lessons` needs a course, it imports from `features/courses`. No reaching into another feature's `components/` or internal utilities.
5. **No client-side fetching of internal data.** Anything you'd previously have fetched via `useEffect` + axios should now be a server-rendered query. TanStack Query is allowed only when the data genuinely lives client-side (e.g. polling, optimistic updates).

## Migration status

Foundation seeded these folders with `schemas.ts` (Zod) + `index.ts` placeholders.
`queries.ts`, `actions.ts`, and `components/` are created per-feature as we migrate
each one off the old context/axios pattern in subsequent chapters.
