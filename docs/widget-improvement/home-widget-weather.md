# Weather

Widget id: `home-widget-weather`

City caption, CRT degree and a sun/cloud/rain glyph, one footer glance. Click opens the instrument in `components/Home/weather-instrument.tsx`. Chrome is `home-widget-dialog.tsx` and `home-overview.tsx`. Catalog and glance math are `lib/home-widgets.ts`. Tides are `lib/tide-client.ts`.

## Data source + snapshot

**Place — live LevelDB.** `~/Library/Application Support/cogs/Local Storage/leveldb`, origin `http://localhost:3000`, key `brain2-home-weather` (version 1). The `cogs-home-weather` twin is the same object. `brain2-data-profile` is absent, so this is the live vault.

| Field | Value |
| --- | --- |
| cityQuery | San Diego, California |
| cityName | San Diego |
| lat, lng | 32.71571, -117.16472 |
| stationId | null |
| beachLabel | null |

**Fallback city.** `brain2-user-settings` version 4, `homeCity` `San Diego, California`. That blob has no temperature unit. The request hard-codes `temperature_unit=fahrenheit` and `wind_speed_unit=mph`. The face prints a bare `°`.

**Layout.** `brain2-home-widgets` version 9. Weather is on the strip (sixth in `order`, not in `hidden`). `widgetsFollowClock` is true, so the square uses the wall clock. `brain2-home-date` is `2026-09-24` and `brain2-home-date-follows-today` is `0`. The Home day and the weather day are two clocks. The 22:57 forecast request used `start_date=2026-10-09`, which matches the wall clock.

**Hub, discarded.** `data/shared-persist.json` (`updatedAt` `2026-10-10T06:05:30.647Z`, source `electron`) still stores `brain2-home-weather` as Portland, Oregon (45.52345, -122.67621) and `widgetsFollowClock` false. Live LevelDB wins.

**Forecast.** The pin store does not keep a reading. The app cache is in-memory only (`home-wx:32.716,-117.165:2026-10-09`, 30-minute TTL, no stored fetched-at). The body on disk is Chromium’s HTTP cache, `Cache/Cache_Data/af0790455dbfaa13_0`:

- HTTP 200. Date `Sat, 10 Oct 2026 05:57:56 GMT` (22:57:56 PDT). File mtime 2026-10-09 22:57:56 local.
- `current.time` `2026-10-09T22:45`. Inside the 30-minute TTL at 23:09 PDT. This reading is fresh.
- Payload units: `°F`, `mp/h`.

What the face computes from that body:

- Clear, current WMO 0, **69°** (`temperature_2m` 69.1), sun glyph.
- High **82°** / low **69°** (81.9 / 68.8). Humidity **91%**. Feels **73°** (73.2). Wind **5 mph** (4.8), gusts **9** (8.7).
- Rain chance **1%** (hour 22). Visibility **9.6 mi** (15400 m at 22:00). UV **0** at 22:00. Sunrise 6:48 AM, sunset 6:22 PM.
- The day’s daily `weather_code` is **3** (Overcast). Evening hours are code 0.
- Week in the same body: Oct 10 code 51, 79.4°/68.5°, rain 44%. Oct 11 code 65, 68.7°/64.4°, rain 96%.

**Error earlier the same evening.** At 18:01 PDT the archive fallback for this pin sent `end_date=2026-10-15`. Archive returned `error: true`, reason `Parameter 'end_date' is out of allowed range from 1940-01-01 to 2026-10-10` (`42777f61b35124dd_0`, 100 bytes). The next request was 2025-10-09 through 2025-10-15 (`916266939768b575_0`). That Friday was heavy rain, code 65, high 78.1°F, and `precipitation_probability_max` was null. `parseHomeDayWeather` turns `error: true` into null, so the year-back loop is what fills the face, with `typical: true`.

**Tide and air.** No `tidesandcurrents.noaa.gov` body and no air-quality body in that HTTP cache. With `beachLabel` null, `pickTideStation` still maps the text “San Diego” to station `9410230` (La Jolla Scripps).

**GPS.** Last `brain2-gps-place-samples` point is 32.738527, -117.253771 at 2026-10-09 23:09 PDT, about 5 miles west of the weather pin. The caption stays “San Diego”.

## a. Biggest problems right now

1. **The glance describes 3p after 3p is gone.** At hour 23, `weatherLaterGlance` finds no later hour and falls back to the whole day, so the footer is `Clear · warmer 81° by 3p` (hourly peak 81.0° at 15:00). The detail story capitalizes the clause after the dot and says the same thing. The only hour left in this payload is 23:00 at 68.8°, code 0. The change that is actually ahead is Saturday’s 44% drizzle and Sunday’s 96% heavy rain.

2. **A failed forecast becomes last year.** The widget asks the archive for six days past the start. That `end_date` is outside the archive window, the error body parses as null, and the 2025-10-09 fetch is labeled typical. On 2026-10-09 at 18:01 that year-ago day was heavy rain with a null rain probability, so the rain plate would read “Rain chance unknown” on code 65. A thrown fetch clears the tile to “No reading.” There is no last-good reading and no time on the face.

3. **Today disagrees with itself, and 11pm has no chip.** Daily code 3 paints a cloud on today’s week cell. Current code 0 paints a sun on the CRT. The strip is 6a, 9a, 12, 3p, 6p, 9p. Hour 23 is two hours from 9p, so `is-now` matches nothing.

4. **The coast is blank.** Station and beach are null, NOAA has no cached body, and `weatherTideHint` is never called from the tile. The `.home-weather-tide-hint` rule is unused. GPS is already on the Ocean Beach side of the point.

## b. Layout, UI, design, and style

### Overview

The square is one button: caption, CRT, footer (`home-overview.tsx`, class `home-tile is-weather`). That matches the strip in `docs/DESIGN_STYLE.md`: equal-height wells, one job, phosphor in the glass. The caption pip is `#7ec8ff`. The degree and the 16px glyph use `--hab-crt-green` (`#7dffc4`) on the CRT well.

The glyph has three drawings. Code 0 and 1 are the sun, which is right for this 69° clear hour. Code 2, fog, and snow share the cloud. Rain, drizzle, and thunder share the cloud with three strokes.

The footer is the only sentence. It is 10px, two lines, max height 44px (`.hab-score-sub`). Tonight it spends those two lines on a peak that already happened. High, low, the 1% rain, and Saturday’s rain have no place on the square. The tide hint was written (`↑ …` in `weatherTideHint`) and never mounted.

### Detail view

`WeatherDetailDialog` carries `home-weather-dialog home-widget-dialog home-widget-instrument`. The silver handheld is `min(88vh, 820px)` tall, 18px radius, and the body scrolls. City search and the beach chips sit above the temperature. The thing the click was for is below a search field and a wrapping row of coasts.

Condition, story, facts, the sun line, and the section labels are each their own LCD plate (`--friend-lcd`, 6px radius). One forecast is split into a stack of wells. Rain is said three times from this payload: the plate (`Dry — only 1% chance of rain`), the story (that sentence again, plus humidity 91%, UV 0, 9.6 mi, wind 5 mph), and the facts line (`H 82° · L 69° · 91% humidity · UV 0 · 9.6 mi vis · 5 mph · gusts 9`).

The condition uses `--friend-nixie` (`#4a7fd4`) and `text-shadow: 0 0 6px rgba(255, 120, 20, 0.7)`. That bloom is orange. The component header asks for phosphor, metal, and Win95 navy. `docs/DESIGN_STYLE.md` phosphor is the one green `#7dffc4`. Week names and rain percents are 8px, under the 9px nameplate floor.

The needle is the honest part tonight: rounded temp equals the rounded low, so it rests on the left stop. The spark can mark hour 23. The chips cannot. The tide well (station, now, next high, next low, spark) is already one instrument. This session has no NOAA body to put in it.

## c. New features for the detail view

1. **From this hour, then the change.** Start the strip at the current hour and run it into the morning, with 23:00 at 68.8° marked. One line for the next change in this fetch: Saturday code 51, 44% rain, and Sunday code 65, 96% rain, high 69°. Once `nowHour` is past the peak, drop “warmer 81° by 3p” from the story.

2. **Keep the reading.** Show observation time `2026-10-09T22:45` and fetch time 22:57 PDT on the face. On a failed forecast, keep this body. Send the archive an end date inside its window (this error stopped at 2026-10-10). Leave 2025-10-09 off the face.

3. **A beach that does not move the thermometer.** Choosing a beach writes `stationId` and `beachLabel` and leaves the city at 32.71571, -117.16472. Offer Ocean Beach from the GPS point (32.738527, -117.253771) on station `9410230`, and fill the tide well that is already in the dialog. The caption stays San Diego until a beach is chosen.

4. **One facts bay.** High 82°, low 69°, feels 73°, humidity 91%, wind 5 mph, gusts 9, visibility 9.6 mi. The story stays a sentence. The rain plate stays the only rain line. Leave UV 0 out of the night sentence. Paint today’s week cell from the current code (sun, code 0) so it matches the CRT.

5. **A day in the week opens that day.** Saturday and Sunday are the useful part of this payload. Choosing a cell should replace the face with that day’s high, low, code, and rain, with the city pin left as it is.
