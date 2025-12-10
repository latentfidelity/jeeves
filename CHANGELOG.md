# Changelog

All notable changes to Jeeves will be documented in this file.

## [Unreleased]

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
- Updated default model to `meta-llama/llama-3.3-70b-instruct:free`
- System prompt updated from "Discord staff copilot" to "helpful AI assistant"

### Fixed
- Fixed OpenRouter provider parameter causing 404 errors
- Updated model list to use currently available free models
