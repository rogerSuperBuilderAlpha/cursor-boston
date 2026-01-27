# Cursor Boston

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Contributing](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)

> A modern community platform for Cursor users in the Boston area. Built with Next.js, TypeScript, and Firebase.

**Cursor Boston** is an open-source community platform designed to bring together developers, students, and professionals who use Cursor for AI-powered development. The platform facilitates event discovery, talk submissions, community engagement, and knowledge sharing.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Community](#community)
- [License](#license)

## Documentation

- [README.md](README.md) - This file, main project documentation
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) - Contribution guidelines
- [docs/CODE_OF_CONDUCT.md](docs/CODE_OF_CONDUCT.md) - Community code of conduct
- [docs/SECURITY.md](docs/SECURITY.md) - Security policy

## Features

### Core Functionality

- **📅 Events Management** - Browse and discover upcoming workshops, meetups, and hackathons
- **🎤 Talk Submissions** - Community members can propose and submit talk ideas
- **📝 Blog System** - Markdown-based blog with dynamic routing
- **👥 Member Directory** - Connect with other community members
- **🔐 Authentication** - Multiple sign-in options (Email, Google, GitHub) via Firebase
- **📧 Event Requests** - Members can request new events to be organized
- **🔗 Social Integration** - Connect Discord and GitHub accounts to your profile

### User Experience

- **🎨 Modern UI** - Dark theme with responsive design
- **♿ Accessibility** - WCAG-compliant with keyboard navigation and screen reader support
- **📱 Mobile-First** - Fully responsive across all device sizes
- **⚡ Performance** - Optimized with Next.js App Router and server components

## Tech Stack

### Frontend

- **[Next.js 14](https://nextjs.org/)** - React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[React 18](https://react.dev/)** - UI library

### Backend & Services

- **[Firebase Authentication](https://firebase.google.com/products/auth)** - User authentication
- **[Cloud Firestore](https://firebase.google.com/products/firestore)** - NoSQL database
- **[Firebase Storage](https://firebase.google.com/products/storage)** - File storage
- **[Firebase Analytics](https://firebase.google.com/products/analytics)** - Usage analytics

### External Integrations

- **Discord OAuth** - Community membership verification
- **GitHub OAuth** - Developer profile integration
- **Luma** - Event calendar integration

## Architecture

### High-Level Overview

```
┌─────────────────┐
│   Next.js App   │
│   (App Router)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│Client │ │Server │
│Components│Components│
└───┬───┘ └──┬────┘
    │        │
    └───┬────┘
        │
┌───────▼────────┐
│  Firebase SDK  │
└───────┬────────┘
        │
┌───────┴────────┐
│                │
│  ┌──────────┐  │
│  │ Auth     │  │
│  └──────────┘  │
│  ┌──────────┐  │
│  │ Firestore│  │
│  └──────────┘  │
│  ┌──────────┐  │
│  │ Storage  │  │
│  └──────────┘  │
└────────────────┘
```

### Project Structure

```
cursor-boston/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   │   ├── login/
│   │   ├── signup/
│   │   └── profile/
│   ├── about/             # About page
│   ├── blog/              # Blog listing and posts
│   ├── events/            # Events listing and requests
│   ├── talks/             # Talks listing and submissions
│   ├── members/           # Member directory
│   └── api/               # API routes (OAuth callbacks, webhooks)
├── components/            # React components
│   ├── Navigation.tsx
│   ├── Footer.tsx
│   └── ...
├── contexts/              # React context providers
│   └── AuthContext.tsx
├── lib/                   # Utility functions
│   ├── firebase.ts        # Firebase configuration
│   ├── blog.ts            # Blog utilities
│   ├── submissions.ts     # Form submission handlers
│   └── ...
├── content/               # Content files
│   ├── blog/              # Markdown blog posts
│   ├── events.json        # Event data
│   └── talks.json         # Talk data
└── public/                # Static assets
```

### Data Flow

1. **Authentication**: Users sign in via Firebase Auth (Email/Google/GitHub)
2. **Profile Management**: User profiles stored in Firestore `users` collection
3. **Submissions**: Talk and event submissions stored in Firestore with email notifications
4. **Content**: Blog posts from markdown files, events/talks from JSON files

## Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn** package manager
- **Firebase account** (free tier works)
- **Git** for version control

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/rogerSuperBuilderAlpha/cursor-boston.git
   cd cursor-boston
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` and add your Firebase configuration (see [Configuration](#configuration) below).

4. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Configuration

### Environment Variables

Copy `.env.local.example` to `.env.local` and configure the following:

#### Firebase Configuration

Required for core functionality:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

Get these values from [Firebase Console](https://console.firebase.google.com) → Project Settings → General → Your apps.

#### OAuth Integrations (Optional)

**Discord OAuth** (for Discord connection feature):

```env
NEXT_PUBLIC_DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
NEXT_PUBLIC_DISCORD_REDIRECT_URI=https://yourdomain.com/api/discord/callback
CURSOR_BOSTON_DISCORD_SERVER_ID=your-discord-server-id
```

**GitHub OAuth** (for GitHub connection feature):

```env
NEXT_PUBLIC_GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
NEXT_PUBLIC_GITHUB_REDIRECT_URI=https://yourdomain.com/api/github/callback
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
GITHUB_REPO_OWNER=rogerSuperBuilderAlpha
GITHUB_REPO_NAME=cursor-boston
```

**Firebase Admin (optional, required for GitHub webhook processing):**

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id"}
```

### Firebase Setup

#### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Follow the setup wizard

#### 2. Enable Authentication

1. Navigate to **Authentication** → **Sign-in method**
2. Enable the following providers:
   - **Email/Password**
   - **Google** (requires OAuth consent screen setup)
   - **GitHub** (requires GitHub OAuth app)

#### 3. Create Firestore Database

1. Navigate to **Firestore Database**
2. Click "Create database"
3. Start in **test mode** (we'll add security rules)
4. Choose a location

#### 4. Configure Security Rules

Copy the rules from `config/firebase/firestore.rules` in this repository to your Firebase Console:

1. Navigate to **Firestore Database** → **Rules**
2. Paste the rules from `config/firebase/firestore.rules`
3. Click "Publish"

#### 5. Set up Email Notifications (Optional)

To receive email notifications for submissions, install the **Trigger Email** extension:

1. Go to **Extensions** → **Explore Extensions**
2. Search for "Trigger Email" and install
3. Configure:
   - **SMTP Connection URI**: Your email provider's SMTP settings
     - Gmail: `smtps://your-email@gmail.com:app-password@smtp.gmail.com:465`
     - SendGrid: `smtps://apikey:your-api-key@smtp.sendgrid.net:465`
   - **Email documents collection**: `mail`
   - **Default FROM address**: Your sender email

### Firestore Collections

The application uses the following Firestore collections:

#### `users/{userId}`
User profile data:
- `displayName`, `email`, `photoURL`
- `bio`, `location`, `jobTitle`
- `socialLinks` (Discord, GitHub, LinkedIn, Twitter, etc.)
- `visibility` settings
- `createdAt`, `updatedAt`

#### `talkSubmissions/{docId}`
Talk proposals from members:
- `name`, `email`, `userId`
- `title`, `description`, `category`, `duration`, `experience`
- `bio`, `linkedIn`, `twitter`, `previousTalks`
- `status`: `pending` | `approved` | `rejected`
- `createdAt`

#### `eventRequests/{docId}`
Event requests from members:
- `name`, `email`, `organization`
- `eventType`, `title`, `description`
- `proposedDate`, `expectedAttendees`, `venue`
- `status`: `pending` | `approved` | `rejected`
- `createdAt`

#### `mail/{docId}`
Used by Trigger Email extension (auto-processed).

## Deployment

### Pre-Deployment Checklist

Before deploying to production, ensure all environment variables are configured and security rules are properly set up.

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Configure custom domain (if applicable)
5. Deploy

### Other Platforms

The application can be deployed to any platform that supports Next.js:

- **Netlify** - Automatic deployments from Git
- **Railway** - Simple deployment with environment variables
- **AWS Amplify** - AWS-hosted Next.js deployments
- **Self-hosted** - Run `npm run build && npm start` on any Node.js server

### Environment Variables in Production

Ensure all environment variables from `.env.local` are set in your deployment platform's environment variable settings.

## Project Structure

See [Architecture](#architecture) section above for detailed structure.

Key directories:

- `app/` - Next.js App Router pages and API routes
- `components/` - Reusable React components
- `lib/` - Utility functions and helpers
- `content/` - Static content (blog posts, JSON data)
- `public/` - Static assets (images, icons)
- `docs/` - Documentation (contributing, security, code of conduct)
- `.github/` - GitHub issue and PR templates

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](docs/CONTRIBUTING.md) for details.

Quick start for contributors:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit with clear messages (`git commit -m 'Add amazing feature'`)
5. Push to your branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

Please read our [Code of Conduct](docs/CODE_OF_CONDUCT.md) before contributing.

## Community

- **🌐 Website**: [cursorboston.com](https://cursorboston.com) (update with your domain)
- **💬 Discord**: [Join our Discord server](https://discord.gg/Wsncg8YYqc)
- **📅 Events**: [Luma Calendar](https://lu.ma/cursor-boston)
- **🐛 Issues**: [GitHub Issues](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues)
- **📧 Email**: hello@cursorboston.com (update with your contact email)

## Project Status

**Current Version**: 0.1.0

This project is actively maintained and open to contributions. We welcome bug reports, feature requests, and pull requests!

### Roadmap

- [ ] Enhanced member directory features
- [ ] Real-time notifications
- [ ] Advanced search and filtering
- [ ] Admin dashboard
- [ ] Analytics dashboard
- [ ] Mobile app (future consideration)

## Customization

When forking this project for your own community:

1. **Update branding**: Replace logo, colors, and content
2. **Configure domain**: Update all references to `cursorboston.com` in:
   - `app/layout.tsx` (metadata URLs)
   - `.env.local.example` (OAuth redirect URIs)
   - `README.md` (community links)
3. **Update contact info**: Replace email addresses throughout the codebase
4. **Set up services**: Configure Firebase, Discord, GitHub OAuth apps
5. **Customize content**: Update events, talks, and blog content

See `.env.local.example` for all configuration points.

## Security

We take security seriously. Please review our [Security Policy](docs/SECURITY.md) before reporting vulnerabilities.

**Important**: Never commit `.env.local` or any files containing secrets to version control.

## License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Firebase](https://firebase.google.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Community inspired by the global Cursor community

---

**Made with ❤️ by the Cursor Boston community**
