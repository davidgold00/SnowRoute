# SnowRoute

SnowRoute is a production-grade winter driving risk analyzer built with Next.js App Router. It evaluates a route across both space and time: the app samples checkpoints along the drive, estimates the ETA for each checkpoint, fetches forecast data for that specific place and time, and produces a transparent winter driving risk score for every segment.

## Stack

- Next.js App Router with TypeScript strict mode
- Tailwind CSS for layout and visual system
- Leaflet + OpenStreetMap tiles for the route map
- OpenRouteService for geocoding and directions
- Open-Meteo for hourly forecast data
- Recharts for the risk timeline
- Zod for request validation
- Vitest for unit coverage

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env.local
```

3. Add your OpenRouteService API key to `.env.local`:

```bash
ORS_API_KEY=your_key_here
```

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Architecture

The app is organized by responsibility so the domain logic stays portable and testable:

- `app/`: Next.js routes, route handlers, layout, and the single-page dashboard shell
- `components/`: interactive UI sections including the form, map, summary panel, table, and chart
- `lib/`: routing, polyline decoding, sampling, weather normalization, risk scoring, and orchestration
- `hooks/`: debounced client search behavior for place suggestions
- `tests/`: focused unit coverage for route sampling and risk logic

### Core domain modules

- `lib/routing.ts`: OpenRouteService geocoding and directions wrappers with cache protection
- `lib/polyline.ts`: encoded polyline decoding
- `lib/sampling.ts`: route interpolation, cumulative distances, and ETA sampling
- `lib/weather.ts`: Open-Meteo normalization, timezone-aware matching, caching, and concurrency control
- `lib/risk.ts`: explainable winter risk scoring, hazard-window grouping, and trip recommendations
- `lib/analysis.ts`: orchestration layer that turns a route request into one normalized analysis payload

## API Choices

### OpenRouteService

OpenRouteService was chosen for two reasons:

- It offers real directions and geocoding with a single API key and low setup friction.
- Its directions response includes encoded geometry that is straightforward to decode and sample.

Browser clients never call ORS directly. The app proxies requests through Next.js route handlers so the key stays server-side and responses can be normalized.

### Open-Meteo

Open-Meteo is the primary weather source because it provides a useful hourly forecast surface without requiring another secret. SnowRoute requests hourly temperature, precipitation, snowfall, visibility, wind speed, gusts, weather codes, and day/night state.

## Risk Model

SnowRoute uses an additive 0-100 score with transparent factors:

- Snowfall or solid precipitation: up to 30 points
- Precipitation near freezing as an icing proxy: up to 20 points
- Subfreezing temperatures: up to 10 points
- Low visibility: up to 15 points
- Wind and gusts: up to 15 points
- Hazardous weather codes such as freezing precipitation, dense fog, heavy snow, and storms: up to 10 points
- Night driving: 5 points

Risk labels:

- `0-24`: Low
- `25-49`: Moderate
- `50-74`: High
- `75-100`: Severe

Trip recommendation rules:

- `Safe`: low overall risk and no sustained High or Severe segments
- `Use caution`: moderate overall risk or non-severe hazard windows
- `Delay recommended`: high overall risk or a brief Severe window
- `Avoid travel`: overall Severe risk or Severe windows covering at least 20% of the route

## Time-Aware Weather Matching

This is the product's core differentiator:

1. The route geometry is decoded and sampled evenly across the drive.
2. ETA is estimated for each sample by distance ratio across the total route duration.
3. Sample ETA is stored in UTC.
4. Open-Meteo forecasts are fetched for rounded route checkpoints with hourly data in each location’s local timezone.
5. Forecast rows are converted back to UTC for reliable comparison.
6. The nearest hourly forecast within a 2-hour tolerance is matched to the route checkpoint.

If snowfall or visibility are missing, the app continues and surfaces data-quality notes instead of failing the whole analysis.

## Testing

Run the unit suite with:

```bash
npm run test
```

Covered areas:

- cumulative distance and interpolation behavior
- sample count clamping and ETA progression
- duplicate coordinate handling
- risk labels and score thresholds
- icing, wind, visibility, night-driving, and severe weather boosts
- hazard window grouping and recommendation escalation

## Future Improvements

- add alternate-route comparison and side-by-side recommendation deltas
- persist recent analyses for trip planning workflows
- add radar overlays and road-condition feeds where available
- introduce saved thresholds or driver profiles for commercial fleets
- batch weather requests further for extremely long routes and premium quotas
