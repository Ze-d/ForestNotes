---
title: LLM Applications
tags:
  - LLM
  - AI
  - RAG
  - prompt-engineering
created_at: 2026-06-05T10:00:00+09:00
updated_at: 2026-06-11T08:00:00+09:00
---

# LLM Applications

Large Language Models (#LLM) are transforming how we build software. Here are the key application patterns in 2026.

## Core Patterns

### 1. Chat & Conversational AI

The most common #LLM application — multi-turn conversations with context management.

### 2. RAG (Retrieval-Augmented Generation)

#RAG grounds LLM responses in external knowledge bases. Essential for enterprise use cases where hallucinations must be minimized. Uses #AI-powered semantic #search.

### 3. Agents & Tool Use

LLMs that can call APIs, run code, search the web, and make decisions. Anthropic's Claude and OpenAI's GPT both support tool calling.

### 4. Prompt Engineering

#prompt-engineering is the craft of designing effective prompts to guide LLM behavior. Key techniques include:

- Few-shot prompting (examples in context)
- Chain-of-thought (step-by-step reasoning)
- System prompts (behavioral constraints)
- Structured output (JSON mode)

## Choosing the Right Pattern

| Pattern | Best For |
|---------|----------|
| Chat | Customer support, Q&A |
| RAG | Knowledge bases, documentation |
| Agents | Automation, complex workflows |
| Prompt Eng. | Classification, extraction, summarization |
