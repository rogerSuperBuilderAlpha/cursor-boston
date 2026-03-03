"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { User } from "firebase/auth";
import Avatar from "@/components/Avatar";
import { FormInput } from "@/components/ui/FormField";
import { CloseIcon } from "@/components/icons";

interface EditProfileModalProps {
  user: User;
  onSave: (name: string, photo?: File) => Promise<void>;
  onClose: () => void;
}

export function EditProfileModal({ user, onSave, onClose }: EditProfileModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState(user.displayName || "");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be less than 5MB"); return; }
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(editName.trim(), selectedPhoto || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <h2 id="edit-profile-title" className="text-xl font-bold text-white mb-6">
          Edit Profile
        </h2>

        {/* Photo Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-400 mb-3">Profile Photo</label>
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              {photoPreview ? (
                <Image src={photoPreview} alt="Preview" width={80} height={80} className="rounded-full object-cover w-20 h-20" />
              ) : (
                <Avatar src={user.photoURL} name={user.displayName} email={user.email} size="lg" />
              )}
            </div>
            <div className="flex-1">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" id="photo-upload" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Choose Photo
              </button>
              <p className="text-neutral-400 text-xs mt-2">JPG, PNG or GIF. Max 5MB.</p>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="mb-6">
          <FormInput
            id="edit-name"
            label="Display Name"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-neutral-800 text-white rounded-lg font-medium hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
