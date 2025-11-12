## Setup

1. Install dependencies with pnpm:
```bash
pnpm install
# or the short alias
pnpm i
```

2. Copy environment example:
```bash
cp .env.example .env
```

Adjust values in `.env` as needed. Note that it needs a `DATABASE_URL` and `FASTAPI_URL` to work.

## Developing
1. Start a development server:
```bash
pnpm run dev
# or run the script directly
pnpm dev

# open in a browser (if supported by your script)
pnpm run dev -- --open
```

## Building
1. Create a production build:
```bash
pnpm run build
```

2. Preview the production build:
```bash
pnpm run preview
```