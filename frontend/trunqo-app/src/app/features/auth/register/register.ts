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
  fullName = ''; email = ''; phone = ''; password = '';
  loading = false; showPass = false; nf = false; ef = false; phf = false; pf = false;

  constructor(private auth: AuthService, private router: Router, private snackBar: MatSnackBar) {}

  register(): void {
    const e = this.email.trim().toLowerCase();
    if (!this.fullName.trim() || !e || !this.phone.trim() || !this.password) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 }); return;
    }
    if (this.fullName.trim().length < 3) {
      this.snackBar.open('Full name must be at least 3 characters', 'Close', { duration: 3000 }); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      this.snackBar.open('Enter a valid email address', 'Close', { duration: 3000 }); return;
    }
    if (!/^[6-9]\d{9}$/.test(this.phone.trim())) {
      this.snackBar.open('Enter a valid 10-digit mobile number', 'Close', { duration: 3000 }); return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,64}$/.test(this.password)) {
      this.snackBar.open('Password must include uppercase, lowercase, number, and special character', 'Close', { duration: 4000 }); return;
    }
    this.loading = true;
    this.auth.register({
      fullName: this.fullName.trim(), email: e,
      phoneNumber: this.phone.trim(), password: this.password
    }).subscribe({
      next: (res: any) => {
        if (res.success) { this.router.navigate(['/dashboard']); }
        else { this.snackBar.open(res.message, 'Close', { duration: 3000 }); }
        this.loading = false;
      },
      error: (err: any) => {
        this.snackBar.open(err?.error?.message ?? 'Registration failed', 'Close', { duration: 4000 });
        this.loading = false;
      }
    });
  }
}
