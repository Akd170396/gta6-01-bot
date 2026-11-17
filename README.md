# gta6-01-bot

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Akd170396/gta6-01-bot/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Akd170396/gta6-01-bot/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmara Nights — an open-world crime game in the fictional sun-soaked coastal city of Solmara. Explore the city on foot and by car, steal cars, outrun the police through a 5-star wanted system, run six story missions for Mara Solis, fight rival gangs, and collect cash stashes — with a HUD, minimap, start screen and saves. Built from scratch in vanilla JavaScript and canvas, no libraries, no network.

## Run it

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080 in desktop Chrome
```

## Play

- **WASD / Arrows** — walk & drive · **Shift** — run
- **E** — enter / exit car (stealing a parked car draws the heat)
- **Mouse** — aim · **Click / Space** — punch · **2 + Click** — fire the pistol
- **M** — mute · **P / Esc** — pause · progress saves automatically

## The game

- **Open world**: a road-grid city with a central park, a beach and marina, traffic cars and pedestrians, all generated from a fixed seed.
- **Wanted system**: crimes raise 0–5 stars; police cars and foot cops chase, ram and bust you. Lay low and the heat cools off.
- **Missions & story**: six jobs for Mara — steal a car, run a package, a timed getaway, shaking the heat, a gang fight at the plaza, and a final yacht escape.
- **Combat**: fists and a pistol, rival Vipers with health bars, damage and knockback.
- **HUD & minimap**: cash, health, wanted stars, objective, speed, and a live minimap with the mission marker and police dots.
- **Save**: progress (cash, missions, position) saves to localStorage; continue from the start screen.

---

<sub>Entered on [make.fun](https://make.fun/?ref=s3svssng&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
