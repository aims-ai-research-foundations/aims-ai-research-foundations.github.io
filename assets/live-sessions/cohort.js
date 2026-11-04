/* Cohorts. Each one gets its own page at /cohort/<slug>, its own live room and its own presenter link
   (/cohort/<slug>?host&k=KEY). List the live sessions the cohort has had, with its dates and cover images;
   held and cover override what the quiz files say, so the quizzes themselves stay cohort-neutral.
   To add a cohort: add an entry below and its covers under /img/<slug>/ (see README). */
"use strict";
const COHORTS = {
  "western-cape": {
    name: "Western Cape cohort",
    flag: "🇿🇦",
    blurb: "The first cohort to have the live sessions online: four sessions on Courses 01 to 04, ahead of the workshop week in Cape Town.",
    sessions: {
      "live-session-1": { held: "Held live on Thursday 8 October 2026", cover: "/img/live-session-1.jpg" },
      "live-session-2": { held: "Held live on Wednesday 28 October 2026", cover: "/img/live-session-2.jpg" },
      "live-session-3": { held: "Held live on Thursday 29 October 2026", cover: "/img/live-session-3.jpg" },
      "live-session-4": { held: "Held live on Wednesday 4 November 2026", cover: "/img/live-session-4.jpg" },
    },
  },
};
