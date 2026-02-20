"use client";

import { useState, useEffect, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import Image from "next/image";
import { DiscordIcon, GitHubIcon } from "@/components/icons";

export type RequirementType = 
  | "isPublic" 
  | "hasGithub" 
  | "hasDiscord" 
  | "showDiscord" 
  | "hasDisplayName";

interface Requirement {
  type: RequirementType;
  label: string;
  description: string;
}

const REQUIREMENT_CONFIGS: Record<RequirementType, Requirement> = {
  isPublic: {
    type: "isPublic",
    label: "Public Profile",
    description: "Make your profile visible to other community members",
  },
  hasGithub: {
    type: "hasGithub",
    label: "GitHub Connected",
    description: "Connect your GitHub account to verify your developer identity",
  },
  hasDiscord: {
    type: "hasDiscord",
    label: "Discord Connected",
    description: "Connect your Discord account to join community discussions",
  },
  showDiscord: {
    type: "showDiscord",
    label: "Discord Visible",
    description: "Show your Discord username on your public profile",
  },
  hasDisplayName: {
    type: "hasDisplayName",
    label: "Display Name",
    description: "Set a display name for your profile",
  },
};

interface ProfileStatus {
  displayName: string | null;
  hasDisplayName: boolean;
  hasGithub: boolean;
  githubUsername: string | null;
  hasDiscord: boolean;
  discordUsername: string | null;
  visibility: {
    isPublic?: boolean;
    showDiscord?: boolean;
  };
  photoURL: string | null;
}

interface ProfileRequirementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  requirements: RequirementType[];
  title?: string;
  description?: string;
}

export default function ProfileRequirementsModal({
  isOpen,
  onClose,
  onComplete,
  requirements,
  title = "Complete Your Profile",
  description = "Please complete the following requirements to continue.",
}: ProfileRequirementsModalProps) {
  const { user, refreshUserProfile } = useAuth();
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/profile/visibility", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (data.success) {
        setProfile(data.profile);
        setDisplayNameInput(data.profile.displayName || "");
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      setLoading(true);
      fetchProfile();
    }
  }, [isOpen, user, fetchProfile]);

  // Check if all requirements are met
  const checkAllRequirementsMet = useCallback(() => {
    if (!profile) return false;
    
    return requirements.every((req) => {
      switch (req) {
        case "isPublic":
          return profile.visibility?.isPublic === true;
        case "hasGithub":
          return profile.hasGithub;
        case "hasDiscord":
          return profile.hasDiscord;
        case "showDiscord":
          return profile.visibility?.showDiscord === true;
        case "hasDisplayName":
          return profile.hasDisplayName;
        default:
          return true;
      }
    });
  }, [profile, requirements]);

  // Auto-close and callback when all requirements met
  useEffect(() => {
    if (profile && checkAllRequirementsMet()) {
      onComplete?.();
    }
  }, [profile, checkAllRequirementsMet, onComplete]);

  const toggleVisibility = async (field: "isPublic" | "showDiscord") => {
    if (!user || !profile) return;
    
    setUpdating(field);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      const newValue = !profile.visibility?.[field];
      
      const res = await fetch("/api/profile/visibility", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [field]: newValue }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setProfile({
          ...profile,
          visibility: data.visibility,
        });
        await refreshUserProfile();
      } else {
        setError(data.error || "Failed to update");
      }
    } catch (err) {
      console.error("Error updating visibility:", err);
      setError("Failed to update setting");
    } finally {
      setUpdating(null);
    }
  };

  const saveDisplayName = async () => {
    if (!user || !displayNameInput.trim()) return;
    
    setUpdating("displayName");
    setError(null);
    
    try {
      const token = await user.getIdToken();
      
      // Use the existing profile update endpoint
      const res = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayName: displayNameInput.trim() }),
      });
      
      if (res.ok) {
        setProfile({
          ...profile!,
          displayName: displayNameInput.trim(),
          hasDisplayName: true,
        });
        setEditingDisplayName(false);
        await refreshUserProfile();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update display name");
      }
    } catch (err) {
      console.error("Error updating display name:", err);
      setError("Failed to update display name");
    } finally {
      setUpdating(null);
    }
  };

  const getRequirementStatus = (type: RequirementType): boolean => {
    if (!profile) return false;
    
    switch (type) {
      case "isPublic":
        return profile.visibility?.isPublic === true;
      case "hasGithub":
        return profile.hasGithub;
      case "hasDiscord":
        return profile.hasDiscord;
      case "showDiscord":
        return profile.visibility?.showDiscord === true;
      case "hasDisplayName":
        return profile.hasDisplayName;
      default:
        return false;
    }
  };

  const renderRequirementAction = (type: RequirementType) => {
    const isComplete = getRequirementStatus(type);
    
    switch (type) {
      case "isPublic":
        return (
          <button
            onClick={() => toggleVisibility("isPublic")}
            disabled={updating === "isPublic"}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              isComplete ? "bg-emerald-500" : "bg-neutral-600"
            } ${updating === "isPublic" ? "opacity-50" : ""}`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                isComplete ? "left-7" : "left-1"
              }`}
            />
          </button>
        );
        
      case "showDiscord":
        return (
          <button
            onClick={() => toggleVisibility("showDiscord")}
            disabled={updating === "showDiscord" || !profile?.hasDiscord}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              isComplete ? "bg-emerald-500" : "bg-neutral-600"
            } ${updating === "showDiscord" || !profile?.hasDiscord ? "opacity-50" : ""}`}
            title={!profile?.hasDiscord ? "Connect Discord first" : ""}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                isComplete ? "left-7" : "left-1"
              }`}
            />
          </button>
        );
        
      case "hasGithub":
        if (isComplete && profile?.githubUsername) {
          return (
            <span className="flex items-center gap-2 text-sm text-emerald-400">
              <GitHubIcon size={16} />
              @{profile.githubUsername}
            </span>
          );
        }
        return (
          <a
            href="/api/github/authorize"
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <GitHubIcon size={16} />
            Connect GitHub
          </a>
        );
        
      case "hasDiscord":
        if (isComplete && profile?.discordUsername) {
          return (
            <span className="flex items-center gap-2 text-sm text-emerald-400">
              <DiscordIcon size={16} />
              @{profile.discordUsername}
            </span>
          );
        }
        return (
          <a
            href="/api/discord/authorize"
            className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <DiscordIcon size={16} />
            Connect Discord
          </a>
        );
        
      case "hasDisplayName":
        if (isComplete && !editingDisplayName) {
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm text-emerald-400">{profile?.displayName}</span>
              <button
                onClick={() => setEditingDisplayName(true)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
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
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="Enter your name"
              className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-neutral-500 w-40"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveDisplayName();
                if (e.key === "Escape") {
                  setEditingDisplayName(false);
                  setDisplayNameInput(profile?.displayName || "");
                }
              }}
              autoFocus={editingDisplayName}
            />
            <button
              onClick={saveDisplayName}
              disabled={!displayNameInput.trim() || updating === "displayName"}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {updating === "displayName" ? "..." : "Save"}
            </button>
            {editingDisplayName && (
              <button
                onClick={() => {
                  setEditingDisplayName(false);
                  setDisplayNameInput(profile?.displayName || "");
                }}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  // Filter to only show incomplete requirements
  const incompleteRequirements = requirements.filter(
    (req) => !getRequirementStatus(req)
  );
  const completeRequirements = requirements.filter((req) =>
    getRequirementStatus(req)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e: ReactKeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
        if (e.key === "Tab") {
          const modal = e.currentTarget.querySelector("[data-modal-content]");
          if (!modal) return;
          const focusable = modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div data-modal-content className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {profile?.photoURL ? (
                <Image
                  src={profile.photoURL}
                  alt="Profile"
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              ) : (
                <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-neutral-500"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-white">{title}</h2>
                <p className="text-sm text-neutral-400">{description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition-colors p-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-neutral-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Incomplete requirements */}
              {incompleteRequirements.length > 0 && (
                <>
                  <p className="text-sm text-neutral-500 font-medium mb-2">
                    Required ({incompleteRequirements.length} remaining)
                  </p>
                  {incompleteRequirements.map((req) => {
                    const config = REQUIREMENT_CONFIGS[req];
                    return (
                      <div
                        key={req}
                        className="flex items-center justify-between p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center">
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
                              className="text-amber-400"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">
                              {config.label}
                            </p>
                            <p className="text-neutral-400 text-xs">
                              {config.description}
                            </p>
                          </div>
                        </div>
                        {renderRequirementAction(req)}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Complete requirements */}
              {completeRequirements.length > 0 && (
                <>
                  <p className="text-sm text-neutral-500 font-medium mb-2 mt-4">
                    Completed ({completeRequirements.length})
                  </p>
                  {completeRequirements.map((req) => {
                    const config = REQUIREMENT_CONFIGS[req];
                    return (
                      <div
                        key={req}
                        className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center">
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
                              className="text-emerald-400"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">
                              {config.label}
                            </p>
                            <p className="text-neutral-400 text-xs">
                              {config.description}
                            </p>
                          </div>
                        </div>
                        {renderRequirementAction(req)}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <Link
              href="/profile"
              className="text-sm text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
            >
              Go to full profile
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
              >
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            </Link>
            
            {incompleteRequirements.length === 0 ? (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            ) : (
              <span className="text-sm text-neutral-500">
                {incompleteRequirements.length} requirement{incompleteRequirements.length !== 1 ? "s" : ""} remaining
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
