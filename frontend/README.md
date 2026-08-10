# Oathgate frontend

Merchant dashboard and customer checkout for the Oathgate crypto payment
gateway.

```bash
npm install
npm run dev
```

Runs on port 3000. The API runs on 5002.

With `NEXT_PUBLIC_API_URL` empty the whole app runs on a mock store in the
browser, so every screen works with no backend at all. Set it and the same code
talks to the real API instead. The switch lives in `src/lib/api/client.ts` and
nothing outside `src/lib/api` knows which mode it is in.

See `../notes/frontend.md` for the architecture and the remaining work.
