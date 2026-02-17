"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import Image from "next/image";

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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              @{profile.githubUsername}
            </span>
          );
        }
        return (
          <a
            href="/api/github/authorize"
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Connect GitHub
          </a>
        );
        
      case "hasDiscord":
        if (isComplete && profile?.discordUsername) {
          return (
            <span className="flex items-center gap-2 text-sm text-emerald-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
              @{profile.discordUsername}
            </span>
          );
        }
        return (
          <a
            href="/api/discord/authorize"
            className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
            </svg>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
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
