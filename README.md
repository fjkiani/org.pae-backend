# PAE-Onc — Prior Authorization Appeal Engine for Oncology

A full-stack agentic AI application that automates prior authorization appeals for oncology drugs.
Covers **25 cancer types**, 4 major payers (UHC, Cigna, Aetna, Humana), with an end-to-end
Agent A→B→C pipeline powered by **Cohere command-a-03-2025**.

## Architecture

```
client/          React + Vite + TypeScript frontend
server/          Express API backend
  agents/        Agentic pipeline (A→B→C + logger + run-store + orchestrator)
  etl/           4-stage ETL pipeline (FDA → NCCN → Payer → Ground Truth)
  cohere-engine  Cohere LLM integration
  pdf-generator  PDFKit 7-page appeal packet generator
  routes.ts      All API endpoints incl. SSE streaming
  seed.ts        Seeds 15 drugs, NCCN rules, payer policies, ground truth
shared/          Drizzle ORM schema (shared between client and server)
dist/            Built output (after npm run build)
  index.cjs      Production server bundle
  public/        Static frontend bundle
```

## Quick Start

### Requirements
- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm run dev        # Development mode (hot reload, port 5000)
```

### Production Build & Run

```bash
npm run build
npm start          # Runs dist/index.cjs on port 5000
```

Open http://localhost:5000 in your browser.

## Cohere API Key

The Cohere API key is pre-configured in the source (sandbox key):
`lfWaRwjaOdTuZEOlP2uLFyFMTWcDfM0EtLLQZl7Q`

For production, replace it in:
- `server/cohere-engine.ts`
- `server/agents/agent-a.ts`
- `server/agents/agent-b.ts`
- `server/etl/fda-ingest.ts`
- `server/etl/nccn-extractor.ts`
- `server/etl/payer-policy-crawler.ts`

Or set the environment variable `COHERE_API_KEY` and update imports accordingly.

## Key Features

### Agentic Pipeline (Agent Console → Appeal Pipeline tab)
1. **Agent A** — Denial Ingestion: OCR/extract denial text via Cohere, normalize fields
2. **Agent B** — Ground Truth Matching: exact→fuzzy→Cohere-assisted matching, conflict classification (A/B/C/D), appeal strength scoring (1–5)
3. **Agent C** — Appeal Generation: Cohere generates 6 sections (~800 words each), PDFKit renders 7-page packet, fax queued to payer

### ETL Pipeline (Agent Console → ETL tab)
- **A1**: openFDA API — fetches oncology drugs across all 25 cancer types
- **A2**: NCCN extraction — Cohere extracts NCCN guideline rules per drug
- **A3**: Payer policy crawler — Cohere generates realistic payer policies for 4 payers
- **A4**: Ground truth builder — cross-joins NCCN × payer to auto-classify conflicts

### 25 Cancer Types
breast, lung, colon, ovarian, brain, prostate, bladder, pancreatic, liver, gastric,
esophageal, cervical, endometrial, thyroid, melanoma, renal, head_neck, leukemia,
lymphoma, myeloma, sarcoma, mesothelioma, bile_duct, neuroendocrine, myelodysplastic

### 4 Payers (with real Medical Director fax numbers)
- UHC: +1-866-252-0566
- Cigna: +1-800-337-0255
- Aetna: +1-860-754-3604
- Humana: +1-800-457-4708

### Conflict Types
- **Type A**: NCCN Cat 1/2A drug classified as experimental
- **Type B**: FDA-approved drug classified as not medically necessary
- **Type C**: Step therapy requirement contradicts NCCN sequence
- **Type D**: CMS shadow policy creates systematic PA barriers

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/stats | Dashboard KPIs |
| GET | /api/drugs | All drugs (filter by ?cancerType=) |
| GET | /api/nccn | NCCN guidelines |
| GET | /api/payer-policies | Payer policy rules |
| GET | /api/ground-truth | Ground truth dataset |
| GET | /api/patients | Patient profiles |
| GET | /api/denials | All denials |
| POST | /api/denials | Create denial |
| GET | /api/appeals | All appeals |
| GET | /api/appeals/:id/pdf | Download appeal PDF |
| POST | /api/agents/run | Start A→B→C pipeline |
| GET | /api/agents/runs | List all pipeline runs |
| GET | /api/agents/logs/:runId | Get run logs |
| GET | /api/agents/stream/:runId | SSE live log stream |
| POST | /api/etl/run | Start full ETL pipeline |
| GET | /api/etl/status | ETL run status |
| POST | /api/pipeline/run | Legacy one-shot pipeline |

## Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter
- **Backend**: Express 5, TypeScript, in-memory storage (MemStorage)
- **AI**: Cohere `command-a-03-2025`
- **PDF**: PDFKit (7-page appeal packets)
- **Data**: Drizzle ORM schema (SQLite-compatible, uses in-memory storage)

## Notes

- Storage is **in-memory** — data resets on server restart. For persistence, swap `MemStorage` for a real DB (PostgreSQL schema is already defined in `shared/schema.ts`).
- ETL pipeline takes 5–15 minutes due to rate limits (openFDA: 600ms/req, Cohere: 400ms/req).
- The deployed version at https://www.perplexity.ai/computer/a/pae-onc-prior-authorization-ap-yDFqsBukQpOpCw5QNLrYdA uses a cloud-hosted backend — the download is for self-hosting.
