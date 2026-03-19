import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private isDark = false;

  constructor() {
    // Load saved preference
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') {
      this.enableDark();
    }
  }

  toggleDark(): void {
    if (this.isDark) {
      this.disableDark();
    } else {
      this.enableDark();
    }
  }

  private enableDark(): void {
    document.body.classList.add('dark');
    localStorage.setItem('darkMode', 'true');
    this.isDark = true;
  }

  private disableDark(): void {
    document.body.classList.remove('dark');
    localStorage.setItem('darkMode', 'false');
    this.isDark = false;
  }

  getDarkMode(): boolean {
    return this.isDark;
  }
}
