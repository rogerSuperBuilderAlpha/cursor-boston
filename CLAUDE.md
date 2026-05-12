# Project instructions for Claude

Conventions and behaviors that apply to every session in this repo.

## Firestore rules + indexes deploy automatically on push to main

`config/firebase/firestore.rules` and `config/firebase/firestore.indexes.json` are deployed by `.github/workflows/firestore-deploy.yml` whenever main moves and either file (or `firebase.json`) changed. **Don't `firebase deploy` these by hand.** If a manual re-deploy is needed (e.g. after editing in the Firebase console and pulling the change down), trigger the `Deploy Firestore rules + indexes` workflow via `workflow_dispatch` instead.

The workflow validates that `firestore.indexes.json` parses before deploying. The Firestore emulator isn't run on every commit — that's a heavyweight check (needs Java) and CI's "Firestore rules tests" job already covers it on every PR.
