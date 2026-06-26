# AI Research Foundations for Higher Education

The official website for the **AI Research Foundations for Higher Education** programme: a Train-the-Trainer initiative, funded by Google.org, that equips lecturers at 30 universities across Nigeria, Ghana, Kenya, and South Africa to teach a localised AI curriculum from Google DeepMind.

It is one repository: a programme landing site plus a self-contained mini-site for each workshop. Built with [Hugo](https://gohugo.io/) (static output), deployed to GitHub Pages.

## Run it locally

```bash
hugo server
```

Then open <http://localhost:1313>. Requires Hugo **extended** (v0.161 or newer).

To build the static site into `public/`:

```bash
hugo --gc --minify
```

## The big idea: a workshop is the unit of content

Everything that **differs** between workshops lives in one data entry. Everything **shared** (curriculum, four threads, activities, team, partners, FAQs) lives once at the programme level and is imported everywhere it is needed.

From a single workshop entry, the site generates:

- the workshop landing page `/workshops/<slug>/`
- the schedule page `/workshops/<slug>/schedule/`
- the onboarding guide `/workshops/<slug>/onboarding/`
- the card on `/workshops/`
- the tab on `/gallery/` and the tab on `/testimonials/`

### Add a new workshop

```bash
hugo new workshops/ghana-2027 --kind workshop
```

That scaffolds `content/workshops/ghana-2027/` with three files:

| File | What it holds |
| --- | --- |
| `_index.md` | The **workshop data entry** (all frontmatter: dates, venue, pre-work, links). Edit this. |
| `schedule.md` | A stub. Leave as is. Add a `schedule:` block to `_index.md` to fill it; otherwise it shows "coming soon". |
| `onboarding.md` | A stub. Leave as is. The page is generated from `_index.md`. |

Then drop photos into `static/img/workshops/ghana-2027/gallery/` and set `hasGallery: true`. That is the whole job. No new templates, no copied pages.

To add a testimonial, add one row to `data/testimonials.yaml` tagged with the workshop `slug`. It appears on the workshop page and the matching testimonials tab.

## Where things live

```
content/
  _index.md                 Home
  programme.md              About the Programme
  gallery.md                Gallery (tab per workshop)
  testimonials.md           Testimonials (tab per workshop)
  resources.md              Resources (linktree)
  workshops/
    _index.md               Workshops directory
    <slug>/_index.md        A workshop data entry  <-- edit this to add a workshop
    <slug>/schedule.md      stub
    <slug>/onboarding.md    stub
data/
  programme.yaml            Mission, vision, gains, 8 courses, roadmap, threads, activities, FAQs
  team.yaml                 Shared team members
  testimonials.yaml         Testimonials, tagged by workshop slug
  resources.yaml            Linktree groups and links
layouts/                    Templates and reusable partials (components)
static/img/workshops/<slug>/gallery/   Workshop photos
archetypes/workshop/        Scaffold for `hugo new workshops/<slug> --kind workshop`
```

## Placeholders to fill in

These are flagged in the UI with a badge so they are easy to find:

- **Discord invite link** (`discordURL` in `hugo.toml`, and `links.discord` per workshop).
- **Pre-work deadline date** for Nigeria. The open date (6 July) and the two cohort weeks are confirmed; the deadline is an estimate (`prework.deadlineEstimate: true`).
- **Live Sessions day and time** (`prework.liveSessions: "TBC"`).
- **Real testimonials.** Current ones are samples (`placeholder: true` in `data/testimonials.yaml`).
- **UCL Lecturer Toolkit link** (marked work in progress in `data/resources.yaml`).
- **Workshop and team photos.** Team uses initials avatars; the pilot gallery reuses existing programme photos.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with Hugo extended and publishes to GitHub Pages. The repo is named `aims-ai-research-foundations.github.io`, so the site serves at the org root: <https://aims-ai-research-foundations.github.io/>.

The original Cape Town pilot site, the quizzes, and the Spot the Slop game remain hosted separately at <https://aims-ai-research-foundations.github.io/pilot-workshop/> and are linked from the Resources page.

## Brand

Indigo `#361A54`, gold `#FDD633`. Headings in Archivo Black, body in Arial. No em dashes in copy. Accessibility is a priority: semantic landmarks, skip link, visible focus, keyboard-operable tabs, WCAG AA contrast, and reduced-motion support.

© 2026 AIMS South Africa. Content licensed CC BY 4.0.
