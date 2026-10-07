// Displayed copy rewritten for a software-engineering portfolio (front end, back end, cloud,
// ML / computer vision). Structure, item counts, media and camera params match the source
// bundle so layout and animation stay 1:1.

import type { GlobalContent } from "./types";

export const globalContent: GlobalContent = {
  "title": "Peanutto",
  "infos": "Fullstack engineer, ML & Cloud",
  "navbar": {
    "links": [
      "Work",
      "About",
      "Playground"
    ],
    "lab": {
      "text": "Lab",
      "url": "https://github.com"
    },
    "contact": "hello@example.com"
  },
  "loader": {
    "progressText": "Compiling world",
    "cursorIndication": [
      "Click",
      "to enable sound"
    ]
  },
  "orientation": {
    "title": "Rotate your device",
    "text": "For an optimal navigation, please turn your screen vertically."
  },
  "footer": {
    "titles": [
      "Let's build",
      "a scalable",
      "future"
    ],
    "titlesReveal": [
      "your pipeline",
      "to production",
      "starts here !"
    ],
    "date": "Autumn 2026",
    "creditsBtn": "Credits",
    "networks": [
      {
        "name": "Github",
        "url": "https://github.com"
      },
      {
        "name": "hello@example.com"
      },
      {
        "name": "Linkedin",
        "url": "https://www.linkedin.com"
      }
    ],
    "copyright": "© 2026",
    "infos": "about this Portfolio",
    "smallTexts": [
      [
        "Design, 3D & motion adapted from <a target='_blank' class='text__link' href='https://www.leoparpeix.com'>Léo Parpeix</a>,",
        "originally developed by <a target='_blank' class='text__link' href='https://twitter.com/LecornuThoma'>Thoma Lecornu</a>."
      ],
      [
        "This version was rebuilt from scratch",
        "with Next.js, React, Three.js and GSAP,",
        "on a custom WebGL render pipeline."
      ],
      [
        "Shipped on <a target='_blank' class='text__link' href='https://aws.amazon.com'>AWS</a> behind a load balancer",
        "and a CDN, with <a target='_blank' class='text__link' href='https://github.com'>CI/CD</a> on every push",
        "to main !"
      ]
    ],
    "bigTexts": [
      "My goal was to build a portfolio as engineered as it looks: a real-time WebGL scene, a custom render pipeline and a single scroll that explains my skill set in under 10 seconds.",
      "Under the hood it's the mindset I bring to production: typed front-end code, stateless back-end services behind a load balancer, cloud infrastructure on AWS, and machine learning models that actually ship, from deep learning research to computer vision running at the edge."
    ],
    "credits": {
      "name": "Thoma Lecornu",
      "link": "https://twitter.com/LecornuThoma"
    }
  }
};
