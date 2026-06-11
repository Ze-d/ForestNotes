---
title: Transformer Architecture
tags:
  - Transformer
  - AI
  - deep-learning
  - LLM
created_at: 2026-05-20T11:00:00+09:00
updated_at: 2026-06-11T09:00:00+09:00
---

# Transformer Architecture

The #Transformer architecture, introduced in "Attention is All You Need" (2017), is the foundation of modern #AI systems.

## Key Components

### Self-Attention

The core innovation — each token attends to all other tokens in the sequence, capturing long-range dependencies.

### Multi-Head Attention

Multiple attention heads run in parallel, allowing the model to focus on different aspects of the input simultaneously.

### Positional Encoding

Since transformers process tokens in parallel (not sequentially), positional encodings inject order information.

## Impact

Transformers power:

- #LLM systems (GPT, Claude, Gemini)
- Machine translation
- Code generation
- Protein folding (AlphaFold)

The architecture's scalability has enabled the era of large language models.
