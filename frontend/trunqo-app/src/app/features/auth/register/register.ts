/**
 * register.ts — RegisterComponent
 *
 * New user registration page.
 * Route: /register
 *
 * Responsibilities:
 *  - Collects full name, email, phone, and password
 *  - Runs client-side validation before calling the API:
 *      • Full name ≥ 3 characters
 *      • Valid email format
 *      • Indian mobile number (starts with 6–9, exactly 10 digits)
 *      • Password: ≥8 chars, uppercase, lowercase, digit, special char
 *  - Calls AuthService.register() which POSTs to /api/auth/register
 *  - On success, AuthService saves the JWT and redirects to /dashboard
 *    (user is immediately logged in — no separate login step needed)
 *  - Shows field-specific error messages via MatSnackBar
 *
 * Template and styles are in separate register.html / register.css files.
 */

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  /** Two-way bound form fields */
  fullName = '';
  email = '';
  phone = '';
  password = '';

  /** Controls the loading spinner and disables the submit button during the API call */
  loading = false;
  /** Toggles password field between masked and plain text */
  showPass = false;
  /** Focus state flags for input wrapper styling */
  nf = false; // name field focused
  ef = false; // email field focused
  phf = false; // phone field focused
  pf = false; // password field focused

  constructor(
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  /**
   * Validates all fields and submits the registration form.
   * Client-side validation mirrors the backend's data annotations so the user
   * gets immediate feedback without a round-trip to the server.
   *
   * Validation rules:
   *  - Full name: trimmed, ≥3 characters
   *  - Email: basic format check (contains @ and .)
   *  - Phone: Indian mobile format — starts with 6–9, exactly 10 digits
   *  - Password: ≥8 chars, must contain uppercase, lowercase, digit, special char
   */
  register(): void {
    // Normalise email to lowercase before validation and submission
    const e = this.email.trim().toLowerCase();

    // Guard: all fields must be filled
    if (!this.fullName.trim() || !e || !this.phone.trim() || !this.password) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 });
      return;
    }

    // Full name must be at least 3 characters
    if (this.fullName.trim().length < 3) {
      this.snackBar.open('Full name must be at least 3 characters', 'Close', { duration: 3000 });
      return;
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      this.snackBar.open('Enter a valid email address', 'Close', { duration: 3000 });
      return;
    }

    // Indian mobile number: starts with 6–9, exactly 10 digits
    if (!/^[6-9]\d{9}$/.test(this.phone.trim())) {
      this.snackBar.open('Enter a valid 10-digit mobile number', 'Close', { duration: 3000 });
      return;
    }

    // Password complexity: uppercase + lowercase + digit + special character
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,64}$/.test(this.password)) {
      this.snackBar.open('Password must include uppercase, lowercase, number, and special character', 'Close', { duration: 4000 });
      return;
    }

    this.loading = true;
    this.auth.register({
      fullName: this.fullName.trim(),
      email: e,
      phoneNumber: this.phone.trim(),
      password: this.password
    }).subscribe({
      next: (res: any) => {
        if (res.success) {
          // AuthService.register() already saved the session — go straight to dashboard
          this.router.navigate(['/dashboard']);
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 3000 });
        }
        this.loading = false;
      },
      error: (err: any) => {
        // Backend may return a specific message (e.g. "Email already exists")
        this.snackBar.open(err?.error?.message ?? 'Registration failed', 'Close', { duration: 4000 });
        this.loading = false;
      }
    });
  }
}
