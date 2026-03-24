# Changelog

All notable changes to Jeeves will be documented in this file.

## [0.2.0] - 2026-03-24

### Added
- **10 new FAL image models** for `/image`:
  - FLUX.2 Max, FLUX Kontext Pro
  - Nano Banana 2, GPT Image 1.5
  - Recraft V4 Pro, Seedream V4, Seedream 5 Lite
  - Qwen Image, ImagineArt 1.5, Bria FIBO
- **`openrouter/free` auto-router**: Automatically routes `/ask` to the best available free model, avoiding rate limits on any single provider

### Changed
- Default `/ask` model switched from `meta-llama/llama-3.3-70b-instruct:free` to `openrouter/free` (auto-routes to best available)
- Updated `/ask` model choices with current free models (Hermes 3 405B, Nemotron Super 120B, GPT-OSS 120B, Qwen3 Coder 480B)
- Updated FAL credit calculations from current fal.ai pricing
- FAL integration now handles `aspect_ratio` input format for Nano Banana models

### Fixed
- **Free model credit bug**: `openrouter/free` router resolving to models not in the pricing table no longer incorrectly deducts credits
- Free models now always show `FREE` and never charge credits, regardless of which underlying model the router selects

---

## [0.1.0]

### Added
- **AI Credit System**: Users now have credit balances for paid AI models
  - `/credits give <user> <amount>` - Admins can give credits to users
  - `/credits set <user> <amount>` - Admins can set user balances
  - `/credits check [user]` - Check credit balance
  - Credits persist in `data/credits.json`
  - 1 credit = $0.0001 (10,000 credits = $1)

- **`/guide` Command**: Interactive paginated guide explaining:
  - How to use `/ask`
  - Free vs paid models
  - Credit system
  - Tips and best practices

- **Model Selection**: `/ask` now supports choosing from 12 models:
  - 7 free models (Llama 3.3 70B, Gemini 2.0 Flash, Qwen 3 235B, etc.)
  - 5 paid models (GPT-4o, Claude 3.5 Sonnet, DeepSeek V3, etc.)

- **Public/Private Responses**: `/ask` has a `private` option (default: public)

- **Usage Display**: Responses show model name, credits used, remaining balance, and token count

### Changed
- **`/ask` is now available to everyone** (previously staff-only)
  - Free models: no credits required
  - Paid models: requires credits, deducted after use
- System prompt updated from "Discord staff copilot" to "helpful AI assistant"

### Fixed
- Fixed OpenRouter provider parameter causing 404 errors
- Updated model list to use currently available free models

