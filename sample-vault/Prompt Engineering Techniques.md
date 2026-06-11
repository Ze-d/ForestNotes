---
title: Prompt Engineering Techniques
tags:
  - prompt-engineering
  - LLM
  - AI
  - productivity
created_at: 2026-06-08T14:00:00+09:00
updated_at: 2026-06-10T11:00:00+09:00
---

# Prompt Engineering Techniques

#prompt-engineering is the skill of communicating effectively with #LLM systems. Like any skill, it improves with practice and structured techniques.

## Core Techniques

### Be Specific

```
❌ "Write about AI"
✅ "Write a 500-word overview of transformer architectures for a technical audience, covering self-attention, multi-head attention, and positional encoding"
```

### Use Examples (Few-Shot)

Providing 2-3 examples in the prompt dramatically improves output quality for classification, formatting, and style-matching tasks.

### Chain of Thought

```
"Let's solve this step by step:
1. First, identify the key variables
2. Then, analyze the relationships
3. Finally, draw conclusions"
```

### Assign a Role

```
"You are an experienced #AI researcher reviewing a paper submission..."
```

## Why It Matters for #productivity

Good prompt engineering:
- Reduces iteration cycles (fewer retries)
- Produces more reliable outputs
- Saves tokens (and costs)
- Makes LLM outputs predictable enough for production use

The best prompt engineers treat prompting as a programming discipline — systematic, testable, and iteratively improved.
