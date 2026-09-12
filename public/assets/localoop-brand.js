/**
 * Localoop Signature Brand Component & Animated Loader
 * Renders the new interlocking double-L logo and double-L loading animation.
 */

(function () {
  // SVG definition for the double-L symbol
  const DOUBLE_L_SVG = `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path class="ll-left" d="M 7 15 H 14 V 31 H 28 V 38 H 7 Z" fill="currentColor"/>
      <path class="ll-right" d="M 17 3 H 24 V 21 H 38 V 28 H 17 Z" fill="currentColor"/>
    </svg>
  `;

  // SVG definition for the animated double-L loader (as shown in the video)
  const ANIMATED_LOADER_SVG = `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Fills that glow -->
      <path class="l-fill-left" d="M 7 15 H 14 V 31 H 28 V 38 H 7 Z" />
      <path class="l-fill-right" d="M 17 3 H 24 V 21 H 38 V 28 H 17 Z" />
      <!-- Centerline Stroke Paths for tracing animation -->
      <path class="l-path-left" d="M 10.5 15 V 34.5 H 28" />
      <path class="l-path-right" d="M 20.5 3 V 24.5 H 38" />
    </svg>
  `;

  /**
   * Generates the HTML for the Localoop text brand
   */
  window.getLocaloopLogoHTML = function (options = {}) {
    const isGov = options.gov || false;
    return `
      <span class="brand-text" style="font-weight: 800; font-size: 19px; letter-spacing: -0.5px; display: inline-flex; align-items: center; gap: 8px;">
        Localoop
        ${isGov ? '<span class="gov-tag" style="background: #e2e8f0; color: #1e293b; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; border: 1px solid #cbd5e1;">Gov</span>' : ''}
      </span>
    `;
  };

  /**
   * Shows the animated double-L full-screen loader (matches the user's video)
   */
  window.showLocaloopLoader = function (text = 'Localoop') {
    let overlay = document.getElementById('localoopLoaderOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'localoopLoaderOverlay';
      overlay.className = 'localoop-loader-overlay';
      overlay.innerHTML = `
        <div class="localoop-loader-box">
          <div class="localoop-animated-mark">
            ${ANIMATED_LOADER_SVG}
          </div>
          <div class="localoop-loader-text" id="localoopLoaderText">${text}</div>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      const textEl = document.getElementById('localoopLoaderText');
      if (textEl) textEl.textContent = text;
      overlay.classList.remove('fade-out');
    }
  };

  /**
   * Hides the animated double-L loader with a smooth fade
   */
  window.hideLocaloopLoader = function () {
    const overlay = document.getElementById('localoopLoaderOverlay');
    if (overlay) {
      overlay.classList.add('fade-out');
    }
  };

  // Helper to replace elements with class .localoop-logo-slot
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.localoop-logo-slot').forEach(el => {
      const isGov = el.dataset.gov === 'true';
      const variant = el.dataset.variant || '';
      el.innerHTML = window.getLocaloopLogoHTML({ gov: isGov, variant: variant });
    });
  });
})();
