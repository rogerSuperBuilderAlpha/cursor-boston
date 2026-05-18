/**
 * @jest-environment node
 *
 * Coverage push #48 / Wave 1c — lib/blog.ts. Small file (78 LOC) that
 * walks `content/blog/*.md` via the fs + gray-matter pair. Easy 100%
 * once we mock the fs surface.
 */

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock("gray-matter", () => jest.fn());

import * as fs from "fs";
import matter from "gray-matter";
import {
  getAllPostSlugs,
  getAllPosts,
  getPostBySlug,
} from "@/lib/blog";

const fsExists = fs.existsSync as jest.Mock;
const fsReaddir = fs.readdirSync as jest.Mock;
const fsRead = fs.readFileSync as jest.Mock;
const matterMock = matter as unknown as jest.Mock;

describe("lib/blog", () => {
  beforeEach(() => {
    fsExists.mockReset();
    fsReaddir.mockReset();
    fsRead.mockReset();
    matterMock.mockReset();
  });

  describe("getAllPosts", () => {
    it("returns [] when content/blog directory does not exist", () => {
      fsExists.mockReturnValueOnce(false);
      expect(getAllPosts()).toEqual([]);
      expect(fsReaddir).not.toHaveBeenCalled();
    });

    it("reads each .md file, applies gray-matter, and returns the parsed posts", () => {
      fsExists.mockReturnValueOnce(true);
      fsReaddir.mockReturnValueOnce(["one.md", "two.md", "ignored.txt"]);
      fsRead
        .mockReturnValueOnce("--- one ---")
        .mockReturnValueOnce("--- two ---");
      matterMock
        .mockReturnValueOnce({
          data: { title: "One", date: "2026-05-01", excerpt: "x", author: "Alice" },
          content: "Body 1",
        })
        .mockReturnValueOnce({
          data: { title: "Two", date: "2026-05-02", excerpt: "y", author: "Bob" },
          content: "Body 2",
        });
      const posts = getAllPosts();
      expect(posts).toHaveLength(2);
      // Sort: descending by date → "two" first
      expect(posts[0]?.slug).toBe("two");
      expect(posts[0]?.title).toBe("Two");
      expect(posts[0]?.author).toBe("Bob");
      expect(posts[1]?.slug).toBe("one");
    });

    it("falls back to documented defaults when frontmatter is missing", () => {
      fsExists.mockReturnValueOnce(true);
      fsReaddir.mockReturnValueOnce(["missing-meta.md"]);
      fsRead.mockReturnValueOnce("body");
      matterMock.mockReturnValueOnce({ data: {}, content: "body" });
      const [post] = getAllPosts();
      expect(post).toMatchObject({
        slug: "missing-meta",
        title: "Untitled",
        date: "",
        excerpt: "",
        author: "Cursor Boston",
        content: "body",
      });
    });

    it("ignores non-markdown files", () => {
      fsExists.mockReturnValueOnce(true);
      fsReaddir.mockReturnValueOnce(["a.txt", "b.json", ".DS_Store"]);
      expect(getAllPosts()).toEqual([]);
      expect(fsRead).not.toHaveBeenCalled();
    });
  });

  describe("getPostBySlug", () => {
    it("returns null when the post file does not exist", () => {
      fsExists.mockReturnValueOnce(false);
      expect(getPostBySlug("missing")).toBeNull();
    });

    it("returns the parsed post when the file exists", () => {
      fsExists.mockReturnValueOnce(true);
      fsRead.mockReturnValueOnce("--- hi ---");
      matterMock.mockReturnValueOnce({
        data: { title: "Hi", date: "2026-05-01", excerpt: "x", author: "Roger" },
        content: "Hello",
      });
      const post = getPostBySlug("hi");
      expect(post).toEqual({
        slug: "hi",
        title: "Hi",
        date: "2026-05-01",
        excerpt: "x",
        author: "Roger",
        content: "Hello",
      });
    });

    it("falls back to defaults when frontmatter is empty", () => {
      fsExists.mockReturnValueOnce(true);
      fsRead.mockReturnValueOnce("body");
      matterMock.mockReturnValueOnce({ data: {}, content: "body" });
      const post = getPostBySlug("orphan");
      expect(post).toMatchObject({
        slug: "orphan",
        title: "Untitled",
        author: "Cursor Boston",
      });
    });
  });

  describe("getAllPostSlugs", () => {
    it("returns [] when the directory does not exist", () => {
      fsExists.mockReturnValueOnce(false);
      expect(getAllPostSlugs()).toEqual([]);
    });

    it("returns the .md filenames minus the extension", () => {
      fsExists.mockReturnValueOnce(true);
      fsReaddir.mockReturnValueOnce(["intro.md", "deep-dive.md", "logo.png"]);
      expect(getAllPostSlugs()).toEqual(["intro", "deep-dive"]);
    });
  });
});
