# Project instructions for Claude

Conventions and behaviors that apply to every session in this repo.

## Firestore rules + indexes — verify before every commit

The Firestore security rules (`config/firebase/firestore.rules`) and composite-index spec (`config/firebase/firestore.indexes.json`) ship without a build-time check. A broken file shows up only at deploy time or when a query starts failing in prod. So before every commit:

1. **Validate the indexes JSON parses.** Cheap, no dependencies:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('config/firebase/firestore.indexes.json','utf8'))"
   ```
2. **If the commit touches `firestore.rules` or `firestore.indexes.json`, the CI "Firestore rules tests" check is the gate** — don't merge a PR where that check is failing. The check runs `npm run test:rules` against the Firestore emulator in cloud CI, where the dependencies it needs (a JRE for the emulator) are already provisioned.
3. **If you're actively editing `firestore.rules` and want a local emulator run,** that's `npm run test:rules`. It needs Java on the path. Don't install Java just to satisfy this rule — only set up the local emulator if you're doing real rules work and want the fast feedback loop. For everything else, the CI check is the source of truth.

No `--no-verify` bypasses on commits that touch these files.
