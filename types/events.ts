/**
 * Event type definitions for the Cursor Boston community events
 */

export interface AgendaItem {
  time: string;
  title: string;
  description: string;
}

export interface Speaker {
  name: string;
  role: string;
  company?: string;
  image?: string;
  bio?: string;
  social?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
}

export interface Sponsor {
  name: string;
  logo: string;
  url?: string;
  tier?: "gold" | "silver" | "bronze" | "community";
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface Venue {
  name: string;
  address: string;
  mapUrl?: string | null;
  accessibilityInfo?: string;
  coordinates?: { lat: number; lng: number };
}

export interface CoworkingInfo {
  description: string;
  sessionsPerDay: number;
  hoursPerSession: number;
  slotsPerSession: number;
  startTime: string;
  endTime: string;
}

export interface Event {
  // Required fields
  id: string;
  slug: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: "meetup" | "workshop" | "hackathon" | "conference" | "social";
  description: string;
  image: string;
  lumaUrl: string;
  lumaEventId: string;
  registrationRequired: boolean;

  // Optional fields
  subtitle?: string;
  venue?: Venue;
  longDescription?: string;
  capacity?: number;
  perks?: string[];
  topics?: string[];
  agenda?: AgendaItem[];
  speakers?: Speaker[];
  sponsors?: Sponsor[];
  faq?: FAQ[];
  whatToBring?: string[];
  featured?: boolean;
  
  // Coworking fields
  hasCoworking?: boolean;
  coworkingInfo?: CoworkingInfo;

  // Status fields
  isCancelled?: boolean;
  isPostponed?: boolean;
  postponedTo?: string;
}

export interface EventsData {
  upcoming: Event[];
  past: Event[];
}

/**
 * Helper function to check if an event is in the past
 */
export function isEventPast(event: Event): boolean {
  if (event.date === "TBD") return false;
  const eventDate = new Date(event.date);
  return eventDate < new Date();
}

/**
 * Helper function to get event URL
 */
export function getEventUrl(event: Event): string {
  return `/events/${event.slug}`;
}

/**
 * Helper function to format event date for display
 */
export function formatEventDate(date: string): string {
  if (date === "TBD") return "Date TBD";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return date;
  }
}
