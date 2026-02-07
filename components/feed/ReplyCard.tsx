"use client";

import { useState } from "react";
import Image from "next/image";
import type { Message, ReactionType } from "@/types/feed";
import { getInitials, formatRelativeDate } from "@/lib/utils";

interface ReplyCardProps {
  reply: Message;
  isOwner: boolean;
  userReaction?: ReactionType;
  onLike: () => void;
  onDislike: () => void;
  onDelete: () => void;
  isLoggedIn: boolean;
}

export function ReplyCard({
  reply,
  isOwner,
  userReaction,
  onLike,
  onDislike,
  onDelete,
  isLoggedIn,
}: ReplyCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
          <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-black dark:text-white text-xs font-semibold shrink-0">
            {getInitials(reply.authorName)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-black dark:text-white text-sm">{reply.authorName}</span>
            <span className="text-neutral-500 text-xs">{formatRelativeDate(reply.createdAt)}</span>
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
                      className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-white px-2 py-1"
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
