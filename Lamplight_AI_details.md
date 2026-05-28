Lamplight — Architecture Brief
Here's the full breakdown of Lamplight as a buildable system. I'll walk it top-down: purpose → behavior → architecture → data → orchestration → safety → cost → phasing → open decisions. Everything below is grounded in the existing LivePsalms stack (React 19 + Vite + Supabase + TipTap + the existing graph engine and verse parser) so you can see exactly where each piece plugs in.

1. North Star & Non-Goals
North Star
Lamplight is the layer that listens to a believer's notepad and gives them back the next step in their walk with God — in Scripture, in their own voice, at the right moment.

It is a companion, not a coach. A mirror, not an oracle. A librarian of the user's own life with Scripture, not a chatbot.

What it IS
A scripture-grounded, citation-first AI built on the user's own private corpus
A devotional rhythm assistant (daily / weekly / seasonal)
A connection engine that sees patterns the user is too close to see
A gentle layer on top of the existing editor — never a replacement
What it is NOT
Not a general-purpose chatbot. No "ask anything" surface.
Not a pastor or counselor. It will not interpret unclear Scripture beyond plain reading, will not speak prophetically, will not give pastoral or psychological advice.
Not an autonomous writer. It never edits the user's notes without explicit action.
Not a doctrine machine. It reflects what the user has written and what Scripture says — it does not adjudicate denominational questions.
2. The Six Functions — fully specified
Each function is a discrete unit with a defined trigger, input set, output artifact, model class, and storage location.

Function 1 — Today's Lamp (daily devotion)
Trigger	First open of /notepad on a new local-day, OR explicit user request from the Lamplight tab
Inputs	Last 30 days of notes (text + types + tags + verse refs); user's tier; current season metadata; today's date; user voice preference (Lord/Abba/Jesus); the running thread vector (see §6)
Output artifact	A daily_devotion record: opening (40-80 words), scripture passage (full text + reference), reflection (180-260 words), one open prompt, 3-5 citation references to user's own notes
Model class	Mid-tier (Claude Sonnet, or equivalent) — quality matters more than latency
Storage	lamplight_artifacts table, type=daily_devotion, idempotent on (user_id, local_date)
Latency budget	8-15s acceptable (shown with a loading state)
Failure mode	Falls back to a curated "Stillwater" library of pre-written devotions tagged by theme
Function 2 — Weekly Insight ("What God seems to be saying")
Trigger	Cron — Sunday 6am local time per user. Surfaces in the Lamplight tab and as an opt-in email.
Inputs	Last 7-21 days of notes; graph deltas (new edges since last week); top recurring verses + tags; previous weekly insights (to avoid repetition)
Output artifact	A weekly_insight record: a 200-300 word synthesis, named theme, 3-5 anchor verses (some from user's notes, some proposed-new), 2-3 reflection questions
Model class	Mid-tier
Storage	lamplight_artifacts, type=weekly_insight, one per (user_id, ISO-week)
Function 3 — Live Verse Suggestions (in-editor)
Trigger	Debounced editor idle (3-5s after typing stops) on notes ≥80 words, no suggestion shown in last 10 minutes, user not in Quiet Mode
Inputs	Current note text (last 500 words); current note's tags + type; user's existing verse references; recent dismissed suggestions (negative signal)
Output artifact	A single suggestion: {verse_ref, verse_text, why (≤20 words), confidence} rendered as a soft chip near the cursor
Model class	Fast (Claude Haiku or equivalent small/cheap model) — must return in <2s
Storage	Suggestion logged to lamplight_suggestions_log only when shown; outcome (inserted/dismissed/ignored) recorded
Guardrail	Hard ceiling of 3 suggestions per note per session. Off entirely during the first 60s of typing.
Function 4 — Connection Cards (on note open)
Trigger	User opens a note that has >100 words and the user has ≥10 notes total
Inputs	The current note's embedding; top-K semantic neighbors from lamplight_embeddings; shared verse refs; shared tags
Output artifact	Up to 3 connection cards, each: {related_note_id, related_note_title, why (≤24 words), shared_signals[]}
Model class	Cards are generated lazily by Fast tier when the user expands a connection. The neighbor list itself is pure pgvector / Postgres — no LLM call.
Storage	Cached in lamplight_connections keyed on (note_id, content_hash) — invalidated when either note changes
Function 5 — Reflections Timeline (seasonal recap)
Trigger	Three pathways: (a) automatic at quarter boundaries, (b) on tier promotion, (c) on user request from profile
Inputs	All notes in the window (default 90 days); tier history; verse frequency map; theme cluster summaries
Output artifact	A reflection_recap record: title, hero line, 3-5 chapter sections (each with theme, scripture, 2-3 source-note citations, one user-quote pulled verbatim), closing prayer
Model class	High-tier (Claude Sonnet, max quality). This is the showcase artifact.
Latency budget	Up to 60s, generated in the background, push-notified when ready
Storage	lamplight_artifacts, type=reflection_recap, with a permalink shown on the profile timeline
Function 6 — Tier-Aware Encouragement
Trigger	The existing LevelUpModal fires (already wired to highestNoteCount crossings)
Inputs	Tier scripture + reference (already in code); 5-10 notes from the period; one verse the user has returned to most
Output artifact	A 4-6 sentence personal note ending in the tier scripture, signed off with a benediction. Stored as lamplight_artifacts, type=tier_celebration.
Model class	Mid-tier
3. System Architecture — the five layers
┌────────────────────────────────────────────────────────────────┐
│                     SURFACE LAYER (React)                       │
│  Lamplight Tab · Morning Card · Inline Suggestion ·              │
│  Connection Cards · Reflections Timeline · Quiet Mode            │
└─────────────────────────────┬──────────────────────────────────┘
                              │ REST / RPC / Realtime
┌─────────────────────────────▼──────────────────────────────────┐
│                  ORCHESTRATION LAYER (Edge)                     │
│  Supabase Edge Functions · pg_cron jobs · job queue table       │
│  Trigger router (idempotency keys, rate limits, quiet hours)    │
└─────────────────────────────┬──────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                    REASONING LAYER                              │
│  Retrieval (pgvector semantic search) → Context Builder →       │
│  Prompt Templates → LLM (Claude) → Citation Validator →         │
│  Doctrinal Guardrail → Artifact Writer                          │
└─────────────────────────────┬──────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                     SIGNAL LAYER                                │
│  Note→Embedding (on save, debounced) · Verse ref index ·        │
│  Tag graph · Tier telemetry · Bible Corpus (chunked + embed.)   │
└─────────────────────────────┬──────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                  STORAGE LAYER (Supabase Postgres)              │
│  notes · folders · lamplight_embeddings (pgvector) ·            │
│  lamplight_artifacts · lamplight_settings ·                     │
│  lamplight_jobs · lamplight_suggestions_log · bible_passages    │
└────────────────────────────────────────────────────────────────┘
4. Data Model — proposed Postgres tables
These are additive; no changes to existing notes / folders. All new tables enable RLS with the same auth.uid() = user_id pattern already in place.

lamplight_settings
user_id              uuid PK references profiles(id)
enabled              boolean default false       -- opt-in master switch
quiet_mode           boolean default false       -- pauses suggestions only
voice_preference     text   default 'Lord'       -- Lord | Father | Abba | Jesus
tradition_hint       text   default 'unspecified'-- evangelical | catholic | orthodox | unspecified
inline_suggestions   boolean default true
weekly_email         boolean default false
created_at, updated_at
lamplight_embeddings
id              uuid PK
user_id         uuid not null
source_type     text   ('note' | 'bible_passage')
source_id       text   (note.id or passage.id)
content_hash    text   (for invalidation)
embedding       vector(1536)               -- pgvector
metadata        jsonb  (tags, verse_refs, type, length, etc.)
created_at      timestamptz
Index: ivfflat (embedding vector_cosine_ops). Per-user filter is hard-required in every query.

lamplight_artifacts
id              uuid PK
user_id         uuid not null
type            text   ('daily_devotion' | 'weekly_insight' | 'reflection_recap'
                       | 'tier_celebration')
period_key      text   (e.g. '2026-05-25', '2026-W21', 'Q2-2026', 'tier:flame')
title           text
body            jsonb  (structured content — sections, scriptures, citations)
source_note_ids uuid[] (provenance — which notes contributed)
source_verses   text[]
model_used      text
prompt_version  text
created_at      timestamptz
saved_to_notes  boolean default false      -- user one-tapped to save as a Devotion note
Unique constraint on (user_id, type, period_key) — guarantees idempotency.

lamplight_suggestions_log
id           uuid PK
user_id      uuid
note_id      uuid
verse_ref    text
why          text
shown_at     timestamptz
outcome      text  ('inserted' | 'dismissed' | 'ignored')
Used both for analytics and as a negative-signal feed back into prompts (don't re-suggest dismissed verses for the same note).

lamplight_connections
note_id        uuid
related_note_id uuid
score          float
why            text
content_hash   text
PRIMARY KEY (note_id, related_note_id)
Cache for connection cards. Invalidated by trigger when a note's content changes.

lamplight_jobs
id           uuid PK
user_id      uuid
kind         text   ('daily' | 'weekly' | 'reflection' | 'embedding_refresh')
status       text   ('queued' | 'running' | 'done' | 'failed')
payload      jsonb
attempts     int default 0
scheduled_at timestamptz
started_at   timestamptz
finished_at  timestamptz
error        text
Run by a Supabase Edge Function poller (or via pg_cron ticks).

bible_passages
id           uuid PK            -- 'gen.1.1' kind of key
book         text
chapter      int
verse_start  int
verse_end    int
translation  text   ('ESV' | 'NIV' | 'KJV' | 'NLT' | ...)
text         text
pericope_id  text   (passages grouped semantically, e.g. 'Psalm 23' as one unit)
Embedded into lamplight_embeddings with source_type='bible_passage'. Public — no RLS, read-only. Translation licensing needs to be resolved (see Open Questions §14).

5. The Signal Layer
Lamplight is only as good as its inputs. The signal layer is the boring, important part.

5.1 Note embedding pipeline
On note save (debounced 5s), if content changed materially (>20% character diff or new verse refs), enqueue a lamplight_jobs row of kind embedding_refresh.
Worker pulls plaintext via the existing extractTextFromNote util.
Sends to embeddings endpoint (Voyage AI voyage-3 or OpenAI text-embedding-3-large). Stores in lamplight_embeddings.
This runs even when Lamplight is disabled — but only if the user has opted in. (Opt-in master switch gates everything, no exceptions.)
5.2 Verse-reference index
Already exists via reference-parser.ts. Lamplight reads this directly — no new code path. Adds a per-user "verse frequency map" computed in Postgres on the fly (cheap).

5.3 Tag and graph signals
Reuses useReferenceGraph and the existing tag aggregations. Lamplight queries these at retrieval time — no separate store.

5.4 Bible corpus
One-time ingest: parse a permissively-licensed translation (BSB, WEB, KJV) into bible_passages at verse + pericope granularity.
Embed every verse and every pericope.
For premium translations (ESV / NIV / NLT), use their API at read-time only — never store the text. Show "ESV via api.esv.org" attribution. (Licensing decision in §14.)
5.5 Tier & rhythm telemetry
Already tracked in profile.highestNoteCount. Lamplight adds:

last_devotional_at (when they last opened the app for a Devotion)
streak_days (consecutive days with any note activity)
6. The Reasoning Layer
This is the core of Lamplight. It's a deterministic, citation-first pipeline — not an open chat loop.

6.1 Retrieval
Every generation begins with a retrieval step. Lamplight never calls the LLM without first assembling a structured context bundle.

For Today's Lamp:

Pull last 30 days of user notes.
Cluster by tag + type. Pick the dominant 1-2 themes.
Pull top 10 user notes by recency + thematic match.
Pull top 10 Bible passages by semantic similarity to the dominant theme, excluding passages already referenced in those 10 notes (to keep one slot fresh).
Pull top 5 passages already referenced in those notes (to ground in their own journey).
Build a Context Bundle JSON.
For Live Verse Suggestion:

Current note last-500-words embedding → top-3 Bible passages.
Filter out: already-referenced verses in this note, dismissed verses, the same verse suggested in the last 30 days.
For Connection Card:

Pure pgvector — top-K cosine neighbors of the current note, threshold 0.78, K=5.
LLM only called to write the "why" string when the user expands a card.
6.2 Prompt construction
Prompts are versioned (prompt_version column on artifacts). Each function has its own template. Universal sections:

[SYSTEM]
You are Lamplight, a scripture-grounded reflective companion inside a Christian
journaling app. You speak warmly, briefly, and always cite Scripture for any
claim. You never speak prophetically over the user. You never interpret unclear
Scripture beyond a plain reading. You never replace pastoral counsel. You
mirror the user's voice for divine names (use "{{voice_preference}}").
[USER CONTEXT]
Tier: {{tier_name}} ({{tier_scripture}})
Tradition hint: {{tradition_hint}}
Recent notes ({{count}}): {{note_excerpts}}
Most-referenced verses: {{top_verses}}
Active themes: {{themes}}
Today's date: {{local_date}}
[TASK]
{{function_specific_task}}
[OUTPUT SCHEMA]
{{json_schema}}
[RULES]
- Every reflection MUST cite at least one source: a Scripture reference OR a
  note title from the [USER CONTEXT].
- Quote no more than 25 words verbatim from any user note.
- If you cannot ground a sentence in cited material, do not write it.
6.3 Output schema
Every artifact is generated as structured JSON (Claude's structured output mode or a JSON schema validator). No free-form prose at the API boundary. The schema enforces a citations[] array on every section, and the citation validator (next step) rejects the response if any section lacks one.

6.4 Citation validator
A deterministic post-processor:

Walks the JSON output, asserts every paragraph has at least one citation.
Asserts every cited verse exists in bible_passages or in the user's notes table.
If validation fails, retry once with a corrective system prompt. If second attempt fails, abort and log to lamplight_jobs.error.
6.5 Doctrinal guardrail
A second-pass classifier (small/fast model or a regex+keyword filter):

Flags: prophetic-style language ("God is telling you…"), denominational claims, mental-health advice, financial advice, future predictions.
On flag: regenerate with a stricter system prompt that explicitly forbids the flagged pattern.
6.6 Model assignment
Function	Model	Why
Today's Lamp	Claude Sonnet 4.7	Quality > latency; user opens once a day
Weekly Insight	Claude Sonnet 4.7	Synthesis across many notes; reasoning matters
Inline Suggestion	Claude Haiku 4	Must be <2s; single-verse retrieval is simple
Connection "why"	Claude Haiku 4	One-line generation, lazy on expand
Reflections Recap	Claude Sonnet 4.7 (long-context)	Showcase artifact, worth the cost
Tier Celebration	Claude Sonnet 4.7	Rare event, emotionally important
Embeddings: Voyage AI voyage-3-large (best price/quality for English devotional text) or OpenAI text-embedding-3-large. Pick one and stick — they are not compatible.

7. The Surface Layer (UI)
7.1 Lamplight tab
A fourth tab next to Content / Backlinks / Info / **Lamplight**. Its contents depend on context:

No active note + first open today → Today's Lamp card up top, Weekly Insight below, Reflections shelf at bottom
Active note open → Connection cards specific to this note + a "Reflect on this further" button that drafts a follow-up prompt
7.2 Morning card
A dismissible card pinned above the toolbar on the first open of a new local day. Tap to expand into the Lamplight tab.

7.3 Inline suggestion chip
Same anchoring system as the existing [[ popup and verse tooltip. Renders as a soft chip in the lower-right of the editor viewport with the verse ref and a one-line "why." Two buttons: Insert / Dismiss. Escape to ignore.

7.4 Connection cards
Appear in the Lamplight tab when the user has an active note. Each card is a click-through to the related note. Cards are sourced from lamplight_connections cache; if cold, render skeletons and warm in the background.

7.5 Reflections timeline
Lives on /profile under a new "Reflections" section. Renders all reflection_recap artifacts in a vertical timeline with the existing tier badges woven in. Each entry is shareable as an image (existing brand visual treatment — Cormorant Garamond, warm palette).

7.6 Quiet Mode
A toggle in lamplight_settings. When on:

Inline suggestions paused
Morning card hidden
Daily generation still runs (so when they come back, today's lamp is waiting)
Weekly + Reflections still run
7.7 Settings panel
A new section in the profile: Lamplight master toggle, Quiet Mode, voice preference (Lord/Father/Abba/Jesus), tradition hint (optional), inline suggestions on/off, weekly email on/off.

8. Orchestration & Triggers
8.1 Scheduled (pg_cron + Edge Function)
tick_daily — runs every 30 min globally. For each user where (a) Lamplight enabled, (b) local time is between 5am-9am, (c) no daily_devotion exists for today: enqueue a daily job.
tick_weekly — runs hourly. For each user where local time is Sunday 5am-7am and no weekly_insight exists for the current ISO-week: enqueue a weekly job.
tick_quarterly — runs daily. Identifies users at quarter boundaries; enqueues reflection jobs.
8.2 Event-driven
On note save → debounced embedding_refresh job.
On tier promotion → fires tier_celebration generation inline (acceptable latency: handled by the existing LevelUpModal which already opens with a loader).
On note open → fetches cached connection cards instantly; only triggers fresh generation if cache miss.
8.3 User-initiated
"Generate today's lamp now" button — bypasses the daily window.
"Generate a recap" button on the profile — bypasses the quarter schedule (rate-limited to 1 per 7 days).
8.4 Job queue mechanics
Worker is a Supabase Edge Function invoked by a Vercel/Cloudflare cron OR by Supabase's own scheduler.
Polls lamplight_jobs where status='queued' AND scheduled_at <= now(), limit 5.
Locks with SELECT … FOR UPDATE SKIP LOCKED.
Retries with exponential backoff up to 3 attempts.
9. Safety, Doctrine, Privacy
9.1 Doctrinal guardrails (encoded in system prompt + post-validator)
No prophetic language. Banned phrases: "God is telling you," "God says to you," "the Lord is giving you a word that…" — replaced with "Scripture suggests…" / "this verse may speak to…"
No interpretation beyond plain reading for contested passages (Revelation timelines, end-times, predestination/election, gender-role passages, sacraments). When these come up, Lamplight defers: "This is a passage many believers wrestle with — your pastor or study group is the right place to talk through it."
No counseling. Mental-health, marital, financial, medical → redirect to a professional / pastor.
No condemnation. Lamplight never moralizes the user's writing. If a note expresses doubt, sin-struggle, or anger at God, it responds with Scripture about how God meets that — never with rebuke.
9.2 Privacy
Master opt-in. Default OFF. Toggling ON triggers a clear consent screen explaining what data is processed.
No training on user data — ever. Hard contractual clause with the LLM vendor (Anthropic's API zero-retention option, or OpenAI's "no train" header).
Per-request data minimization. Only the note excerpts needed for the task — never the whole vault.
Right to forget. A "Forget my Lamplight history" button deletes all lamplight_* rows. Re-enabling rebuilds from current notes only.
Local-only mode (V2). Anonymous LocalStorage users get a stripped-down Lamplight running against an on-device small model (e.g., a quantized Phi-3 via WebLLM) — Today's Lamp only, no embeddings synced.
9.3 Trust UX
Every artifact shows its sources inline ("Drawing from: 3 of your notes, Psalm 27, Lamentations 3").
A "How was this written?" link on every artifact opens a side panel showing the citations and the model used.
A "This wasn't helpful" button reports the artifact and excludes the underlying signal from future runs for that user.
10. Cost & Performance Model
10.1 Per-user daily cost estimate (rough)
Item	Tokens	Model	Cost/run	Frequency	Monthly cost/user
Today's Lamp	~6k in / 1k out	Sonnet 4.7	~$0.04	daily	$1.20
Weekly Insight	~10k in / 1.5k out	Sonnet 4.7	~$0.06	weekly	$0.26
Inline Suggestions (avg)	~2k in / 100 out	Haiku 4	~$0.002	~3/day	$0.18
Connection "why" (avg)	~1k in / 80 out	Haiku 4	~$0.001	~5/day	$0.15
Reflection Recap	~30k in / 3k out	Sonnet 4.7	~$0.18	quarterly	$0.06
Embedding refresh	small	Voyage	~$0.0002	~3/day	$0.02
Total per active user					~$1.87 / month
This is the headline number to anchor pricing decisions on. A free tier could cap at "Today's Lamp 3 days/week + Weekly Insight"; paid tier unlocks the full set + Reflections.

10.2 Latency budgets
Inline suggestion: <2s p95 (else don't show)
Connection card "why": <3s on expand
Today's Lamp on-demand: <15s with progressive UI ("Reading your last 30 days…" → "Drawing from Psalm 23…" → final render)
Reflection Recap: background, push notification when ready
10.3 Caching
Daily devotion: cached by (user_id, local_date) — never regenerate same day
Connection cards: cached by note content hash
Inline suggestions: cached by note content hash for 10 minutes (so re-opening the editor doesn't re-prompt)
11. Tech Stack Recommendation
Concern	Choice	Rationale
LLM provider	Anthropic Claude (Sonnet 4.7 + Haiku 4)	Structured outputs are first-class; tone alignment is excellent for devotional writing; zero-retention option
Embeddings	Voyage AI voyage-3-large	Best $/quality for English long-form; Anthropic-recommended
Vector store	pgvector inside Supabase	No new infra; queries inside the same RLS scope as notes
Job queue	lamplight_jobs table + Edge Function poller	Stays inside Supabase; visible to ops; no Redis/SQS needed at MVP
Scheduler	pg_cron (or Supabase scheduled functions)	Native to Postgres; one less moving part
Bible corpus storage	bible_passages table (BSB/WEB/KJV ingested) + API.Bible / ESV API for premium reads	Permissively-licensed text lives in-DB for embedding; premium text fetched on-demand and attributed
Streaming inline suggestions	Anthropic streaming API → Supabase Edge → SSE to client	Sub-2s perceived latency
Observability	Existing toast/sonner + a lamplight_events log	Per-user audit trail of every generation
12. Phasing — MVP → V1 → V2
MVP (4-6 weeks, one engineer)
lamplight_settings, lamplight_artifacts, lamplight_embeddings, lamplight_jobs tables + RLS
Bible corpus ingest (BSB or WEB), embedded
Note embedding pipeline (on save → job)
Today's Lamp (generate on demand from Lamplight tab; no scheduled cron yet)
Connection Cards (pgvector + Haiku for the "why")
Lamplight tab in the editor pane (the fourth tab)
Settings panel: master toggle + voice preference
Citation validator + basic doctrinal guardrail
Consent screen + delete-my-data button
MVP success criteria: A signed-in user with ≥15 notes can open Lamplight, get a personalized devotion in <15s with verified citations, and find at least 2 useful connection cards.

V1 (next 4-6 weeks)
Inline verse suggestions (Haiku streaming)
Weekly Insight (scheduled job, in-app + email)
Reflections Recap (manual trigger first; quarterly schedule once stable)
Quiet Mode + inline-suggestion toggle
Suggestion log + negative-signal feedback into prompts
Premium translation support (ESV API integration with attribution)
V2 (longer arc)
Tier-aware celebration copy on level-up
Local-only Lamplight for anonymous users (WebLLM, on-device, Today's Lamp only)
Multi-translation comparison in tooltips
Voice journaling — speak a devotion, Whisper transcribes, Lamplight summarizes
Group / shared Reflections (couples / small groups) — opt-in shared corpus
Lectionary mode — align suggestions with the church calendar for liturgical-tradition users
13. Where this hooks into the existing codebase
Lamplight concern	Existing module to extend
Note text extraction	src/notepad/utils/tiptap-text.ts (already does it)
Verse parsing	src/notepad/graph/reference-parser.ts (already does it)
Storage adapter pattern	src/notepad/storage/adapter.ts — add a LamplightAdapter peer
Notepad provider	src/notepad/context/NotepadProvider.tsx — wrap with a LamplightProvider
Editor surface	src/notepad/components/Editor.tsx — add the suggestion chip portal next to the existing verse tooltip portal
Tab bar	src/components/sections/Notepad.tsx:122-138 — add a fourth tab
Profile timeline	src/auth/ProfilePage.tsx — add Reflections section
Migrations	supabase/migrations/007_lamplight_core.sql, 008_lamplight_artifacts.sql, 009_bible_passages.sql
Nothing in this design requires changing the existing notes or folders tables.


Lamplight — Locked Spec
All eight decisions accepted and locked. Here's what that converts into.

Decisions — confirmed
#	Decision	Locked
1	Bible corpus	BSB embedded in-DB for MVP; ESV via API.Bible at V1 with attribution
2	LLM vendor	Claude (Sonnet 4.7 + Haiku 4), wrapped behind a thin LLMAdapter interface for future swap
3	Pricing	Full suite free for all signed-in users during the launch promotional window; entitlement system built now, paywall toggle defaults OFF
4	Anonymous users	No Lamplight. Sign-in / sign-up wall on every Lamplight surface.
5	Tradition hint	Asked once on the consent screen, optional, defaults to unspecified
6	Doctrinal review board	Yes — 1-2 reviewers, sign-off required before public launch
7	Email delivery	Deferred. Weekly Insight is in-app only at V1.
8	Streaks vs. growth	No streaks. Ever. Growth-celebration only, anchored to Tiers (which are already monotonic — highestNoteCount never regresses, perfect for this stance)
What changes in the architecture
A. Entitlements layer (new — required by #3)
A new table replaces the simpler lamplight_settings.enabled toggle:

lamplight_entitlements
  user_id           uuid PK
  tier              text  ('plus' | 'lite' | 'none')   default 'none'
  source            text  ('promo' | 'subscription' | 'grant')
  granted_at        timestamptz
  expires_at        timestamptz  null
Plus a single global config row in app_config:

key='lamplight_promo_active'   value=true
key='lamplight_promo_ends_at'  value=null    -- set when you're ready to flip
Gating logic at every Lamplight surface:

if promo_active OR (user.entitlement.tier = 'plus' AND not expired):
    grant full suite
else if user.entitlement.tier = 'lite':
    Today's Lamp 3×/week + Weekly Insight only
else:
    Lamplight off — show paywall card
Build the gating now, ship with promo_active = true. Flipping the paywall later is a one-row UPDATE — no engineering work, no migration, no app deploy.

B. Sign-in wall (refined by #4)
Lamplight tab on the notepad is visible to anonymous users, but renders as a soft gate — a single card with:

A blurred mockup of a real devotion behind it
One line: "Today's Lamp is waiting for you."
Sign In / Sign Up button → /login
A tiny "Why sign in?" link explaining the privacy commitment
No nag, no popup — single quiet card. Anonymous users keep the notepad fully functional; the gate is only on Lamplight surfaces.

C. Onboarding consent screen (locked by #5)
A new screen between /login (or sign-up) and /welcome for any user who hasn't yet decided on Lamplight:

Welcome the lamp.
LivePsalms can offer you a quiet companion called Lamplight — a daily
devotion drawn from your own journey, scripture suggestions while you
write, and seasonal reflections that show you what God has been weaving.
It reads only your notes. It cites every verse. It never trains on your
data. You can turn it off anytime.
[ Turn on Lamplight ]   [ Maybe later ]
Optional — helps Lamplight speak in your tradition:
( ) Evangelical   ( ) Catholic   ( ) Orthodox   ( ) Skip
How would you like Lamplight to refer to God?
( ) Lord   ( ) Father   ( ) Abba   ( ) Jesus
The tradition + voice questions are optional and skippable — defaults to unspecified / Lord. Stored to lamplight_settings on continue.

D. Doctrinal review board — concrete process (#6)
A formal, named gate before public launch:

Reviewers (TBD — to be identified):

One pastor with seminary training
One theologically-grounded layperson familiar with the audience
Their deliverable: sign-off on three artifacts before launch:

The system prompt (master template + all six function-specific templates)
The Contested Passages List — verses the system will refuse to interpret beyond plain reading
The Banned-Phrases List — language patterns Lamplight will never produce (prophetic claims, condemnation, denominational adjudication, future predictions)
Plus: a sample of 30 real-feel generated artifacts (10 daily devotions, 10 weekly insights, 10 reflection recaps) generated against synthetic personas. They mark green/yellow/red. Red items get the underlying prompt fixed and regenerated until clean.

A new dev artifact: docs/lamplight/doctrinal-review.md — versioned, signed by both reviewers, updated whenever prompts change materially.

E. Growth-only language (#8)
Updates the copy library — Lamplight will never produce strings containing the patterns:

"X day streak"
"Don't break your streak"
"You missed yesterday"
"Get back on track"
Replaced with growth language drawn from the existing Tier scriptures:

"You crossed into Ember this week — fan into flame the gift of God."
"This is the third time you've written about rest. The thread is real."
"Welcome back. Your work is waiting."
This is enforced as a string filter on every artifact output (alongside the doctrinal guardrail).

New follow-ups these decisions surface
Small, won't slow MVP — flagging so they don't get forgotten:

Promo end date / criteria. "Initial few months" — is it a fixed date, a user-count milestone, or a vibe? I recommend a fixed date in app_config so it's visible and changeable, even if you change it later. Default proposal: 4 months after public launch. Decide when you have a launch date.
Grandfathering policy. When the paywall flips: do existing free-tier users get a permanent legacy plan, a 60-day grace, or a hard cutover? Recommendation: 60-day grace + 50% lifetime discount for promo-period users — generous enough to convert, fair to early loyalists.
Sign-up motion. The notepad currently lets anonymous users in fully. Lamplight is the first major sign-in incentive — worth thinking about whether the home page surfaces this. (Possible future tweak to the Two-Path Interlude copy.)
Reviewers' names. Who are the two reviewers? Worth identifying within the next two weeks so they can be in the loop while prompts are being written, not just at the end.
Locked MVP scope (4-6 weeks)
In:

lamplight_settings, lamplight_artifacts, lamplight_embeddings, lamplight_jobs, lamplight_entitlements, bible_passages, app_config tables + RLS
BSB ingest into bible_passages + embeddings
Note-save → embedding job pipeline
Today's Lamp — on-demand generation from Lamplight tab
Connection Cards — pgvector + Haiku "why"
Consent screen with optional tradition + voice questions
Anonymous sign-in gate on Lamplight surfaces
Lamplight tab in the editor (the fourth tab)
Settings panel — master toggle, Quiet Mode, voice preference
LLM adapter interface (Claude underneath)
Citation validator + doctrinal guardrail + growth-only filter
Entitlement gate everywhere; promo_active=true at launch
docs/lamplight/doctrinal-review.md filled in and signed before public flip
Out of MVP (V1):

Inline suggestions
Weekly Insight
Reflections Recap
ESV API
Email delivery (deferred per #7)
Tier-aware celebrations
Anonymous on-device mode