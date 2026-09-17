---
version: alpha
name: High-Vis
description: Hi-vis lime on charcoal.
colors:
  primary: "#F2F3E8"
  secondary: "#9CA08B"
  tertiary: "#C7F900"
  tertiary-strong: "#A9D400"
  tertiary-ink: "#D9FF4D"
  neutral: "#14150F"
  surface: "#1E2018"
  on-primary: "#14150F"
  on-tertiary: "#14150F"
typography:
  display:
    fontFamily: DM Serif Display
    fontSize: 4.5rem
    fontWeight: 400
    letterSpacing: "-0.015em"
  h1:
    fontFamily: DM Serif Display
    fontSize: 2.75rem
    fontWeight: 400
  body:
    fontFamily: DM Sans
    fontSize: 1.05rem
    lineHeight: 1.7
  label:
    fontFamily: DM Sans
    fontSize: 0.75rem
    letterSpacing: "0.1em"
rounded:
  sm: 4px
  md: 8px
  lg: 16px
spacing:
  sm: 8px
  md: 16px
  lg: 32px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.md}"
    padding: 12px 20px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: 24px
---
## Overview

A high-visibility palette for long-form reading. Charcoal background, bone-white headlines, and hi-vis lime for emphasis.

## Colors

The palette is built around high-contrast neutrals and a single accent that drives interaction.

- **Primary (`#F2F3E8`):** Headlines and core text on charcoal.
- **Secondary (`#9CA08B`):** Borders, captions, and metadata.
- **Tertiary (`#C7F900`):** The sole driver for interaction. Reserve it for fills and emphasis.
- **Tertiary Strong (`#A9D400`):** The pressed/hover state of the accent.
- **Tertiary Ink (`#D9FF4D`):** Accent-colored text, icons, and hairlines on charcoal, lifted a shade for comfortable reading.
- **Neutral (`#14150F`):** The page foundation — warm charcoal, near-black.

## Typography

- **display:** DM Serif Display 4.5rem
- **h1:** DM Serif Display 2.75rem
- **body:** DM Sans 1.05rem
- **label:** DM Sans 0.75rem

## Do's and Don'ts

- **Do** use Tertiary for exactly one action per screen.
- **Do** pair Tertiary fills with `on-tertiary` (charcoal ink) text.
- **Do** use Tertiary Ink for accent text, icons, and hairlines on charcoal; raw Tertiary is for fills only.
- **Do** let Neutral carry the composition — negative space is a feature.
- **Don't** introduce gradients. This system is flat on purpose.
- **Don't** mix Tertiary with alternate accents; the single-accent rule is load-bearing.
