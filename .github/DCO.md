# Developer Certificate of Origin

## What is the DCO?

The Developer Certificate of Origin (DCO) is a lightweight way for contributors to certify that they wrote or otherwise have the right to submit the code they are contributing to the project.

By signing off on your commits, you certify that you have the right to submit the contribution under the project's open source license (GPL-3.0).

## Developer Certificate of Origin Version 1.1

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

## How to Sign Off

You must sign off on each commit by adding a line like this at the end of your commit message:

```
Signed-off-by: Your Name <your.email@example.com>
```

### Using the Command Line

Git has a built-in flag to add this automatically:

```bash
git commit -s -m "Your commit message"
```

The `-s` (or `--signoff`) flag will append the sign-off line using the name and email from your Git configuration.

### Setting Up Git

Make sure your Git name and email are configured correctly:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Signing Off Past Commits

If you've already made commits without the sign-off, you can amend them:

**For the most recent commit:**
```bash
git commit --amend -s
```

**For multiple commits:**
```bash
git rebase HEAD~n --signoff
```
Replace `n` with the number of commits to sign off.

### Example Commit Message

```
feat(auth): add GitHub OAuth integration

This commit adds GitHub OAuth as an authentication option,
allowing users to sign in with their GitHub accounts.

Signed-off-by: Jane Developer <jane@example.com>
```

## Why We Use DCO

The DCO provides several benefits:

1. **Legal clarity**: It creates a clear record that contributors have the right to submit their code
2. **Lightweight process**: Unlike CLAs, signing off requires no additional paperwork
3. **Industry standard**: Used by many open source projects including the Linux kernel
4. **GPL-3.0 compatibility**: Works well with our copyleft license

## Frequently Asked Questions

### Do I need to sign every commit?

Yes, every commit should be signed off. This can be done easily with `git commit -s`.

### What if I forget to sign off?

If your PR includes unsigned commits, you'll be asked to sign them before the PR can be merged. See the section above on signing off past commits.

### Can I use a pseudonym?

We prefer real names for legal clarity, but understand some contributors may have privacy concerns. Contact us at hello@cursorboston.com if you need to discuss alternative arrangements.

### Does signing off grant copyright to the project?

No. You retain copyright of your contributions. The sign-off simply certifies that you have the right to contribute the code under the project's license.

### What if my employer owns my work?

If you're contributing code that your employer may have rights to, make sure you have permission to contribute it as open source. Many employers have policies for this—check with your legal or HR department.

## Enforcement

Pull requests with commits that are not signed off will not be merged until the commits are properly signed.

If you have questions about the DCO or need help with the sign-off process, please reach out to us at hello@cursorboston.com.

---

The Developer Certificate of Origin is used by many open source projects. Learn more at [developercertificate.org](https://developercertificate.org/).
