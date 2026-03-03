import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "firebase/auth";

const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;

export interface DiscordInfo {
  id: string;
  username: string;
  avatar?: string;
}

export function useDiscordConnection(user: User | null, userProfileDiscord?: DiscordInfo | null) {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedInfo, setConnectedInfo] = useState<DiscordInfo | null>(null);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  // Priority: explicit disconnection > local state > userProfile
  const discordInfo = wasDisconnected ? null : (connectedInfo || userProfileDiscord || null);

  const connect = () => {
    if (!user || !DISCORD_CLIENT_ID) {
      setError("Discord connection is not configured");
      return;
    }
    setConnecting(true);
    window.location.href = "/api/discord/authorize";
  };

  const disconnect = async () => {
    if (!user || !db) return;
    setDisconnecting(true);
    setError(null);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { discord: deleteField() });
      setWasDisconnected(true);
      setConnectedInfo(null);
    } catch {
      setError("Failed to disconnect Discord. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleOAuthSuccess = async (data: Record<string, string>) => {
    if (!user || !db) {
      setError("Please sign in to finish connecting Discord.");
      router.replace("/login?redirect=/profile");
      return;
    }
    try {
      const discordUserInfo: DiscordInfo = {
        id: data.id,
        username: data.globalName || data.username,
        avatar: data.avatar,
      };
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        discord: { ...discordUserInfo, connectedAt: serverTimestamp() },
      });
      setConnectedInfo(discordUserInfo);
      setWasDisconnected(false);
      router.replace("/profile", { scroll: false });
    } catch {
      setError("Failed to save Discord connection");
    }
  };

  const handleOAuthError = (message: string | null) => {
    if (message === "not_member") {
      setError("You need to join the Cursor Boston Discord server first! Join at discord.gg/Wsncg8YYqc then try again.");
    } else {
      setError("Failed to connect Discord. Please try again.");
    }
    router.replace("/profile");
  };

  return {
    discordInfo,
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
