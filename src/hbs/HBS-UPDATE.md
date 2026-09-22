# HBS update — HR unchanged

Changes are confined to src/hbs/. All original backend files outside this directory, including HR, West Walk, shared database bootstrap, index.js, package.json and package-lock.json, are unchanged byte-for-byte. The shared server and databases were not started during this work.

## Fixed

- Chat, media and message cursors use time plus ID ordering so equal timestamps do not skip records. Legacy date cursors and message-ID history anchors remain accepted. Invalid cursors return 400; page sizes are bounded.
- Followers/following/follow requests support `pagination=true` with total/hasMore/page/limit. Existing clients still receive arrays unless they opt in.
- Socket listeners register before async presence/database work, preventing a lost initial join.
- Join/read/edit/delete/react/typing validate membership. Mutations also match the supplied chat ID.
- Delivered receipts group by sender AND chat. Incoming payloads include chatId. Read handling maintains unread counters; deleting an older message does not replace the conversation's latest preview.
- Message tempId is persisted with a partial unique index. A retry acknowledges the existing message without another send, notification or unread increment.

## Before serving updated HBS code

1. Back up the HBS database using your normal process.
2. Install dependencies with the supplied unchanged lockfile.
3. With the existing MONGO_URI_HBS configured, run `node src/hbs/chat/ensureIndexes.js`. This script connects ONLY to HBS and creates indexes; it does not import the shared connection file, connect to HR, remove indexes or modify message records. Stop rollout if it fails. The partial unique index is necessary for concurrent retry protection.
4. Run `node --test src/hbs/tests/chat.test.js`.
5. Deploy through your existing process, then use two staging accounts and the app QA checklist before release.

The index script was syntax checked but NOT executed against a database here. No deployment was performed.

## Validation

11 isolated tests passed using actual HBS handlers with mocked database models and socket transport. Coverage includes cursor boundaries, nonparticipant access, media, social totals/legacy arrays, mutation chat scoping, per-chat delivery receipts, listener registration and duplicate retries. Logs: HBS-TESTS.txt.

Database index enforcement, transport reconnection, uploads/push, native device behavior and live data remain staging checks. Message insert and chat-summary update are separate writes, not a transaction; a crash between them still needs recovery handling. Offline app-kill recovery is not certified.
