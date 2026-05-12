# Project instructions for Claude

Conventions and behaviors that apply to every session in this repo.

## Firestore rules + indexes — run on every commit

**Before every commit, run the Firestore rules tests and validate the indexes file.** A broken rule or a malformed index spec ships silently otherwise — both files are referenced by `firebase.json` but neither has a build-time check. The Firestore emulator is the only way to catch a regression locally before CI.

What to run:

```bash
# Rules: full emulator-backed test suite (covers config/firebase/firestore.rules)
npm run test:rules

# Indexes: parseable JSON + matches the deployed schema shape
node -e "JSON.parse(require('fs').readFileSync('config/firebase/firestore.indexes.json','utf8'))"
```

If either fails, fix the underlying issue before committing — don't bypass with `--no-verify`.

Notes:
- `npm run test:rules` boots the Firestore emulator; it can take 20–30 s. That's acceptable cost on every commit; the failure mode it prevents (broken security rules in prod) is much worse.
- The rules file lives at `config/firebase/firestore.rules`; indexes at `config/firebase/firestore.indexes.json`. Both are wired through `firebase.json` at the repo root.
- CI also runs the "Firestore rules tests" check on every PR; the local pre-commit run is the early warning so we don't push a broken branch.
- **Prerequisite: Java.** The Firestore emulator needs a JRE. If `java -version` fails, install one (`brew install --cask temurin` on macOS) before relying on the local rules tests. If Java is unavailable in the environment, validate the indexes JSON at minimum and rely on the CI "Firestore rules tests" check as the backstop — note this gap explicitly when committing.
