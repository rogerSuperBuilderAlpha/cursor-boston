"use client";

import { useEffect, useState, useMemo, Suspense, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, limit, Timestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

type PageTab = "members" | "feed";

interface PublicMember {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  bio?: string;
  location?: string;
  company?: string;
  jobTitle?: string;
  discord?: {
    username: string;
  };
  socialLinks?: {
    website?: string;
    linkedIn?: string;
    twitter?: string;
    github?: string;
    substack?: string;
  };
  visibility?: {
    showEmail: boolean;
    showBio: boolean;
    showLocation: boolean;
    showCompany: boolean;
    showJobTitle: boolean;
    showDiscord: boolean;
    showGithubBadge: boolean;
    showEventsAttended: boolean;
    showTalksGiven: boolean;
    showWebsite: boolean;
    showLinkedIn: boolean;
    showTwitter: boolean;
    showGithub: boolean;
    showSubstack: boolean;
    showMemberSince: boolean;
  };
  eventsAttended?: number;
  talksGiven?: number;
  pullRequestsCount?: number;
  github?: {
    login: string;
    html_url: string;
  };
  createdAt?: { toDate: () => Date };
}

interface Filters {
  hasDiscord: boolean;
  hasLinkedIn: boolean;
  hasTwitter: boolean;
  hasGithub: boolean;
  hasSubstack: boolean;
  hasWebsite: boolean;
}

type SortOption = "newest" | "oldest" | "mostTalks" | "mostEvents" | "mostPRs" | "name";

type ReactionType = "like" | "dislike";

interface RepostData {
  originalId: string;
  originalAuthorId: string;
  originalAuthorName: string;
  originalContent: string;
}

interface Message {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  createdAt: Timestamp;
  // Social features
  parentId?: string;
  repostOf?: RepostData;
  likeCount?: number;
  dislikeCount?: number;
  replyCount?: number;
  repostCount?: number;
}

interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  type: ReactionType;
}

function getInitials(name: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
  return "?";
}

function MembersPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PageTab>("members");
  
  // Members state
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Feed state
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [posting, setPosting] = useState(false);
  
  // Social features state
  const [userReactions, setUserReactions] = useState<Record<string, ReactionType>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [messageReplies, setMessageReplies] = useState<Record<string, Message[]>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [repostingMessage, setRepostingMessage] = useState<Message | null>(null);
  const [repostComment, setRepostComment] = useState("");
  const [feedSearchQuery, setFeedSearchQuery] = useState("");
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [filters, setFilters] = useState<Filters>({
    hasDiscord: false,
    hasLinkedIn: false,
    hasTwitter: false,
    hasGithub: false,
    hasSubstack: false,
    hasWebsite: false,
  });
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function fetchPublicMembers() {
      if (!db) {
        setLoading(false);
        return;
      }

      try {
        const membersRef = collection(db, "users");
        const q = query(
          membersRef,
          where("visibility.isPublic", "==", true),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const publicMembers = snapshot.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        })) as PublicMember[];
        setMembers(publicMembers);
      } catch (error) {
        console.error("Error fetching members:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicMembers();
  }, []);

  // Fetch messages when feed tab is active
  useEffect(() => {
    if (activeTab !== "feed") return;
    
    async function fetchMessages() {
      if (!db) return;
      
      setLoadingMessages(true);
      try {
        const messagesRef = collection(db, "communityMessages");
        // Only fetch top-level messages (no parentId means it's not a reply)
        const q = query(
          messagesRef,
          orderBy("createdAt", "desc"),
          limit(50)
        );
        const snapshot = await getDocs(q);
        const fetchedMessages = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Message))
          .filter((msg) => !msg.parentId);
        setMessages(fetchedMessages);
        
        // Fetch user's reactions if logged in
        if (user) {
          const reactionsRef = collection(db, "messageReactions");
          const reactionsQuery = query(
            reactionsRef,
            where("userId", "==", user.uid)
          );
          const reactionsSnapshot = await getDocs(reactionsQuery);
          const reactions: Record<string, ReactionType> = {};
          reactionsSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            reactions[data.messageId] = data.type;
          });
          setUserReactions(reactions);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setLoadingMessages(false);
      }
    }

    fetchMessages();
  }, [activeTab, user]);

  const callCommunityApi = useCallback(
    async (endpoint: string, payload: Record<string, unknown>) => {
      if (!user) {
        throw new Error("Not authenticated");
      }
      const token = await user.getIdToken();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Request failed");
      }

      return response.json();
    },
    [user]
  );

  const postMessage = async () => {
    const trimmed = newMessage.trim();
    if (!user || !db || !trimmed || trimmed.length < 100 || trimmed.length > 500) return;
    
    setPosting(true);
    try {
      const messagesRef = collection(db, "communityMessages");
      const newMsg = {
        content: trimmed,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        authorPhoto: user.photoURL,
        createdAt: serverTimestamp(),
        likeCount: 0,
        dislikeCount: 0,
        replyCount: 0,
        repostCount: 0,
      };
      const docRef = await addDoc(messagesRef, newMsg);
      
      // Add to local state immediately
      setMessages((prev) => [
        {
          id: docRef.id,
          ...newMsg,
          createdAt: Timestamp.now(),
        },
        ...prev,
      ]);
      setNewMessage("");
    } catch (error) {
      console.error("Error posting message:", error);
    } finally {
      setPosting(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!db) return;
    
    try {
      await deleteDoc(doc(db, "communityMessages", messageId));
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      // Also remove from replies if it's there
      setMessageReplies((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = updated[key].filter((m) => m.id !== messageId);
        });
        return updated;
      });
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  // Toggle like/dislike reaction
  const toggleReaction = useCallback(async (messageId: string, type: ReactionType) => {
    if (!user) return;
    
    const currentReaction = userReactions[messageId];
    
    // Optimistic update
    const updateMessage = (updater: (msg: Message) => Message) => {
      setMessages((prev) => prev.map((m) => m.id === messageId ? updater(m) : m));
      setMessageReplies((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = updated[key].map((m) => m.id === messageId ? updater(m) : m);
        });
        return updated;
      });
    };
    
    try {
      if (currentReaction === type) {
        // Remove reaction
        setUserReactions((prev) => {
          const updated = { ...prev };
          delete updated[messageId];
          return updated;
        });
        updateMessage((m) => ({
          ...m,
          [type === "like" ? "likeCount" : "dislikeCount"]: Math.max(
            0,
            (m[type === "like" ? "likeCount" : "dislikeCount"] || 0) - 1
          ),
        }));
      } else {
        // Add or switch reaction
        setUserReactions((prev) => ({ ...prev, [messageId]: type }));

        if (currentReaction) {
          // Switching from one to another
          updateMessage((m) => ({
            ...m,
            [currentReaction === "like" ? "likeCount" : "dislikeCount"]: Math.max(
              0,
              (m[currentReaction === "like" ? "likeCount" : "dislikeCount"] || 0) -
                1
            ),
            [type === "like" ? "likeCount" : "dislikeCount"]:
              (m[type === "like" ? "likeCount" : "dislikeCount"] || 0) + 1,
          }));
        } else {
          // New reaction
          updateMessage((m) => ({
            ...m,
            [type === "like" ? "likeCount" : "dislikeCount"]:
              (m[type === "like" ? "likeCount" : "dislikeCount"] || 0) + 1,
          }));
        }
      }

      const result = await callCommunityApi("/api/community/reaction", {
        messageId,
        type,
      });

      if (result?.action === "removed") {
        setUserReactions((prev) => {
          const updated = { ...prev };
          delete updated[messageId];
          return updated;
        });
      } else if (result?.action === "added" || result?.action === "switched") {
        setUserReactions((prev) => ({ ...prev, [messageId]: result.type || type }));
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
      // Revert optimistic update on error
      if (currentReaction) {
        setUserReactions((prev) => ({ ...prev, [messageId]: currentReaction }));
      } else {
        setUserReactions((prev) => {
          const updated = { ...prev };
          delete updated[messageId];
          return updated;
        });
      }
    }
  }, [user, userReactions, callCommunityApi]);

  // Fetch replies for a message
  const fetchReplies = useCallback(async (parentId: string) => {
    if (!db) return;
    
    try {
      const messagesRef = collection(db, "communityMessages");
      const q = query(
        messagesRef,
        where("parentId", "==", parentId),
        orderBy("createdAt", "asc")
      );
      const snapshot = await getDocs(q);
      const replies = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessageReplies((prev) => ({ ...prev, [parentId]: replies }));
    } catch (error) {
      console.error("Error fetching replies:", error);
    }
  }, []);

  // Toggle reply expansion
  const toggleReplies = useCallback((messageId: string) => {
    setExpandedReplies((prev) => {
      const updated = new Set(Array.from(prev));
      if (updated.has(messageId)) {
        updated.delete(messageId);
      } else {
        updated.add(messageId);
        // Fetch replies if not already loaded
        if (!messageReplies[messageId]) {
          fetchReplies(messageId);
        }
      }
      return updated;
    });
  }, [messageReplies, fetchReplies]);

  // Post a reply
  const postReply = async (parentId: string, parentAuthorName: string) => {
    const trimmed = replyContent.trim();
    if (!user || !trimmed || trimmed.length < 100 || trimmed.length > 500) return;
    
    setPostingReply(true);
    try {
      const response = await callCommunityApi("/api/community/reply", {
        parentId,
        content: trimmed,
      });

      const newReplyWithId: Message = {
        id: response.replyId,
        content: trimmed,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        authorPhoto: user.photoURL,
        createdAt: Timestamp.now(),
        parentId,
        likeCount: 0,
        dislikeCount: 0,
        replyCount: 0,
        repostCount: 0,
      };

      setMessageReplies((prev) => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), newReplyWithId],
      }));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === parentId ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m
        )
      );
      
      // Reset state
      setReplyContent("");
      setReplyingTo(null);
      
      // Ensure replies are expanded
      setExpandedReplies((prev) => new Set([...Array.from(prev), parentId]));
    } catch (error) {
      console.error("Error posting reply:", error);
    } finally {
      setPostingReply(false);
    }
  };

  // Repost a message
  const repostMessage = async (original: Message) => {
    const trimmed = repostComment.trim();
    if (!user || !trimmed || trimmed.length < 100 || trimmed.length > 500) return;
    
    setPosting(true);
    try {
      const response = await callCommunityApi("/api/community/repost", {
        originalId: original.id,
        content: trimmed,
      });

      const repost = {
        content: trimmed,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        authorPhoto: user.photoURL,
        createdAt: Timestamp.now(),
        repostOf: {
          originalId: original.id,
          originalAuthorId: original.authorId,
          originalAuthorName: original.authorName,
          originalContent: original.content,
        },
        likeCount: 0,
        dislikeCount: 0,
        replyCount: 0,
        repostCount: 0,
      };

      setMessages((prev) => [
        {
          id: response.repostId,
          ...repost,
        },
        ...prev.map((m) =>
          m.id === original.id ? { ...m, repostCount: (m.repostCount || 0) + 1 } : m
        ),
      ]);
      
      setRepostingMessage(null);
      setRepostComment("");
    } catch (error) {
      console.error("Error reposting:", error);
    } finally {
      setPosting(false);
    }
  };

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!feedSearchQuery.trim()) return messages;
    const query = feedSearchQuery.toLowerCase();
    return messages.filter((msg) => {
      const content = msg.content?.toLowerCase() || "";
      const author = msg.authorName?.toLowerCase() || "";
      const originalContent = msg.repostOf?.originalContent?.toLowerCase() || "";
      return content.includes(query) || author.includes(query) || originalContent.includes(query);
    });
  }, [messages, feedSearchQuery]);

  // Filter and sort members
  const filteredAndSortedMembers = useMemo(() => {
    let result = [...members];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((member) => {
        const searchableFields = [
          member.displayName,
          member.bio,
          member.location,
          member.company,
          member.jobTitle,
        ].filter(Boolean);
        return searchableFields.some((field) =>
          field?.toLowerCase().includes(query)
        );
      });
    }

    // Apply link filters
    if (filters.hasDiscord) {
      result = result.filter((m) => m.discord?.username);
    }
    if (filters.hasLinkedIn) {
      result = result.filter((m) => m.socialLinks?.linkedIn);
    }
    if (filters.hasTwitter) {
      result = result.filter((m) => m.socialLinks?.twitter);
    }
    if (filters.hasGithub) {
      result = result.filter((m) => m.socialLinks?.github);
    }
    if (filters.hasSubstack) {
      result = result.filter((m) => m.socialLinks?.substack);
    }
    if (filters.hasWebsite) {
      result = result.filter((m) => m.socialLinks?.website);
    }

    // Apply sorting
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
          const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
          return dateB - dateA;
        });
        break;
      case "oldest":
        result.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
          const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
          return dateA - dateB;
        });
        break;
      case "mostTalks":
        result.sort((a, b) => (b.talksGiven || 0) - (a.talksGiven || 0));
        break;
      case "mostEvents":
        result.sort((a, b) => (b.eventsAttended || 0) - (a.eventsAttended || 0));
        break;
      case "mostPRs":
        result.sort((a, b) => (b.pullRequestsCount || 0) - (a.pullRequestsCount || 0));
        break;
      case "name":
        result.sort((a, b) => {
          const nameA = a.displayName?.toLowerCase() || "";
          const nameB = b.displayName?.toLowerCase() || "";
          return nameA.localeCompare(nameB);
        });
        break;
    }

    return result;
  }, [members, searchQuery, filters, sortBy]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Switch to members tab and search for a specific user
  const viewMemberProfile = (authorName: string) => {
    setSearchQuery(authorName);
    setActiveTab("members");
    // Update URL without reload
    router.push(`/members?search=${encodeURIComponent(authorName)}`, { scroll: false });
  };

  // Handle URL search param changes
  useEffect(() => {
    const search = searchParams.get("search");
    if (search) {
      setSearchQuery(search);
      setActiveTab("members");
    }
  }, [searchParams]);

  const clearFilters = () => {
    setFilters({
      hasDiscord: false,
      hasLinkedIn: false,
      hasTwitter: false,
      hasGithub: false,
      hasSubstack: false,
      hasWebsite: false,
    });
    setSearchQuery("");
    // Clear URL search param
    router.push("/members", { scroll: false });
  };

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Community
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto mb-8">
            Connect with developers, designers, and innovators building with Cursor in Boston.
          </p>
          
          {/* Tabs */}
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setActiveTab("members")}
              className={`px-6 py-2.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === "members"
                  ? "bg-emerald-500 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Members
              </span>
            </button>
            <button
              onClick={() => setActiveTab("feed")}
              className={`px-6 py-2.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === "feed"
                  ? "bg-emerald-500 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Feed
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Repost Confirmation Modal */}
      {repostingMessage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 max-w-lg w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Repost with comment</h3>
            <div className="bg-neutral-800 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-white">{repostingMessage.authorName}</span>
              </div>
              <p className="text-neutral-300 text-sm">{repostingMessage.content}</p>
            </div>
            <div className="mb-4">
              <textarea
                value={repostComment}
                onChange={(e) => setRepostComment(e.target.value)}
                placeholder="Add your comment..."
                rows={4}
                maxLength={500}
                className="w-full bg-neutral-800 rounded-lg p-3 text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${
                  repostComment.length < 100
                    ? "text-red-400"
                    : repostComment.length > 500
                    ? "text-red-400"
                    : "text-neutral-500"
                }`}>
                  {repostComment.length}/500 (minimum 100)
                </span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setRepostingMessage(null);
                  setRepostComment("");
                }}
                className="px-4 py-2.5 text-neutral-400 hover:text-white transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={() => repostMessage(repostingMessage)}
                disabled={posting || repostComment.trim().length < 100 || repostComment.trim().length > 500}
                className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                {posting ? "Reposting..." : "Repost"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feed Tab */}
      {activeTab === "feed" && (
        <section className="py-8 px-6">
          <div className="max-w-2xl mx-auto">
            {/* Feed Search */}
            <div className="relative mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={feedSearchQuery}
                onChange={(e) => setFeedSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full pl-11 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              />
              {feedSearchQuery && (
                <button
                  onClick={() => setFeedSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1"
                  aria-label="Clear search"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Search Results Count */}
            {feedSearchQuery && (
              <p className="text-sm text-neutral-500 mb-4">
                {filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""} for &quot;{feedSearchQuery}&quot;
              </p>
            )}

            {/* Post Message Box */}
            {user ? (
              <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 mb-6">
                <div className="flex gap-3">
                  <div className="shrink-0">
                    {user.photoURL ? (
                      <Image
                        src={user.photoURL}
                        alt={user.displayName || "You"}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-white font-semibold">
                        {getInitials(user.displayName || user.email)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="What's on your mind?"
                      rows={3}
                      maxLength={500}
                      className="w-full bg-transparent text-white placeholder-neutral-500 resize-none focus:outline-none"
                    />
                    <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                      <span className={`text-xs ${
                        newMessage.length < 100
                          ? "text-red-400"
                          : newMessage.length > 500
                          ? "text-red-400"
                          : "text-neutral-500"
                      }`}>
                        {newMessage.length}/500 (minimum 100)
                      </span>
                      <button
                        onClick={postMessage}
                        disabled={posting || newMessage.trim().length < 100 || newMessage.trim().length > 500}
                        className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 min-h-[44px]"
                      >
                        {posting ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-6 text-center">
                <p className="text-neutral-400 mb-4">Sign in to post messages</p>
                <Link
                  href="/login?redirect=/members"
                  className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Messages Feed */}
            {loadingMessages ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-400 text-lg mb-2">
                  {feedSearchQuery ? "No messages match your search" : "No messages yet"}
                </p>
                <p className="text-neutral-500 text-sm">
                  {feedSearchQuery ? (
                    <button
                      onClick={() => setFeedSearchQuery("")}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      Clear search
                    </button>
                  ) : (
                    "Be the first to post something!"
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMessages.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    isOwner={user?.uid === message.authorId}
                    isLoggedIn={!!user}
                    userReaction={userReactions[message.id]}
                    onDelete={() => deleteMessage(message.id)}
                    onAuthorClick={() => viewMemberProfile(message.authorName)}
                    onLike={() => toggleReaction(message.id, "like")}
                    onDislike={() => toggleReaction(message.id, "dislike")}
                    onReply={() => setReplyingTo(replyingTo === message.id ? null : message.id)}
                    onRepost={() => setRepostingMessage(message)}
                    showReplyInput={replyingTo === message.id}
                    replyContent={replyContent}
                    onReplyContentChange={setReplyContent}
                    onSubmitReply={() => postReply(message.id, message.authorName)}
                    postingReply={postingReply}
                    replies={messageReplies[message.id] || []}
                    showReplies={expandedReplies.has(message.id)}
                    onToggleReplies={() => toggleReplies(message.id)}
                    onReplyLike={(replyId) => toggleReaction(replyId, "like")}
                    onReplyDislike={(replyId) => toggleReaction(replyId, "dislike")}
                    onDeleteReply={(replyId) => deleteMessage(replyId)}
                    replyReactions={userReactions}
                    currentUserId={user?.uid}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Members Tab */}
      {activeTab === "members" && (
      <section className="py-8 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Search, Filter, Sort Controls */}
          {!loading && members.length > 0 && (
            <div className="mb-8 space-y-4">
              {/* Search and Sort Row */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, location, job, bio..."
                    className="w-full pl-11 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                  />
                </div>

                {/* Filter Toggle Button */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-3 border rounded-lg font-medium transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    showFilters || activeFilterCount > 0
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                      : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent cursor-pointer"
                >
                  <option value="newest">Newest Members</option>
                  <option value="oldest">Oldest Members</option>
                  <option value="mostTalks">Most Talks</option>
                  <option value="mostEvents">Most Events</option>
                  <option value="mostPRs">Most Pull Requests</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>

              {/* Filter Checkboxes */}
              {showFilters && (
                <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-neutral-300">
                      Filter by connected accounts
                    </span>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearFilters}
                        className="text-xs text-neutral-400 hover:text-white transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <FilterCheckbox
                      checked={filters.hasDiscord}
                      onChange={(checked) =>
                        setFilters((f) => ({ ...f, hasDiscord: checked }))
                      }
                      label="Discord"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                      }
                    />
                    <FilterCheckbox
                      checked={filters.hasLinkedIn}
                      onChange={(checked) =>
                        setFilters((f) => ({ ...f, hasLinkedIn: checked }))
                      }
                      label="LinkedIn"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      }
                    />
                    <FilterCheckbox
                      checked={filters.hasTwitter}
                      onChange={(checked) =>
                        setFilters((f) => ({ ...f, hasTwitter: checked }))
                      }
                      label="X"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      }
                    />
                    <FilterCheckbox
                      checked={filters.hasGithub}
                      onChange={(checked) =>
                        setFilters((f) => ({ ...f, hasGithub: checked }))
                      }
                      label="GitHub"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      }
                    />
                    <FilterCheckbox
                      checked={filters.hasSubstack}
                      onChange={(checked) =>
                        setFilters((f) => ({ ...f, hasSubstack: checked }))
                      }
                      label="Substack"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
                        </svg>
                      }
                    />
                    <FilterCheckbox
                      checked={filters.hasWebsite}
                      onChange={(checked) =>
                        setFilters((f) => ({ ...f, hasWebsite: checked }))
                      }
                      label="Website"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                          <path d="M2 12h20" />
                        </svg>
                      }
                    />
                  </div>
                </div>
              )}

              {/* Results count */}
              <div className="text-sm text-neutral-500">
                {filteredAndSortedMembers.length === members.length
                  ? `${members.length} member${members.length !== 1 ? "s" : ""}`
                  : `${filteredAndSortedMembers.length} of ${members.length} members`}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-400 text-lg mb-4">
                No public profiles yet.
              </p>
              <p className="text-neutral-500">
                Be the first to{" "}
                <Link
                  href="/profile"
                  className="text-emerald-400 hover:text-emerald-300 underline"
                >
                  make your profile public
                </Link>
                !
              </p>
            </div>
          ) : filteredAndSortedMembers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-400 text-lg mb-4">
                No members match your search.
              </p>
              <button
                onClick={clearFilters}
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedMembers.map((member) => (
                <MemberCard key={member.uid} member={member} />
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* CTA */}
      <section className="py-16 px-6 bg-neutral-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Want to be listed here?
          </h2>
          <p className="text-neutral-400 text-lg mb-8">
            Create an account and make your profile public to connect with other
            community members.
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center px-6 py-3 md:px-8 md:py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Set Up Your Profile
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        </div>
      }
    >
      <MembersPageContent />
    </Suspense>
  );
}

function MemberCard({ member }: { member: PublicMember }) {
  const v = member.visibility;

  return (
    <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 hover:border-neutral-700 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        {member.photoURL ? (
          <Image
            src={member.photoURL}
            alt={member.displayName || "Member"}
            width={56}
            height={56}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center text-white font-semibold text-lg">
            {getInitials(member.displayName)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-lg truncate">
            {member.displayName || "Anonymous"}
          </h3>
          {v?.showJobTitle && member.jobTitle && (
            <p className="text-neutral-400 text-sm truncate">{member.jobTitle}</p>
          )}
          {v?.showCompany && member.company && (
            <p className="text-neutral-500 text-sm truncate">{member.company}</p>
          )}
        </div>
      </div>

      {/* Bio */}
      {v?.showBio && member.bio && (
        <p className="text-neutral-300 text-sm mb-4 line-clamp-3">{member.bio}</p>
      )}

      {/* Location */}
      {v?.showLocation && member.location && (
        <div className="flex items-center gap-2 text-neutral-400 text-sm mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {member.location}
        </div>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {v?.showDiscord && member.discord && (
          <span className="px-2 py-1 bg-[#5865F2]/10 text-[#5865F2] text-xs rounded-full inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Discord
          </span>
        )}
        {v?.showGithubBadge && member.github && (
          <span className="px-2 py-1 bg-neutral-800/50 text-white text-xs rounded-full inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            GitHub
          </span>
        )}
        {v?.showEventsAttended && member.eventsAttended && member.eventsAttended > 0 && (
          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">
            {member.eventsAttended} event{member.eventsAttended !== 1 ? "s" : ""} attended
          </span>
        )}
        {v?.showTalksGiven && member.talksGiven && member.talksGiven > 0 && (
          <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full">
            {member.talksGiven} talk{member.talksGiven !== 1 ? "s" : ""} given
          </span>
        )}
        {member.pullRequestsCount && member.pullRequestsCount > 0 && (
          <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">
            {member.pullRequestsCount} PR{member.pullRequestsCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Social Links */}
      <div className="flex items-center gap-1 pt-4 border-t border-neutral-800 -ml-2">
        {v?.showWebsite && member.socialLinks?.website && (
          <a
            href={member.socialLinks.website}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Website (opens in new tab)"
            className="text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
          </a>
        )}
        {v?.showLinkedIn && member.socialLinks?.linkedIn && (
          <a
            href={member.socialLinks.linkedIn}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn (opens in new tab)"
            className="text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
        )}
        {v?.showTwitter && member.socialLinks?.twitter && (
          <a
            href={member.socialLinks.twitter}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X/Twitter (opens in new tab)"
            className="text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        )}
        {v?.showGithub && member.socialLinks?.github && (
          <a
            href={member.socialLinks.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub (opens in new tab)"
            className="text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        )}
        {v?.showSubstack && member.socialLinks?.substack && (
          <a
            href={member.socialLinks.substack}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Substack (opens in new tab)"
            className="text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
            </svg>
          </a>
        )}
        {v?.showMemberSince && member.createdAt && (
          <span className="text-neutral-500 text-xs ml-auto">
            Member since{" "}
            {member.createdAt.toDate().toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function FilterCheckbox({
  checked,
  onChange,
  label,
  icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer transition-colors border min-h-[44px] ${
        checked
          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
          : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {icon}
      <span className="text-sm">{label}</span>
    </label>
  );
}

function MessageCard({
  message,
  isOwner,
  isLoggedIn,
  userReaction,
  onDelete,
  onAuthorClick,
  onLike,
  onDislike,
  onReply,
  onRepost,
  showReplyInput,
  replyContent,
  onReplyContentChange,
  onSubmitReply,
  postingReply,
  replies,
  showReplies,
  onToggleReplies,
  onReplyLike,
  onReplyDislike,
  onDeleteReply,
  replyReactions,
  currentUserId,
}: {
  message: Message;
  isOwner: boolean;
  isLoggedIn: boolean;
  userReaction?: ReactionType;
  onDelete: () => void;
  onAuthorClick: () => void;
  onLike: () => void;
  onDislike: () => void;
  onReply: () => void;
  onRepost: () => void;
  showReplyInput: boolean;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onSubmitReply: () => void;
  postingReply: boolean;
  replies: Message[];
  showReplies: boolean;
  onToggleReplies: () => void;
  onReplyLike: (replyId: string) => void;
  onReplyDislike: (replyId: string) => void;
  onDeleteReply: (replyId: string) => void;
  replyReactions: Record<string, ReactionType>;
  currentUserId?: string;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp?.toDate) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const isRepost = !!message.repostOf;

  return (
    <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
      {/* Repost Header */}
      {isRepost && (
        <div className="flex items-center gap-2 text-neutral-500 text-sm mb-3 pb-3 border-b border-neutral-800">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <button
            onClick={onAuthorClick}
            className="hover:text-emerald-400 transition-colors"
          >
            {message.authorName}
          </button>
          <span>reposted</span>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onAuthorClick}
          className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-full"
        >
          {message.authorPhoto ? (
            <Image
              src={message.authorPhoto}
              alt={message.authorName}
              width={40}
              height={40}
              className="rounded-full object-cover hover:opacity-80 transition-opacity"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-white font-semibold hover:bg-neutral-700 transition-colors">
              {getInitials(message.authorName)}
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={onAuthorClick}
                className="font-medium text-white truncate hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:text-emerald-400"
              >
                {message.authorName}
              </button>
              <span className="text-neutral-500 text-sm shrink-0">
                {formatDate(message.createdAt)}
              </span>
            </div>
            {isOwner && (
              <div className="relative">
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onDelete();
                        setShowDeleteConfirm(false);
                      }}
                      className="px-3 py-2 text-sm text-red-400 hover:text-red-300 min-h-[44px] flex items-center"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-2 text-sm text-neutral-400 hover:text-white min-h-[44px] flex items-center"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-neutral-500 hover:text-neutral-300 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
                    aria-label="Delete message"
                  >
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
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Reposter's comment */}
          <p className="text-neutral-300 mt-1 whitespace-pre-wrap break-words">
            {message.content}
          </p>
          
          {/* Original message being reposted */}
          {isRepost && (
            <div className="mt-3 p-3 bg-neutral-800/50 rounded-lg border-l-4 border-emerald-500/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-neutral-400">
                  {message.repostOf!.originalAuthorName}
                </span>
              </div>
              <p className="text-neutral-300 text-sm whitespace-pre-wrap break-words">
                {message.repostOf!.originalContent}
              </p>
            </div>
          )}

          {/* Reaction Buttons */}
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-neutral-800 -ml-2">
            {/* Like */}
            <button
              onClick={onLike}
              disabled={!isLoggedIn}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${
                userReaction === "like"
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-neutral-500 hover:text-emerald-400 hover:bg-neutral-800"
              } ${!isLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label={userReaction === "like" ? "Remove like" : "Like"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={userReaction === "like" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="text-sm">{message.likeCount || 0}</span>
            </button>

            {/* Dislike */}
            <button
              onClick={onDislike}
              disabled={!isLoggedIn}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${
                userReaction === "dislike"
                  ? "text-red-400 bg-red-500/10"
                  : "text-neutral-500 hover:text-red-400 hover:bg-neutral-800"
              } ${!isLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label={userReaction === "dislike" ? "Remove dislike" : "Dislike"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={userReaction === "dislike" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
              </svg>
              <span className="text-sm">{message.dislikeCount || 0}</span>
            </button>

            {/* Reply */}
            <button
              onClick={onReply}
              disabled={!isLoggedIn}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${
                showReplyInput
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-neutral-500 hover:text-emerald-400 hover:bg-neutral-800"
              } ${!isLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label="Reply"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-sm">{message.replyCount || 0}</span>
            </button>

            {/* Repost */}
            {!isRepost && (
              <button
                onClick={onRepost}
                disabled={!isLoggedIn}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors min-h-[44px] text-neutral-500 hover:text-emerald-400 hover:bg-neutral-800 ${
                  !isLoggedIn ? "opacity-50 cursor-not-allowed" : ""
                }`}
                aria-label="Repost"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M17 1l4 4-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 23l-4-4 4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                <span className="text-sm">{message.repostCount || 0}</span>
              </button>
            )}
          </div>

          {/* Reply Input */}
          {showReplyInput && (
            <div className="mt-3 pt-3 border-t border-neutral-800">
              <textarea
                value={replyContent}
                onChange={(e) => onReplyContentChange(e.target.value)}
                placeholder={`Reply to ${message.authorName}...`}
                rows={2}
                maxLength={500}
                className="w-full bg-neutral-800 rounded-lg p-3 text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${
                  replyContent.length < 100
                    ? "text-red-400"
                    : replyContent.length > 500
                    ? "text-red-400"
                    : "text-neutral-500"
                }`}>
                  {replyContent.length}/500 (minimum 100)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={onReply}
                    className="px-3 py-2 text-sm text-neutral-400 hover:text-white transition-colors min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSubmitReply}
                    disabled={postingReply || replyContent.trim().length < 100 || replyContent.trim().length > 500}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    {postingReply ? "Replying..." : "Reply"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View Replies Toggle */}
          {(message.replyCount || 0) > 0 && (
            <button
              onClick={onToggleReplies}
              className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${showReplies ? "rotate-90" : ""}`}
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              {showReplies ? "Hide" : "View"} {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
            </button>
          )}

          {/* Replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-3 space-y-3 pl-4 border-l-2 border-neutral-800">
              {replies.map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  isOwner={currentUserId === reply.authorId}
                  userReaction={replyReactions[reply.id]}
                  onLike={() => onReplyLike(reply.id)}
                  onDislike={() => onReplyDislike(reply.id)}
                  onDelete={() => onDeleteReply(reply.id)}
                  isLoggedIn={!!currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReplyCard({
  reply,
  isOwner,
  userReaction,
  onLike,
  onDislike,
  onDelete,
  isLoggedIn,
}: {
  reply: Message;
  isOwner: boolean;
  userReaction?: ReactionType;
  onLike: () => void;
  onDislike: () => void;
  onDelete: () => void;
  isLoggedIn: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp?.toDate) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="bg-neutral-800/50 rounded-lg p-3">
      <div className="flex items-start gap-2">
        {reply.authorPhoto ? (
          <Image
            src={reply.authorPhoto}
            alt={reply.authorName}
            width={28}
            height={28}
            className="rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {getInitials(reply.authorName)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white text-sm">{reply.authorName}</span>
            <span className="text-neutral-500 text-xs">{formatDate(reply.createdAt)}</span>
            {isOwner && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={() => {
                        onDelete();
                        setShowDeleteConfirm(false);
                      }}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-xs text-neutral-400 hover:text-white px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="ml-auto text-neutral-500 hover:text-neutral-300 p-1"
                    aria-label="Delete reply"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
          <p className="text-neutral-300 text-sm mt-1">{reply.content}</p>
          
          {/* Reply Reactions */}
          <div className="flex items-center gap-1 mt-2 -ml-1">
            <button
              onClick={onLike}
              disabled={!isLoggedIn}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${
                userReaction === "like"
                  ? "text-emerald-400"
                  : "text-neutral-500 hover:text-emerald-400"
              } ${!isLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={userReaction === "like" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {reply.likeCount || 0}
            </button>
            <button
              onClick={onDislike}
              disabled={!isLoggedIn}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${
                userReaction === "dislike"
                  ? "text-red-400"
                  : "text-neutral-500 hover:text-red-400"
              } ${!isLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={userReaction === "dislike" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
              </svg>
              {reply.dislikeCount || 0}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
