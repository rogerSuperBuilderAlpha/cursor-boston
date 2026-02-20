import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "firebase/auth";

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

export interface GithubInfo {
  id: string;
  login: string;
  name?: string;
  avatar_url?: string;
  html_url: string;
}

export function useGithubConnection(user: User | null, userProfileGithub?: GithubInfo | null, userProvider?: string) {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedInfo, setConnectedInfo] = useState<GithubInfo | null>(null);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  // Priority: explicit disconnection > local state > userProfile
  const githubInfo = wasDisconnected ? null : (connectedInfo || userProfileGithub || null);
  const hasGithubConnection = Boolean(githubInfo || userProvider === "github");

  const connect = () => {
    if (!user || !GITHUB_CLIENT_ID) {
      setError("GitHub connection is not configured");
      return;
    }
    setConnecting(true);
    window.location.href = "/api/github/authorize";
  };

  const disconnect = async () => {
    if (!user || !db) return;
    setDisconnecting(true);
    setError(null);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { github: deleteField() });
      setWasDisconnected(true);
      setConnectedInfo(null);
    } catch {
      setError("Failed to disconnect GitHub. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleOAuthSuccess = async (data: Record<string, string>) => {
    if (!user || !db) {
      setError("Please sign in to finish connecting GitHub.");
      router.replace("/login?redirect=/profile");
      return;
    }
    try {
      const githubUserInfo: GithubInfo = {
        id: data.id,
        login: data.login,
        name: data.name,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
      };
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        github: { ...githubUserInfo, connectedAt: serverTimestamp() },
      });
      setConnectedInfo(githubUserInfo);
      setWasDisconnected(false);
      router.replace("/profile", { scroll: false });
    } catch {
      setError("Failed to save GitHub connection");
    }
  };

  const handleOAuthError = () => {
    setError("Failed to connect GitHub. Please try again.");
    router.replace("/profile");
  };

  return {
    githubInfo,
    hasGithubConnection,
    connecting,
    disconnecting,
    error,
    setError,
    connect,
    disconnect,
    handleOAuthSuccess,
    handleOAuthError,
  };
}
