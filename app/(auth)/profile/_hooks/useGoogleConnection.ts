import { useMemo, useState } from "react";
import { unlink, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useGoogleConnection(user: User | null) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  const providerIds = useMemo(
    () => user?.providerData?.map((p) => p.providerId) || [],
    [user?.providerData]
  );

  const hasGoogleProvider = !wasDisconnected && providerIds.some((id) => id === "google.com");
  const hasPasswordProvider = providerIds.some((id) => id === "password");
  const canDisconnect = hasGoogleProvider && providerIds.length > 1;

  const disconnect = async () => {
    if (!user || !auth) return;
    setError(null);
    setDisconnecting(true);
    if (!canDisconnect) {
      setError("You need at least one other login method before disconnecting Google.");
      setDisconnecting(false);
      return;
    }
    try {
      await unlink(user, "google.com");
      await user.reload();
      setWasDisconnected(true);
    } catch {
      setError("Failed to disconnect Google. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  // Reset wasDisconnected if Google is re-added (providerIds updated)
  const resetIfReconnected = () => {
    if (providerIds.some((id) => id === "google.com")) {
      setWasDisconnected(false);
    }
  };

  return {
    hasGoogleProvider,
    hasPasswordProvider,
    canDisconnect,
    disconnecting,
    error,
    setError,
    disconnect,
    resetIfReconnected,
  };
}
