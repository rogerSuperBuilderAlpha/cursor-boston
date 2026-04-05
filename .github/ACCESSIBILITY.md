# Accessibility Statement

Cursor Boston is committed to providing an inclusive and accessible experience for all users.

## Our Target

We aim to conform to the [Web Content Accessibility Guidelines (WCAG) 2.1](https://www.w3.org/TR/WCAG21/) at **Level AA**.

## What We Do

- **Semantic HTML**: Proper heading hierarchy, landmark regions, and ARIA attributes throughout the application.
- **Keyboard Navigation**: All interactive elements are reachable and operable via keyboard. Focus indicators are visible on all focusable elements.
- **Color & Contrast**: Theme-aware color system with light and dark modes. We use sufficient color contrast ratios for text and interactive elements.
- **Screen Reader Support**: ARIA labels on buttons, links, and form controls. Decorative elements are hidden from assistive technology.
- **Responsive Design**: The platform works across screen sizes and supports text zoom up to 200%.

## Known Limitations

- The interactive event map (Leaflet) has limited keyboard support for map navigation. We provide an accessible list view as an alternative.
- Some third-party embeds (Luma event widgets) may not meet all WCAG criteria.

## Reporting Issues

If you encounter an accessibility barrier, please:

1. [Open a GitHub issue](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/new?labels=accessibility&template=bug_report.md) with the `accessibility` label
2. Email us at hello@cursorboston.com

Include the page URL, your assistive technology (if applicable), and a description of the barrier.

## Testing

We test accessibility using:
- [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) — automated linting for JSX accessibility
- Manual keyboard and screen reader testing
- Browser DevTools accessibility audits
