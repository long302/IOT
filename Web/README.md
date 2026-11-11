# Better Life

Dark blue/green dashboard for the sensor device used in this project.

## Run locally

1. Install dependencies from the project root: `npm install`.
2. Copy `server/.env.example` to `server/.env`, then set the ThingsBoard URL/key and AI URL/key.
3. Run `npm run dev`. The dashboard is available at `http://localhost:5173`; the API runs at `http://localhost:3001`.
4. Open **Settings** and enter the ThingsBoard Device ID.

The dashboard reads `air quality`, `bluzzer`, `fan`, `flame`, `nito`, and `temp` every 5 seconds. Each successful poll appends a timestamped snapshot to `server/data/<Device ID>/history.json`; **Diagram** reads its chart data from that file and can reset it. Each device file keeps the latest 20,000 snapshots. **Notifications** stores sensor transitions and command activity in the current browser.

## Device controls

The fan, buzzer, and Nito Valve controls send commands through the Node.js server. The command values match the device firmware:

```json
{"method":"setFan","params":true}
{"method":"setBuzzer","params":false}
{"method":"setNito","params":true}
```

The Home page shows the Nito Valve state and provides a manual control. **Settings → Nito Valve manual control** activates or locks that Home control. The preference is stored in the current browser. The device should publish the `nito` telemetry key as a boolean so the displayed valve state follows the device.

The device must be online and connected to ThingsBoard to receive commands. When Cooking mode is off, the configured gas condition turns the fan on; it turns off when that condition clears only if the threshold rule turned it on. While Cooking mode is on during an alert, its selected fan and buzzer actions take priority over automatic controls, and the Nito Valve stays closed. When Cooking mode is off, AI controls the fire response. Since `air quality` is a raw ADC value, set and calibrate its threshold in **Settings**.

ThingsBoard and AI API keys stay on the server in `server/.env`; they are never sent to the browser.

## AI fire detection

Copy `server/.env.example` to `server/.env`, then set `AI_API_URL` and `AI_API_KEY`. The dashboard sends one sample whenever the latest temperature or infrared reading changes. Project telemetry `temp` is sent as `temperature`, and `flame` is sent as `infrared` (1 means flame detected).

The backend exposes `POST /api/ai/sensor-data` with `device_id`, `temperature`, and `infrared`, and returns the AI service result. The AI needs at least 10 samples for each device. The risk levels map to statuses and actions as follows:

| risk_level | status | action |
| --- | --- | --- |
| `UNKNOWN` | `COLLECTING` | No action |
| `LOW` | `NORMAL` | When Cooking mode is off, turn off the buzzer and Nito Valve if AI turned them on; leave manually controlled states unchanged. |
| `MEDIUM` | `ANOMALY` | When Cooking mode is off, turn on buzzer. When it is on, use its configured fan and buzzer actions. Notify “There is a risk of fire.” |
| `HIGH` | `FLAME_SIGNAL` | When Cooking mode is off, turn on the fan and buzzer and open Nito Valve. When it is on, use its configured fan and buzzer actions and keep Nito Valve closed. Notify “Fire detected.” |

