# Getting Started (No Experience Needed)

You don't need to know how to code to contribute to this project. Seriously.

AI tools like **Cursor**, **Claude Code**, and **Codex** can do the heavy lifting for you. This guide walks you through everything in plain language — no jargon, no assumptions.

---

## What is this project?

Cursor Boston is a website for a community of people in the Boston area who use AI tools to build software. Think of it like a club website — it has events, member profiles, blog posts, and more.

The website is "open source," which just means anyone in the world can see the code, suggest changes, or add new features. That includes you.

## What you'll need

1. **A GitHub account** (free) — this is where the project lives. [Sign up here](https://github.com/signup) if you don't have one.

2. **One of these AI coding tools** (pick whichever you like):

   | Tool | What it is | How to get it |
   |------|-----------|--------------|
   | [Cursor](https://cursor.com) | A code editor with AI built in. You type what you want in English, and it writes the code. | Download from [cursor.com](https://cursor.com) (free tier available) |
   | [Claude Code](https://claude.ai/download) | An AI assistant that runs in your terminal (the black screen with text). You tell it what to do and it does it. | Install from [claude.ai/download](https://claude.ai/download) |
   | [Codex](https://openai.com/index/introducing-codex/) | OpenAI's coding agent. Similar idea — give instructions, get code. | Available through OpenAI |

3. **Node.js** — this is what runs the website on your computer. [Download version 22 here](https://nodejs.org/). Just click the big green button and install it like any other app.

## Step 1: Get your own copy of the project

On GitHub, getting your own copy is called "forking." Here's how:

1. Go to [the project page](https://github.com/rogerSuperBuilderAlpha/cursor-boston)
2. Click the **"Fork"** button in the top-right corner
3. Click **"Create fork"**

Now you have your own copy on GitHub. Next, you need to download it to your computer.

### If you're using Cursor

1. Open Cursor
2. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
3. Type "Git: Clone" and select it
4. Paste this (replace `your-username` with your GitHub username):
   ```
   https://github.com/your-username/cursor-boston.git
   ```
5. Pick a folder on your computer to save it in
6. Click "Open" when it asks

### If you're using Claude Code

1. Open your terminal:
   - **Mac**: Open the app called "Terminal" (search for it in Spotlight)
   - **Windows**: Open "Command Prompt" or "PowerShell" from the Start menu
2. Type these lines one at a time, pressing Enter after each:
   ```
   git clone https://github.com/your-username/cursor-boston.git
   cd cursor-boston
   ```
   (Replace `your-username` with your actual GitHub username)

## Step 2: Set up the project

This downloads everything the website needs to run. In your terminal (or Cursor's built-in terminal), type:

```
npm install
cp .env.local.demo .env.local
```

**What just happened?**
- `npm install` downloaded all the building blocks the website needs
- The second line created a settings file. The demo version lets you run the site without signing up for anything extra.

## Step 3: Start the website on your computer

```
npm run dev
```

Now open your web browser and go to: **http://localhost:3000**

You should see the Cursor Boston website running right on your computer. You can click around, explore — it's your own private copy.

## Step 4: Make a change (the fun part)

This is where AI does the work for you. Here are some real things you could do:

### Using Cursor

Cursor has a chat window built in. Open it (press `Ctrl+L` or `Cmd+L`) and type what you want in plain English:

> "Add a dark purple gradient to the footer background"

> "Fix the typo on the events page — 'Regsiter' should be 'Register'"

> "Add a new section to the homepage that shows upcoming events"

> "Make the navigation menu work better on mobile phones"

Cursor will show you the changes it wants to make. Click **"Accept"** if they look good.

### Using Claude Code

In your terminal, inside the project folder, just start Claude Code and tell it what you want:

```
claude
```

Then type your request:

> "Look at the homepage and add a welcome message for first-time visitors"

> "Find any spelling mistakes in the website and fix them"

> "Add alt text to all images that are missing it — this helps people who use screen readers"

> "The contact email in the footer is wrong, change it to hello@cursorboston.com"

Claude Code will find the right files, make the changes, and explain what it did.

### Ideas for your first contribution

Not sure what to do? Here are some beginner-friendly ideas:

- **Fix a typo** — read through the site and fix any spelling or grammar mistakes
- **Improve wording** — make a confusing sentence clearer
- **Add alt text** — find images that are missing descriptions (this helps with accessibility)
- **Update a link** — find a broken or outdated link and fix it
- **Improve colors or spacing** — make something look a little nicer
- **Translate content** — help make the site accessible in another language

Or browse the [good first issues](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) on GitHub — these are tasks the team has specifically marked as beginner-friendly.

## Step 5: Check that nothing is broken

Before you share your changes, run this in your terminal:

```
npm run lint
```

This checks that the code follows the project's style rules. If it shows errors, you can ask your AI tool to fix them:

> "Run npm run lint and fix any errors that come up"

## Step 6: Save and share your changes

This is the part where you send your changes back to the project. You can ask your AI tool to handle the whole thing:

### Using Cursor or Claude Code

Just ask:

> "Commit my changes with a short description of what I did, then push to my fork and help me create a pull request to the develop branch"

The AI will walk you through each step. A "pull request" is just a way of saying: *"Hey, I made some improvements — want to add them to the real website?"*

### Doing it yourself (if you want to learn)

1. **Save your changes** (this is called "committing"):
   ```
   git add .
   git commit -s -m "docs: fix typo on events page"
   ```
   The `-s` at the end is required — it's your signature saying you have the right to contribute this code.

2. **Upload to GitHub** (this is called "pushing"):
   ```
   git push origin main
   ```

3. **Open a pull request**:
   - Go to your fork on GitHub (github.com/your-username/cursor-boston)
   - You'll see a banner saying "Compare & pull request" — click it
   - Make sure the base branch says **"develop"** (not "main")
   - Write a short description of what you changed and why
   - Click **"Create pull request"**

## Step 7: Wait for feedback

After you submit, a maintainer will review your changes. This usually takes about a week. They might:

- **Approve it** — your changes get added to the real website
- **Ask for small tweaks** — totally normal, just make the changes and push again
- **Explain why it can't be merged** — also normal, not every idea fits. No hard feelings

## Common questions

**"Do I need to know how to code?"**
Not really. AI tools can write the code based on your plain English descriptions. You just need to know what you want to change.

**"What if I break something?"**
You can't break the real website. You're working on your own copy. Even if you mess something up locally, you can always start fresh. And the team reviews every change before it goes live.

**"What's a terminal?"**
It's the text-based window where you type commands. On Mac it's called "Terminal," on Windows it's "Command Prompt" or "PowerShell." It looks like a black (or white) screen with a blinking cursor. Think of it as texting your computer — you type a command, it does the thing.

**"What does 'npm' mean?"**
It stands for "Node Package Manager." It's a tool that downloads and manages the building blocks (called "packages") that the website is made of. You don't need to understand how it works — just type the commands and it handles the rest.

**"What does 'git' mean?"**
Git is a tool that keeps track of every change anyone makes to the project. Think of it like Google Docs version history, but for code. It lets multiple people work on the same project without overwriting each other's work.

**"What if I'm completely stuck?"**
- Ask your AI tool: *"I'm stuck, can you help me figure out what to do next?"*
- Join our [Discord](https://discord.gg/Wsncg8YYqc) and ask in the chat — people are friendly and happy to help
- Email us: hello@cursorboston.com

---

**You don't need permission to start.** Fork the project, make a change, and submit it. The worst that can happen is someone says "not quite" and helps you get it right. The best that can happen is your work goes live on a real website used by real people.

Welcome to Cursor Boston.
