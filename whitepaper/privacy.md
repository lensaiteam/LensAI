---
description: Store almost nothing about people. Erase it in one action.
---

# Privacy and identity

What a person researches hints at what they hold and what they plan to do. LensAI treats research history as sensitive, stores as little as possible, and makes erasure a first-class, one-action path.

## Sign-in

* **Today:** a wallet, proven by an off-chain signature (Sign-In With Ethereum). No transaction, no gas, and no private key ever touches LensAI's servers. Login nonces are single-use and short-lived, and each signature is verified against the address, domain and chain before a session is issued.
* **Next:** email and Google sign-in, so nobody needs a wallet to use a free research product.

Anyone can read the live pulse without signing in. Asking a question requires sign-in, which lets the desk apply fair daily caps and keep free research from being farmed by bots.

## What is stored

| Stored | Why |
|---|---|
| Wallet address | Identity. No name, password or identity documents. |
| Email address or Telegram chat id | Only if that alert channel is turned on. |
| Conversations (scrubbed text, anchor, claim audit) | History. Automatically purged after 90 idle days. |
| Watches and their trigger log | The feature itself. |
| Watchlist symbols, timezone, last-seen anchor | Personalisation and "what changed". |
| Daily usage counters | Fair caps on free usage. |
| API key hashes | The key itself is shown once and never stored. |
| Claim-check submissions | Only when the user chooses to save one. |
| Answer feedback | Calibration. |

**Never stored:** private keys or signing permissions, balances or on-chain activity (the address is never enriched), exchange keys, payment data, IP addresses, ad trackers.

All user data lives in a separate user database, cascades from the account, and is erased with it. Export and erasure are each one action.

## Three boundaries enforced in code

1. **No user identifier ever reaches a model.** User text is scrubbed, and the model router refuses any prompt that still carries a wallet address, an email or a known identifier of that user. Tested.
2. **Nothing derived from a user enters the permanent record.** The corpus, briefs and calls are append-only, so anything placed there could never be erased. Shared briefs and calls are keyed to market state; question-specific answers are never written there.
3. **The session never leaves the website.** The browser receives a short-lived, audience-bound token (15 minutes) for the engine; the session cookie stays on the web origin.

## Security

All secrets live server-side and are never sent to the browser. Requests are rate-limited, inputs are validated, and usage caps are enforced on the server, never in the browser.
