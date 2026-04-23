import { Injectable } from '@angular/core';

export interface Contact {
  userId: string;
  name: string;
  email: string;
  lastSent: string;
  amount: number;
}

@Injectable({ providedIn: 'root' })
export class ContactsService {

  private readonly KEY = 'recent_contacts';
  private readonly MAX = 5;

  // Get recent contacts
  getContacts(): Contact[] {
    try {
      const data = localStorage.getItem(this.KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Save a contact after successful transfer
  saveContact(contact: Contact): void {
    try {
      let contacts = this.getContacts();

      // Remove if already exists
      contacts = contacts.filter(c => c.userId !== contact.userId);

      // Add to beginning
      contacts.unshift(contact);

      // Keep only last 5
      contacts = contacts.slice(0, this.MAX);

      localStorage.setItem(this.KEY, JSON.stringify(contacts));
    } catch {
      console.error('Failed to save contact');
    }
  }

  // Clear all contacts
  clearContacts(): void {
    localStorage.removeItem(this.KEY);
  }
}
