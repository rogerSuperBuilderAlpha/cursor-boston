# Supabase pgvector setup (one-time)

Run `supabase_pgvector_setup.sql` in the Supabase SQL editor to create:

- `public.athlete_documents` (pgvector-backed table)
- cosine `ivfflat` index on `embedding`
- RLS: authenticated reads allowed, no direct client writes
- `public.upsert_athlete_document(...)` RPC for service-role upserts
- `public.upsert_player_document(...)` wrapper RPC (the pipeline calls this name)

Both RPCs are **service-role only** (granted to `service_role`; revoked from `anon` / `authenticated`).

## Embedding dimension (DIM) must match

The table uses:

- `embedding vector(1024)`

If your embedding model returns a different length, edit **every** `1024` in `supabase_pgvector_setup.sql` to match.

### How to verify DIM quickly

In Python, after you get an embedding vector `emb`:

```python
print(len(emb))
```

That integer must equal the `vector(DIM)` in Postgres, otherwise the RPC will reject the upsert with an “embedding dim mismatch” error.

