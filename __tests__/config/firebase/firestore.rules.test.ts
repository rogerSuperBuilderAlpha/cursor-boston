/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "demo-cursor-boston-rules";
const RULES_PATH = resolve(process.cwd(), "config/firebase/firestore.rules");

describe("Firestore rules: badge trust boundaries", () => {
  let testEnv: RulesTestEnvironment | null = null;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(RULES_PATH, "utf8"),
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (!testEnv) {
      throw new Error(
        "Firestore rules test environment was not initialized. Run via firebase emulators:exec."
      );
    }
    await testEnv.clearFirestore();
  });

  it("allows owner create with safe initial values, but blocks owner status escalation", async () => {
    const uid = "user-speaker";
    if (!testEnv) {
      throw new Error(
        "Firestore rules test environment was not initialized. Run via firebase emulators:exec."
      );
    }

    const ownerDb = testEnv.authenticatedContext(uid).firestore();
    const submissionRef = doc(ownerDb, "talkSubmissions", "submission-1");

    await assertSucceeds(
      setDoc(submissionRef, {
        userId: uid,
        status: "pending",
        title: "Intro to Cursor",
        description: "A practical talk",
        category: "workshop",
        duration: "15-20 min",
        experience: "beginner",
      })
    );

    await assertSucceeds(
      updateDoc(submissionRef, {
        title: "Intro to Cursor (updated)",
      })
    );

    await assertFails(
      updateDoc(submissionRef, {
        status: "completed",
      })
    );
  });

  it("allows owner registration safe lifecycle but blocks attendance status escalation", async () => {
    const uid = "user-regular";
    if (!testEnv) {
      throw new Error(
        "Firestore rules test environment was not initialized. Run via firebase emulators:exec."
      );
    }

    const ownerDb = testEnv.authenticatedContext(uid).firestore();
    const registrationRef = doc(ownerDb, "eventRegistrations", "user-regular_event-1");

    await assertSucceeds(
      setDoc(registrationRef, {
        id: "user-regular_event-1",
        eventId: "event-1",
        eventTitle: "Community Meetup",
        userId: uid,
        userEmail: "user@example.com",
        userName: "Regular User",
        source: "manual",
        status: "registered",
      })
    );

    await assertSucceeds(
      updateDoc(registrationRef, {
        userName: "Regular User (updated)",
      })
    );

    await assertSucceeds(
      updateDoc(registrationRef, {
        status: "cancelled",
      })
    );

    await assertSucceeds(
      updateDoc(registrationRef, {
        status: "registered",
      })
    );

    await assertFails(
      updateDoc(registrationRef, {
        status: "attended",
      })
    );
  });

  it("allows safe user profile edits, but blocks client pullRequestsCount writes", async () => {
    const uid = "user-contributor";
    if (!testEnv) {
      throw new Error(
        "Firestore rules test environment was not initialized. Run via firebase emulators:exec."
      );
    }

    const ownerDb = testEnv.authenticatedContext(uid).firestore();
    const userRef = doc(ownerDb, "users", uid);

    await assertSucceeds(
      setDoc(userRef, {
        uid,
        displayName: "Contributor User",
        visibility: { isPublic: false },
        bio: "Initial bio",
      })
    );

    await assertSucceeds(
      updateDoc(userRef, {
        bio: "Updated bio",
      })
    );

    await assertFails(
      updateDoc(userRef, {
        pullRequestsCount: 1,
      })
    );

    await assertFails(
      updateDoc(userRef, {
        hackASprint2026ShowcaseBadge: true,
      })
    );

    const userWithCounterRef = doc(
      testEnv.authenticatedContext("user-contributor-2").firestore(),
      "users",
      "user-contributor-2"
    );
    await assertFails(
      setDoc(userWithCounterRef, {
        uid: "user-contributor-2",
        displayName: "Counter Setter",
        visibility: { isPublic: false },
        pullRequestsCount: 999,
      })
    );
  });

  it("hackathonShowcaseVotes: authenticated read allowed, client write denied", async () => {
    if (!testEnv) {
      throw new Error(
        "Firestore rules test environment was not initialized. Run via firebase emulators:exec."
      );
    }
    const uid = "vote-reader";
    const ownerDb = testEnv.authenticatedContext(uid).firestore();
    const voteRef = doc(ownerDb, "hackathonShowcaseVotes", "doc-showcase-1");
    await assertSucceeds(getDoc(voteRef));
    await assertFails(
      setDoc(voteRef, {
        eventId: "hack-a-sprint-2026",
        channel: "community",
        submissionId: "octocat",
        userId: uid,
        value: 1,
      })
    );
  });

  it("hackathonEventSignups: client read/write denied", async () => {
    if (!testEnv) {
      throw new Error(
        "Firestore rules test environment was not initialized. Run via firebase emulators:exec."
      );
    }
    const uid = "signup-user";
    const ownerDb = testEnv.authenticatedContext(uid).firestore();
    const ref = doc(ownerDb, "hackathonEventSignups", "hack-a-sprint-2026__user-1");
    await assertFails(getDoc(ref));
    await assertFails(
      setDoc(ref, {
        eventId: "hack-a-sprint-2026",
        userId: uid,
        signedUpAt: new Date(),
      })
    );
  });

  it("hackathonShowcaseVotes: unauthenticated read denied", async () => {
    if (!testEnv) {
      throw new Error(
        "Firestore rules test environment was not initialized. Run via firebase emulators:exec."
      );
    }
    const guestDb = testEnv.unauthenticatedContext().firestore();
    const voteRef = doc(guestDb, "hackathonShowcaseVotes", "doc-showcase-2");
    await assertFails(getDoc(voteRef));
  });
});
