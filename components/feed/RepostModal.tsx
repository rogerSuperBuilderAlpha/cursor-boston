"use client";

import type { Message } from "@/types/feed";

interface RepostModalProps {
  message: Message;
  comment: string;
  onCommentChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  posting: boolean;
  minLength?: number;
  maxLength?: number;
}

export function RepostModal({
  message,
  comment,
  onCommentChange,
  onSubmit,
  onCancel,
  posting,
  minLength = 100,
  maxLength = 500,
}: RepostModalProps) {
  const trimmed = comment.trim();
  const isValid = trimmed.length >= minLength && trimmed.length <= maxLength;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 max-w-lg w-full">
        <h3 className="text-lg font-semibold text-white mb-4">Repost with comment</h3>
        <div className="bg-neutral-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-white">{message.authorName}</span>
          </div>
          <p className="text-neutral-300 text-sm">{message.content}</p>
        </div>
        <div className="mb-4">
          <textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Add your comment..."
            rows={4}
            maxLength={maxLength}
            className="w-full bg-neutral-800 rounded-lg p-3 text-white placeholder-neutral-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs ${
              trimmed.length < minLength
                ? "text-red-400"
                : trimmed.length > maxLength
                ? "text-red-400"
                : "text-neutral-500"
            }`}>
              {comment.length}/{maxLength} (minimum {minLength})
            </span>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-neutral-400 hover:text-white transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={posting || !isValid}
            className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {posting ? "Reposting..." : "Repost"}
          </button>
        </div>
      </div>
    </div>
  );
}
