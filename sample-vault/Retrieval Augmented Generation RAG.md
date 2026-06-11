---
title: Retrieval Augmented Generation
tags:
  - RAG
  - AI
  - LLM
  - search
created_at: 2026-06-01T15:00:00+09:00
updated_at: 2026-06-09T14:00:00+09:00
---

# Retrieval Augmented Generation (RAG)

#RAG combines retrieval systems with generative #AI models to produce grounded, factual responses.

## How RAG Works

1. **Indexing**: Documents are chunked and embedded into a vector store
2. **Retrieval**: User query finds relevant chunks via semantic #search
3. **Generation**: Retrieved context is fed to an #LLM to generate the answer

## Advantages

- Reduces hallucination by grounding responses in real documents
- Knowledge can be updated without retraining the model
- Citations can point to source documents

## Applications

- Enterprise knowledge bases
- Legal document analysis
- Medical literature review
- Academic research assistants

RAG is a key technique for building trustworthy AI systems that work with proprietary or specialized knowledge.
