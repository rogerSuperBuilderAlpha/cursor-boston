import { useMemo, useRef, useState } from "react";
import {
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  multiFactor,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useMfaEnrollment(user: User | null) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const enrolledFactors = useMemo(() => {
    try {
      if (!user) return [];
      return multiFactor(user).enrolledFactors;
    } catch {
      return [];
    }
  }, [user]);

  const hasPhoneMfa = enrolledFactors.some(
    (f) => f?.factorId === PhoneMultiFactorGenerator.FACTOR_ID
  );

  const initRecaptcha = () => {
    if (!auth) return null;
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "mfa-recaptcha-container", {
        size: "invisible",
      });
    }
    return recaptchaRef.current;
  };

  const clearRecaptcha = () => {
    if (recaptchaRef.current) {
      recaptchaRef.current.clear();
      recaptchaRef.current = null;
    }
  };

  const sendCode = async () => {
    if (!user || !auth) return;
    setError(null);
    setSuccess(null);
    if (hasPhoneMfa) { setError("Phone 2FA is already enabled."); return; }
    if (!phoneNumber.trim()) { setError("Enter a phone number in E.164 format (e.g. +15551234567)."); return; }

    setLoading(true);
    try {
      const verifier = initRecaptcha();
      if (!verifier) throw new Error("Recaptcha not initialized");
      const session = await multiFactor(user).getSession();
      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber(
        { phoneNumber: phoneNumber.trim(), session },
        verifier
      );
      setVerificationId(id);
      setSuccess("Verification code sent.");
    } catch {
      setError("Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const confirmEnrollment = async () => {
    if (!user || !auth || !verificationId) return;
    setError(null);
    setSuccess(null);
    if (!smsCode.trim()) { setError("Enter the SMS code."); return; }

    setLoading(true);
    try {
      const cred = PhoneAuthProvider.credential(verificationId, smsCode.trim());
      const assertion = PhoneMultiFactorGenerator.assertion(cred);
      await multiFactor(user).enroll(assertion, "Phone");
      await user.reload();
      setVerificationId(null);
      setSmsCode("");
      setPhoneNumber("");
      setSuccess("Two-factor authentication enabled.");
    } catch {
      setError("Failed to enable 2FA. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    if (!user) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const enrolled = multiFactor(user).enrolledFactors;
      const phoneFactor = enrolled.find(
        (f) => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID
      );
      if (!phoneFactor) { setError("No phone-based 2FA is enabled."); return; }
      await multiFactor(user).unenroll(phoneFactor.uid);
      await user.reload();
      setSuccess("Two-factor authentication disabled.");
    } catch {
      setError("Failed to disable 2FA. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return {
    phoneNumber,
    setPhoneNumber,
    smsCode,
    setSmsCode,
    verificationId,
    loading,
    error,
    success,
    hasPhoneMfa,
    sendCode,
    confirmEnrollment,
    disable,
    clearRecaptcha,
  };
}
