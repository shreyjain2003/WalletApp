import { Injectable } from '@angular/core';

/**
 * Contact
 *
 * Represents a recently-used transfer recipient.
 * Stored locally so the Transfer page can show quick-select buttons
 * without an extra API call.
 */
export interface Contact {
  /** The recipient's internal user ID — used as the receiverUserId in transfer requests. */
  userId: string;
  /** Display name shown in the recent-contacts row. */
  name: string;
  /** Email address used to look up the recipient. */
  email: string;
  /** ISO timestamp of the last transfer to this contact — used for sorting. */
  lastSent: string;
  /** The amount of the last transfer — pre-fills the amount field when selected. */
  amount: number;
}

/**
 * ContactsService
 *
 * Manages a small list of recently-used transfer recipients in localStorage.
 * This is a purely client-side feature — no API calls are made.
 * The list is capped at 5 entries (most recent first) to keep the UI compact.
 */
@Injectable({ providedIn: 'root' })
export class ContactsService {

  /** localStorage key under which the contacts array is stored. */
  private readonly KEY = 'recent_contacts';

  /** Maximum number of contacts to retain — oldest entries are dropped beyond this. */
  private readonly MAX = 5;

  /**
   * Retrieves the stored list of recent contacts.
   * Returns an empty array if nothing is stored or if the stored data is corrupt.
   */
  getContacts(): Contact[] {
    try {
      const data = localStorage.getItem(this.KEY);
      // Parse the JSON string, or return an empty array if nothing is stored
      return data ? JSON.parse(data) : [];
    } catch {
      // If JSON.parse fails (corrupt data), return a safe empty array
      return [];
    }
  }

  /**
   * Saves a contact after a successful transfer.
   * If the contact already exists (same userId), it is moved to the top of the list
   * so the most recently used contacts always appear first.
   * @param contact  The recipient details to persist
   */
  saveContact(contact: Contact): void {
    try {
      let contacts = this.getContacts();

      // Remove the existing entry for this user so we can re-insert at the front
      contacts = contacts.filter(c => c.userId !== contact.userId);

      // Insert the updated contact at the beginning (most recent first)
      contacts.unshift(contact);

      // Trim the list to the maximum allowed size to avoid unbounded growth
      contacts = contacts.slice(0, this.MAX);

      localStorage.setItem(this.KEY, JSON.stringify(contacts));
    } catch {
      // Silently ignore storage failures (e.g., private browsing quota exceeded)
    }
  }

  /**
   * Removes all stored contacts.
   * Not currently called from the UI but available for a future "clear history" feature.
   */
  clearContacts(): void {
    localStorage.removeItem(this.KEY);
  }
}
