# `lib/finance-bimby/` — The Financial BIMBY

_Last mapped: 2026-11-11_

A **BIMBY** (small, single-job sub-agent) for money said in plain sentences. It files the money where it already lives, keeps the receipt and how the purchase sat with you, and says what your own history shows the next time.

Why it exists: "Spent 90$ on the amex getting hairdye and other stuff on instacart" typed into BIM chat was a log line. The money book's composer (`lib/money-parse.ts`) reads short commands ("spent $12 coffee"), not sentences, and has no place for a shop, a receipt or regret.

## What it reads

All reading is code (`read.ts`). A line needs a money verb and an amount, or one of the fixed shapes. "spent 3 hours on foxtide" and "got 2 things done" are not money.

| You say | It is | Where it goes |
|---------|-------|---------------|
| "Spent 90$ on the amex getting hairdye and other stuff on instacart" | spend: $90, Amex, Instacart, hairdye and other stuff | Tracking log spend (as the money book does it) + a `Purchase` here |
| "foxtide owes me 600$ for the cd designs" | debt owed to you | `brain2-budget` debts |
| "i owe shelby $40 for dinner" | debt you owe | `brain2-budget` debts |
| "foxtide paid me" / "foxtide paid me 400" | debt settled, whole or part | debt removed or reduced, an earning line added |
| "got paid 200 from foxtide for the poster" | earning | `brain2-budget` lines |
| "got 15$ off restaurant food on instacart" | perk | `perks` here |
| "i regret the instacart order, didn't need half of it" | verdict | on the `Purchase`, in your words |
| "thinking about ordering from instacart" | a buy being weighed | nothing written; it answers |
| "who owes me?", "how much did i spend this week?", "what do i regret?", "what discounts do i have?" | question | answered from the ledgers |

A bare "on X" is a shop only when X is a known shop (`KNOWN_MERCHANTS`, or a shop from an earlier purchase); "at X" and "from X" always are. "spent 12 on coffee" keeps coffee as the thing bought.

## Receipts

`tryMoneyPhoto` in `run.ts`. The picture goes to the attachment store (`idb:<id>`). Local OCR reads it; `receipt.ts` takes the total from a total line (never a subtotal, never the largest number) and the shop from a known name.

- A caption that is a spend files the spend with the receipt on it.
- Otherwise it is attached to the purchase the caption names, else the one told in the last 15 minutes, else one from the last week with the same total.
- With no purchase and a read total, the receipt becomes the purchase.
- With neither, it waits 15 minutes for the next spend you tell.
- In BIM chat a photo captioned only "receipt", with no purchase just told, is still the grocery receipt (`lib/ingest/apply-receipt.ts`).

## Verdicts and advice

A verdict is regret, satisfied or mixed, with your words kept word for word. A bare "i regret the shoes" keeps the verdict and asks what about it; the next line is the reason. `advise.ts` then turns the ledger into counted facts: how earlier buys at that shop sat (the newest two quoted), the shop's month so far, a discount waiting. Those lines are shown when you log a spend there and when you weigh a buy.

A model is asked for one thing: one to three sentences in reply to a verdict or to talk in the BIMBY's own chat, from the fact sheet (`factSheet`). With no model the facts are shown as they are. A model's words are never stored.

A spend at a shop with an unused discount asks "Did you use it?". "used it" closes the perk and its cue (`lib/cues/`).

## Doors

- **BIM chat**, lane `money` (`lib/ingest/bim-lanes.ts`), after the flight lanes and before the day plan. It takes a line only when the reading is sure, so everything else goes on as before. "undo that" takes back the last money write; "no, yesterday" moves a spend or an earning.
- **"tell financial bimby …"** hands the words to its own chat (`lib/ingest/bimby-handoff.ts`).
- **Its own chat** at `/lab/finance-bimby`, where every line is its to answer, with verdict keys on each purchase and the receipt thumbnails.
- **A photo in BIM chat**, as above.

## Rules

- **The money has one home.** Spending is a Tracking log entry; debts and earnings are in `brain2-budget`. A `Purchase` points at its entry and carries only what those cannot hold.
- **Never invent.** An amount comes from the sentence or a total line. A shop is named or left blank.
- **Every write can be undone**, for 30 minutes, one step back (`undoLastMoney`).
- **The same debt twice is said, not written.**

## Files

- `types.ts`: `Purchase`, `Perk`, `MoneyRead`, `MoneyAsk`, `Reflection`, `BuyIntent`.
- `read.ts`: `readMoney`, `readReflection`, `readAsk`, `readIntent`, `findAmount`, `moneyTokens`, `stem`.
- `receipt.ts`: `readReceipt`.
- `advise.ts`: `adviceFor`, `answerAsk`, `findPurchase`, `verdictLines`, `factSheet`.
- `apply.ts`: `applyMoney`, `setVerdict`, `attachReceipts`, `markPerkUsed`, `undoLastMoney`, `ledgerNow`.
- `store.ts`: `useFinanceBimby` (`brain2-finance-bimby`: purchases, perks, waiting receipts, its chat).
- `run.ts`: `tryMoney`, `tryMoneyPhoto`.
- `finance-bimby.test.ts`; the BIM chat path is tested in `lib/ingest/bim-keep.test.ts`.
- Blueprint: `lib/agents/adapters/finance-bimby.ts`. Lab: `components/Lab/FinanceBimby/`.

## Not checked

The lab page and BIM chat replies in the running app with a real model, OCR on a real Instacart screenshot, and anything on the iPhone.

**Planned.** A warning when a spend takes a budget envelope past its cap. Matching a pasted statement against purchases. Fixing an amount from chat ("it was 92.14"). A category on each purchase. Perks with an expiry date. A door in the money book itself.
