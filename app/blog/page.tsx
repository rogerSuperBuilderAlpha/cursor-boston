import { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Updates, announcements, and tutorials from the Cursor Boston community.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Blog
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Updates, announcements, event recaps, and tutorials from the Cursor
            Boston community.
          </p>
        </div>
      </section>

      {/* Posts List */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          {posts.length > 0 ? (
            <div className="space-y-8">
              {posts.map((post) => (
                <article
                  key={post.slug}
                  className="bg-neutral-900 rounded-2xl p-8 border border-neutral-800 hover:border-neutral-700 transition-colors"
                >
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
                  <Link href={`/blog/${post.slug}`} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 rounded-lg">
                    <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-neutral-300 transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-neutral-400 leading-relaxed mb-4">
                      {post.excerpt}
                    </p>
                    <span className="text-white font-medium group-hover:underline">
                      Read more<span className="sr-only">: {post.title}</span> &rarr;
                    </span>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-neutral-900 rounded-2xl p-12 text-center border border-neutral-800">
              <p className="text-neutral-400">No posts yet. Check back soon!</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
