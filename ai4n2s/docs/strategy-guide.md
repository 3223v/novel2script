# Strategy Implementation Guide

> **LLM 和向量数据库的详细配置指南**: 请参阅 [configuration.md](./configuration.md)

This document details how to implement the two core algorithms. Currently both have working "default" strategies that return skeleton/placeholder output. The real implementations require integrating external services (LLM, vector DB, OCR).

---

## Algorithm 1: Novel → Structured Novel (NormalizedNovel)

### Goal

Convert raw novel files (PDF, DOCX, TXT, pasted text) into structured JSON conforming to the `NormalizedNovel` interface defined in `lib/types.ts`.

### Interface

```typescript
interface NormalizedNovel {
  metadata: { title, author, word_count, analysis_date }
  characters: Array<{ id, name, aliases?, description?, personality?, role? }>
  locations: Array<{ id, name, description? }>
  plot_summary: string
  chapters: Array<{ index, title, summary }>
  scenes: Array<{ chapter_index, heading, raw_text, characters[], locations[] }>
}
```

### Input

```typescript
interface NovelStructuringInput {
  novel: Novel            // DB record with metadata + source files
  rawText?: string        // Extracted text from all source files
  config?: Record<string, unknown>  // Strategy-specific options
}
```

### Existing Strategies

| Strategy | File | Status |
|----------|------|--------|
| `default` | `lib/strategies/novel-normalization/default-strategy.ts` | ✅ Working |
| `regex` | `lib/strategies/novel-normalization/regex-strategy.ts` | ✅ Working |
| `ai-workflow` | `lib/strategies/novel-normalization/ai-strategy.ts` | ⚠️ Skeleton |

### Implementation Plan: AI Workflow Strategy

The `ai-workflow` strategy is the one that needs a real LLM backend. Here's how to complete it:

#### Step 1: Configure LLM Provider

```typescript
// In your app initialization (e.g., instrumentation.ts or a config file):
import { OpenAICompatibleProvider, LLMFactory } from '@/lib/modules/llm';

// Option A: OpenAI
LLMFactory.setProvider(new OpenAICompatibleProvider({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY!,
  defaultModel: 'gpt-4o',
}));

// Option B: Anthropic (via OpenAI-compatible proxy or custom adapter)
// Option C: Local model (Ollama, vLLM, etc.)
LLMFactory.setProvider(new OpenAICompatibleProvider({
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'ollama',
  defaultModel: 'qwen2.5:32b',
}));
```

#### Step 2: The Pipeline Already Works

The pipeline code in `lib/strategies/novel-normalization/ai-strategy.ts` already:
1. Indexes long texts into RAG (`RAGFactory.indexDocument()`)
2. Calls LLM for each analysis step (chapters, characters, locations, scenes, summary)
3. Parses JSON responses

**What's missing**: The `MockLLMProvider` returns placeholder text. Once a real provider is configured, the pipeline produces real output.

#### Step 3: Prompt Engineering

Each analysis step uses a targeted prompt:

**Chapter analysis:**
```
Analyze the following novel excerpt and list all chapters with their titles and a one-sentence summary.
Return JSON: [{"index": 0, "title": "...", "summary": "..."}]
```

**Character extraction:**
```
Analyze the following text and list all characters with their roles.
Return JSON: [{"name": "...", "role": "protagonist|supporting|cameo", "description": "..."}]
```

**Location extraction:**
```
List all locations/settings mentioned in the text.
Return JSON: [{"name": "...", "description": "..."}]
```

#### Step 4: Handling Long Texts

For novels exceeding the LLM context window:
1. The strategy auto-detects texts > 5000 chars
2. It indexes the full text into the RAG module (chunks of 3000 chars with 300 overlap)
3. For each analysis step, it can retrieve relevant chunks via `RAGFactory.query()`
4. Alternatively, process chapter-by-chapter using the already-detected chapter boundaries

#### Step 5: Adding a New Strategy

```typescript
// 1. Implement the interface
import { NovelStructuringStrategy } from '@/lib/pipeline/types';

export class MyCustomStrategy implements NovelStructuringStrategy {
  readonly name = 'my-custom';
  readonly description = 'My custom analysis approach';

  async execute(input, onProgress) {
    // Your logic here
    return normalizedNovel;
  }
}

// 2. Register it in lib/strategies/novel-normalization/index.ts
import { MyCustomStrategy } from './my-custom-strategy';
registerNovelStructuringStrategy(new MyCustomStrategy());

// 3. It appears automatically in the UI strategy selector
```

### Error Handling

- LLM call failures are caught and logged; the strategy returns partial results
- JSON parse failures fall back to treating LLM output as raw text
- The pipeline returns `{ success: false, error: "..." }` on unrecoverable errors

---

## Algorithm 2: NormalizedNovel → Script (ScriptYAML)

### Goal

Convert a `NormalizedNovel` into a professional screenplay in `ScriptYAML` format, with proper scene structure, character dialogue, action descriptions, and transitions.

### Interface

```typescript
interface ScriptYAML {
  script: {
    metadata: { title, author, based_on, version, date, logline?, genre? }
    characters: Array<{ id, name, description? }>
    scenes: Array<{
      id, heading,
      content: Array<
        | { type: 'action', text: string }
        | { type: 'character', name, parenthetical?, dialogue }
        | { type: 'transition', text }
        | { type: 'shot', text }
      >,
      notes?, tags?
    }>
  }
}
```

### Input

```typescript
interface ScriptGenerationInput {
  novel: Novel                    // Original novel metadata
  structuredNovel: NormalizedNovel // Pre-structured analysis
  version: string                 // Target script version
  config?: Record<string, unknown>
}
```

### Existing Strategies

| Strategy | File | Status |
|----------|------|--------|
| `default` | `lib/strategies/script-generation/default-strategy.ts` | ✅ Working |
| `ai-rag` | `lib/strategies/script-generation/ai-rag-strategy.ts` | ⚠️ Skeleton |

### Implementation Plan: AI + RAG Strategy

This strategy combines Retrieval-Augmented Generation with LLM-driven scene writing.

#### Step 1: Ensure Prerequisites

1. **LLM Provider configured** (see Algorithm 1, Step 1)
2. **Structured novel data exists** — run Algorithm 1 first, or the pipeline auto-runs it

#### Step 2: How the AI+RAG Pipeline Works

```
1. Build RAG indices:
   ├── {novelId}-plot       ← plot summary
   ├── {novelId}-scene-{i}  ← each scene's raw text
   └── {novelId}-characters ← character profiles

2. For EACH scene:
   a. Retrieve relevant context via RAGFactory.query(sceneHeading)
   b. Build LLM prompt with:
      - Scene heading + raw text
      - Retrieved context (relevant passages)
      - Character list with descriptions
      - Location list
   c. Call LLM to convert narrative → screenplay format
   d. Parse JSON response into SceneContent[]

3. Assemble all scenes into ScriptYAML
4. Save via ScriptService.create()
```

#### Step 3: Scene Generation Prompt Template

```
You are a professional screenwriter. Convert the following novel scene into 
standard screenplay format.

[NOVEL SCENE]
Heading: {heading}
Original Text: {rawText}

[RELEVANT CONTEXT]
{retrievedContext}

[CHARACTERS]
{characterList}

[LOCATIONS]
{locationList}

[INSTRUCTIONS]
1. Write action descriptions in present tense, third person
2. Convert narration into dialogue where appropriate
3. Add character emotions via parentheticals
4. Include transitions between major beats
5. Maintain the tone and style of the original

Return JSON array:
[
  {"type": "action", "text": "..."},
  {"type": "character", "name": "...", "parenthetical": "(emotion)", "dialogue": "..."},
  {"type": "transition", "text": "CUT TO:"}
]
```

#### Step 4: Iterative Refinement Pattern

For better quality, use a two-pass approach:

```
Pass 1: Generate draft scenes (high temperature 0.8)
Pass 2: Refine each scene (low temperature 0.3)
  - Check character voice consistency
  - Verify plot continuity
  - Polish dialogue
```

This can be implemented as a new strategy variant (`ai-rag-refined`).

#### Step 5: Handling Edge Cases

**Very long scenes**: Split into sub-scenes, process separately, merge.
**Missing context**: If RAG returns low relevance scores, widen the search or use the full chapter text.
**JSON parse errors**: Retry with stricter formatting instructions, or fall back to treating output as action-only.

### RAG Module Enhancement Options

The current `InMemoryRAGProvider` uses simple keyword matching. For production:

1. **Replace with vector DB**:
```typescript
import { RAGFactory } from '@/lib/modules/rag';

class ChromaRAGProvider implements RAGProvider {
  // Use Chroma, Pinecone, Weaviate, or pgvector
  // Implement: indexDocument, query, removeSource, stats
}

RAGFactory.setProvider(new ChromaRAGProvider(/* config */));
```

2. **Use embeddings for better retrieval**:
   - Generate embeddings via the configured LLM or a dedicated embedding model
   - Store in vector DB
   - Semantic search instead of keyword matching

3. **Hybrid search**: Combine keyword + semantic for better recall

### Extending the System

#### Adding a New Generation Strategy

```typescript
// 1. Implement
import { ScriptGenerationStrategy } from '@/lib/pipeline/types';

export class FountainStrategy implements ScriptGenerationStrategy {
  readonly name = 'fountain';
  readonly description = 'Generate screenplay in Fountain format then convert';

  async execute(input, onProgress) {
    // Generate Fountain markup → parse → ScriptYAML
    return scriptYaml;
  }
}

// 2. Register in lib/strategies/script-generation/index.ts
registerScriptGenerationStrategy(new FountainStrategy());

// 3. Available immediately in UI
```

#### Adding a New Module Provider

All four modules (LLM, RAG, FileProcessor, OCR) use the same pattern:

```typescript
// 1. Implement the interface
// 2. Call Factory.setProvider(new MyProvider())
// 3. All existing code uses the new provider automatically
```

## Integration Testing

After configuring real providers:

```bash
# 1. Structure a novel
curl -X POST http://localhost:3000/api/pipeline/novels/{novelId}/structure \
  -H "Content-Type: application/json" \
  -d '{"strategy":"ai-workflow"}'

# 2. Check the result
cat data/storage/{novelId}/normalized.json

# 3. Generate a script
curl -X POST http://localhost:3000/api/pipeline/scripts/{novelId}/generate \
  -H "Content-Type: application/json" \
  -d '{"strategy":"ai-rag","version":"v1.0"}'

# 4. Check the generated script
ls data/storage/{novelId}/scripts/
```

## Performance Considerations

| Factor | Recommendation |
|--------|---------------|
| LLM calls per novel | ~5-10 for structuring, N for generation (N = scenes) |
| Token usage | ~10K input + ~2K output per scene |
| Processing time | ~2-5 min for a 100K-word novel with gpt-4o |
| Cost optimization | Use gpt-4o-mini for chapter summaries, gpt-4o for dialogue |

## Roadmap

1. **Phase 1** (current): Default strategies with placeholder output → system is testable
2. **Phase 2**: Configure LLM provider → real output from ai-workflow and ai-rag
3. **Phase 3**: Add RAG vector store → better context retrieval quality
4. **Phase 4**: Multi-pass refinement → professional-quality screenplay output
5. **Phase 5**: Human-in-the-loop editing → UI for reviewing and polishing AI output
