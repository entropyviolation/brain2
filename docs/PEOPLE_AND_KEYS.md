# People and keys — auth and more than one kind of user

_Last mapped: 2026-10-20_

**Planned. Not a wave.** Nothing here is built except the seams named in
"What already exists". Build only when an open wave in
[`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) says so.

Brain2 is open-source software: a philosophy multitool and a brain
experiment. Today it serves one person on one origin. One day it will
need sign-in and more than one kind of user. This file says how to get
there without breaking the house.

## The stance

1. **The vault belongs to the person, not to a server.** Auth unlocks a
   vault. It does not grant the vault. A person who never signs in loses
   nothing. Solo, offline, no account stays the default forever.
2. **Identity is a key, not an email.** A vault is opened by a key the
   person holds (passphrase-derived, or a device keypair). A server, if one
   ever exists, stores ciphertext and cannot read the map.
3. **A share is a dated map, not the territory.** Another person never
   sees "the vault". They see a lens: named stores, a date range, a level
   of detail, an end date. Every share says what it leaves out.
4. **Every writer is named.** A row records who or what wrote it — the
   owner, a companion, a device, a model. The miss between what was
   proposed and what was kept is data for the loop.
5. **A model is a user type, and the weakest one.** It proposes. It never
   writes. This is the Links proposal inbox pattern
   ([`LINKS_REDESIGN.md`](LINKS_REDESIGN.md)), promoted to a law.

## User types (Planned)

| Kind | Who | Can |
|------|-----|-----|
| `owner` | The person whose vault it is | Everything. Grants and revokes. Only kind that holds the key. |
| `companion` | A friend, therapist, coach, partner | Read the lenses granted. Leave notes in a margin store. Never edits the owner's rows. |
| `device` | The owner's phone, a Shortcut, the Telegram hub | Append through the ingest door only (`lib/ingest/`). Revocable per device. |
| `agent` | A language model or script | Read an exported snapshot. Return a proposal file. Writes nothing without the owner's accept. |
| `guest` | Anyone trying the app | The Demo vault only (`brain2-demo-*`). |

Roles are kinds plus grants. No role ladder, no admin tier. A grant is
`{ lens, from, until, detail }` and is shown in the screen words, not as a
permission code.

## What already exists

- **Vault scoping by prefix.** Live (`brain2-*`) vs Demo (`brain2-demo-*`)
  in `lib/storage-keys.ts`. This is already one vault per profile. A vault
  per person generalizes it: `brain2-v:<vaultId>-*`, with Live as the
  unnamed default so no existing key moves.
- **Capture origin.** `lib/capture-origin.ts` stamps how an idea entered.
  The writer stamp ("who") sits beside it ("which door").
- **Proposal inbox.** Links import and accept: the `agent` kind, already
  working.
- **Seam types.** `lib/people-and-keys.ts` names the kinds and the grant
  shape. Types only. Nothing imports it yet.

## Must fix first

`lib/mobile-auth.ts` gates the mobile Home shell with hardcoded
`admin` / `admin`. That is a placeholder, not auth. It must be replaced
before any build is served beyond localhost, and before any second kind of
user exists. The open-source repo publishes those values.

## Build order (Planned)

1. Writer stamp on new rows (`writtenBy`, defaults to `owner`). Old rows
   read as `owner`. No migration.
2. Vault id in `storage-keys.ts`, Live stays the default unnamed vault.
3. Local key: encrypt the vault at rest behind a passphrase. Lose the
   passphrase, keep the backup — say so plainly at setup.
4. Replace `mobile-auth.ts` with the vault key. Pair devices as `device`.
5. Lens export: a signed, dated, read-only slice for a `companion`.
6. Optional sync relay that stores ciphertext only. Self-hostable.

## Refused

- Accounts required to use the app.
- Telemetry, ad identity, or a social graph built from the vault.
- Data across people's vaults.
- An `agent` that writes without an accept.
- A companion who can see what the owner did not grant, or a share with no
  end date by default.
