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

SnowRoute uses an explainable 0-100 winter-driving score for every route checkpoint. The model is intentionally conservative around hazards that can make an ordinary passenger-vehicle trip unsafe quickly: freezing rain, near-whiteout visibility, snow plus wind, severe storm codes, and night driving.

The scoring logic lives in `lib/risk.ts`. The response shape for the detailed explanations lives in `lib/types.ts`, and the risk tests live in `tests/risk.test.ts`.

### Per-checkpoint score factors

Each checkpoint starts at 0 and adds transparent risk factors:

- Snowfall or solid precipitation: starts above `0.15 cm`, scales up to `34` points by about `3.5 cm`, and snow forecast codes add a minimum snow signal.
- Icing / near-freezing precipitation: precipitation or freezing-precipitation codes between `-3C` and `1C` can add up to `32` points.
- Subfreezing temperatures: below `0C` can add up to `8` points, with deeper cold treated as more likely to preserve slick surfaces.
- Reduced visibility: below `8 km` adds risk, scaling up to `28` points by `0.4 km`.
- Wind and gusts: starts at `35 kph`, scales up to `22` points by about `90 kph`.
- Hazardous weather codes:
  - freezing drizzle/rain: `24-42` points depending on intensity
  - heavy snow / snow showers: `18-20` points
  - thunderstorms / hail: `18-32` points
  - fog / dense fog: `8-12` points
- Night driving: before 7 AM or after 7 PM local time adds `6` points.

### Critical score floors

Some combinations are dangerous enough that SnowRoute forces a minimum score even if the additive score would otherwise be lower:

- Freezing drizzle/rain forces at least `60`; dense or heavy freezing precipitation forces at least `75`.
- Visibility at or below `0.8 km` forces at least `55`.
- Visibility at or below `0.4 km` forces at least `65`.
- Snow plus visibility at or below `0.8 km` plus wind at or above `45 kph` forces at least `75`.
- Snow plus visibility at or below `0.4 km` plus wind at or above `56 kph` forces at least `90`.
- Snow plus gusts at or above `70 kph` forces at least `70`.
- Severe thunderstorm with hail forces at least `70`.

Risk labels:

- `0-24`: Low
- `25-49`: Moderate
- `50-74`: High
- `75-100`: Severe

### Hazard windows

A hazard window is created when one or more route checkpoints score `50+` (`High` or `Severe`). Nearby high-risk checkpoints are merged across short lower-risk gaps so the UI shows a practical travel window instead of noisy individual alerts.

Trip recommendation rules:

- `Safe`: low overall risk and no sustained High or Severe segments
- `Use caution`: moderate overall risk or non-severe hazard windows
- `Delay recommended`: high overall risk or a brief Severe window
- `Avoid travel`: overall Severe risk or Severe windows covering at least 20% of the route

The trip's overall score is a blend of the route average and the worst checkpoint:

```text
overallScore = averageScore * 0.6 + maxScore * 0.4
```

That means one bad pocket matters, but a long route with only a short bad stretch is not treated the same as a route that is dangerous end to end. Severe hazard-window coverage can still escalate the recommendation to `Avoid travel`.

### Guidance shown to users

For every checkpoint, hazard window, and trip summary, SnowRoute now returns structured guidance:

- `headline`: the risk level and dominant causes
- `impact`: what that means for real driving
- `gamePlan`: the recommended action

For anything above `Low`, the app explains why it is risky and how to respond. Examples include delaying the trip, stopping before the worst segment, avoiding cruise control, increasing following distance, treating bridges and ramps as icy, avoiding exposed highways in high wind, and waiting until a flagged window passes.

### Calibration note

This is a deterministic forecast-based heuristic, not an official road-closure or emergency-management system. The thresholds are aligned with common winter-driving safety concepts and warning-style triggers such as dense fog / blizzard-level visibility, freezing precipitation, strong wind, snow squalls, and hail. Actual safety still depends on tires, vehicle type, driver experience, road treatment, traffic, terrain, and rapidly changing local conditions.

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
