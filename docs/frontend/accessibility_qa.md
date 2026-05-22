# Accessibility QA Checklist

Color & Contrast
- Verify all text/background pairs meet WCAG AA (contrast ratio >= 4.5:1 for normal text).

Keyboard & Focus
- Ensure tab order follows visual order on web pages.
- All interactive controls must be reachable via keyboard.

Screen Readers
- Provide semantic labels for images and icons.
- Use `semanticsLabel` for critical widgets.

Forms
- Associate labels with inputs and expose error messages programmatically.

Mobile
- Test VoiceOver (iOS) / TalkBack (Android) on core flows.

Reporting
- Record issues in `docs/frontend/accessibility-issues.md` with steps to reproduce.
