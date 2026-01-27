import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPostSlugs, getPostBySlug } from "@/lib/blog";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // Simple markdown to HTML conversion for basic formatting
  const renderContent = (content: string) => {
    return content
      .split("\n\n")
      .map((paragraph, index) => {
        // Handle headers
        if (paragraph.startsWith("# ")) {
          return (
            <h1
              key={index}
              className="text-3xl font-bold text-white mt-8 mb-4"
            >
              {paragraph.slice(2)}
            </h1>
          );
        }
        if (paragraph.startsWith("## ")) {
          return (
            <h2
              key={index}
              className="text-2xl font-bold text-white mt-8 mb-4"
            >
              {paragraph.slice(3)}
            </h2>
          );
        }
        if (paragraph.startsWith("### ")) {
          return (
            <h3 key={index} className="text-xl font-bold text-white mt-6 mb-3">
              {paragraph.slice(4)}
            </h3>
          );
        }

        // Handle horizontal rules
        if (paragraph.trim() === "---") {
          return (
            <hr key={index} className="border-neutral-700 my-8" />
          );
        }

        // Handle lists
        if (paragraph.startsWith("- ")) {
          const items = paragraph.split("\n").filter((line) => line.trim());
          return (
            <ul key={index} className="list-disc list-inside space-y-2 mb-4">
              {items.map((item, i) => (
                <li key={i} className="text-neutral-300">
                  {formatInlineText(item.replace(/^- /, ""))}
                </li>
              ))}
            </ul>
          );
        }

        // Handle numbered lists
        if (/^\d+\. /.test(paragraph)) {
          const items = paragraph.split("\n").filter((line) => line.trim());
          return (
            <ol key={index} className="list-decimal list-inside space-y-2 mb-4">
              {items.map((item, i) => (
                <li key={i} className="text-neutral-300">
                  {formatInlineText(item.replace(/^\d+\. /, ""))}
                </li>
              ))}
            </ol>
          );
        }

        // Regular paragraphs
        return (
          <p key={index} className="text-neutral-300 leading-relaxed mb-4">
            {formatInlineText(paragraph)}
          </p>
        );
      });
  };

  // Format inline text (bold, italic, links, code)
  const formatInlineText = (text: string) => {
    // Split by patterns and reconstruct with React elements
    const parts: (string | React.ReactElement)[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Check for bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Check for links
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
      // Check for inline code
      const codeMatch = remaining.match(/`([^`]+)`/);

      const matches = [
        boldMatch ? { type: "bold", match: boldMatch, index: boldMatch.index! } : null,
        linkMatch ? { type: "link", match: linkMatch, index: linkMatch.index! } : null,
        codeMatch ? { type: "code", match: codeMatch, index: codeMatch.index! } : null,
      ].filter(Boolean) as Array<{ type: string; match: RegExpMatchArray; index: number }>;

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      // Find the earliest match
      const earliest = matches.reduce((min, curr) =>
        curr.index < min.index ? curr : min
      );

      // Add text before the match
      if (earliest.index > 0) {
        parts.push(remaining.slice(0, earliest.index));
      }

      // Add the formatted element
      if (earliest.type === "bold") {
        parts.push(
          <strong key={key++} className="text-white font-semibold">
            {earliest.match[1]}
          </strong>
        );
      } else if (earliest.type === "link") {
        parts.push(
          <a
            key={key++}
            href={earliest.match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
          >
            {earliest.match[1]}
          </a>
        );
      } else if (earliest.type === "code") {
        parts.push(
          <code
            key={key++}
            className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded text-sm"
          >
            {earliest.match[1]}
          </code>
        );
      }

      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    }

    return parts;
  };

  return (
    <div className="flex flex-col">
      {/* Back Link */}
      <div className="py-6 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/blog"
            className="text-neutral-400 hover:text-white transition-colors text-sm focus-visible:outline-none focus-visible:text-white focus-visible:underline"
          >
            &larr; Back to Blog
          </Link>
        </div>
      </div>

      {/* Article */}
      <article className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center gap-4 text-sm text-neutral-500 mb-4">
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <span>&middot;</span>
              <span>{post.author}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              {post.title}
            </h1>
          </header>

          {/* Content */}
          <div className="prose prose-invert max-w-none">
            {renderContent(post.content)}
          </div>
        </div>
      </article>

      {/* CTA */}
      <section className="py-12 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-bold text-white mb-4">
            Want to stay updated?
          </h2>
          <p className="text-neutral-400 mb-6">
            Subscribe to our Luma calendar to get notified about upcoming
            events.
          </p>
          <a
            href="https://lu.ma/cursor-boston"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Subscribe on Luma (opens in new tab)"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Subscribe on Luma
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17l9.2-9.2M17 17V7H7" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}
