import { useState } from "react";
import { User } from "firebase/auth";

interface UseEmailManagementProps {
  user: User | null;
  sendAddEmailVerification: (email: string) => Promise<void>;
  removeAdditionalEmail: (email: string) => Promise<void>;
  changePrimaryEmail: (email: string) => Promise<void>;
}

export function useEmailManagement({
   
  user: _user,
  sendAddEmailVerification,
  removeAdditionalEmail,
  changePrimaryEmail,
}: UseEmailManagementProps) {
  const [newEmail, setNewEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [primaryLoading, setPrimaryLoading] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const addEmail = async () => {
    if (!newEmail.trim()) {
      setAddError("Please enter an email address");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      await sendAddEmailVerification(newEmail);
      setAddSuccess("Verification email sent! Check your inbox.");
      setNewEmail("");
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Failed to send verification email");
    } finally {
      setAddLoading(false);
    }
  };

  const removeEmail = async (emailToRemove: string) => {
    setRemoveLoading(emailToRemove);
    try {
      await removeAdditionalEmail(emailToRemove);
    } catch (error) {
      console.error("Error removing email:", error);
    } finally {
      setRemoveLoading(null);
    }
  };

  const makePrimary = async (email: string) => {
    setPrimaryLoading(email);
    try {
      await changePrimaryEmail(email);
      window.location.reload();
    } catch (error) {
      console.error("Error changing primary email:", error);
    } finally {
      setPrimaryLoading(null);
    }
  };

  return {
    newEmail,
    setNewEmail,
    addLoading,
    addError,
    addSuccess,
    removeLoading,
    primaryLoading,
    verificationStatus,
    setVerificationStatus,
    addEmail,
    removeEmail,
    makePrimary,
  };
}
