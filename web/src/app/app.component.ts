import { Component, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <div class="app-layout">
      <app-navbar></app-navbar>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
      <app-footer></app-footer>
    </div>
  `,
  styles: [`
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .main-content {
      flex: 1;
    }
  `]
})
export class AppComponent implements OnDestroy {
  title = 'TripMate';

  private selectionGestureStartedInField = false;

  private readonly handlePointerDownCapture = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null;

    this.selectionGestureStartedInField = Boolean(
      target?.closest(
        '.modal-backdrop input, .modal-backdrop textarea, .modal-backdrop [contenteditable="true"]'
      )
    );
  };

  private readonly handleClickCapture = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const clickedBackdrop = target?.classList.contains('modal-backdrop') ?? false;

    // A text-selection drag can start inside an input/textarea and finish on the
    // modal backdrop. Browsers then emit a backdrop click, which used to close
    // the modal and look like an unexpected Back/navigation action.
    if (clickedBackdrop && this.selectionGestureStartedInField) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    this.selectionGestureStartedInField = false;
  };

  constructor() {
    document.addEventListener('pointerdown', this.handlePointerDownCapture, true);
    document.addEventListener('click', this.handleClickCapture, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointerdown', this.handlePointerDownCapture, true);
    document.removeEventListener('click', this.handleClickCapture, true);
  }
}
