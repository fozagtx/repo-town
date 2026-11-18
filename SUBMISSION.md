# Devpost fields: Repo Town

**Name:** Repo Town
**Tagline (≤140):** Your GitHub repo as a tiny city on your tray table. Pinch a building to open the file, pinch the ground to spin the town. Hands only.
**Track:** Productivity
**Division:** New Experience
**Project link:** https://fozagtx.github.io/repo-town/
**Code:** https://github.com/fozagtx/repo-town
**Target launch date:** December 2026 (playable today in the Meta Quest Browser)

## Description
### Inspiration
On a laptop, a codebase is a list of file names. You can't see its shape: which folder is the downtown, which files are skyscrapers, where a newcomer should start. We wanted to look down at a repo the way you look down at a city from a plane window, in a seat with just your hands.

### What it does
Type any public GitHub repo, or pinch one of the signs in VR, and Repo Town builds it as a city on your tray table. Each top-level folder becomes a district and each file a building, with height set by file size and colour by file type. Pinch a building and the file opens on a floating card beside you. Pinch the empty ground and drag to spin the whole town. One session is a full tour of a codebase in a few minutes, which works for onboarding, code review prep, or poking around an open-source project on the bus.

### How we built it
- WebXR and three.js with no build step, served from GitHub Pages, so it opens instantly in the Meta Quest Browser.
- WebXR Hand Input: we track the thumb tip and index tip every frame. A pinch starts under 2 cm and releases over 3.5 cm, and that hysteresis keeps it stable. The pinch point is hit-tested against building volumes, the file signs and the table surface.
- One GitHub tree API call per repo (recursive), plus raw.githubusercontent.com for file contents.
- The `local` reference space puts the town 35 cm below and 50 cm in front of your head when the session starts, so it passes the airplane-seat test.

### What's next
Commit history as weather (recent changes glow), a two-handed pinch to zoom into a district, private repos via GitHub sign-in, and co-presence so a team can walk the same town in a review.

## Hand interactions
Everything is a pinch. Pinch a building to open it, pinch and drag the ground to rotate, pinch a sign to load another repo. No controller is ever needed. What excites us is VR as a calm second screen, where you understand the shape of something complex at a glance and in a seat.
