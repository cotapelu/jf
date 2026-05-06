---
name: weather
label: Weather Checker
description: Check current weather for any location using OpenWeatherMap API
---

# Weather Skill

This skill allows checking current weather conditions for any location using the OpenWeatherMap API.

## 📋 Prerequisites

- OpenWeatherMap API key ([get one free](https://openweathermap.org/api))
- Add your API key to `~/.pi/agent/settings.json`:

```json
{
  "weatherApiKey": "your-openweathermap-api-key"
}
```

## 🚀 Usage

```bash
# Check weather for a city
bash {baseDir}/weather.sh "London"

# Check weather with specific units (metric/imperial)
bash {baseDir}/weather.sh "Tokyo" metric

# Check weather in Fahrenheit
bash {baseDir}/weather.sh "New York" imperial
```

## 💡 Integration with Pi

Once installed in `~/.pi/agent/skills/weather/`, the agent can automatically use this skill:

```
User: What's the weather in Paris?
Agent: Let me check that for you...
Agent: The current temperature in Paris is 18°C with clear skies.
```

## 📦 Installation

### Manual Installation

1. Clone this skill to your skills directory:

```bash
mkdir -p ~/.pi/agent/skills/
cp -r weather ~/.pi/agent/skills/
```

2. Make the script executable:

```bash
chmod +x ~/.pi/agent/skills/weather/weather.sh
```

3. Add your OpenWeatherMap API key to settings:

```bash
# Edit settings.json
nano ~/.pi/agent/settings.json
```

### Automatic Installation (via Pi)

```bash
# Install via pi package system (if published)
pi install git:github.com/user/pi-skills.git

# Or clone manually
pi "Clone weather skill to ~/.pi/agent/skills/"
```

## 🔧 How It Works

The skill uses the OpenWeatherMap Current Weather Data API:

1. Takes a location string (city name, zip code, or coordinates)
2. Makes API request to OpenWeatherMap
3. Parses JSON response
4. Returns formatted weather information

## 📡 API Response Format

```json
{
  "temperature": 22.5,
  "feels_like": 21.8,
  "condition": "Clear",
  "humidity": 65,
  "wind_speed": 3.2,
  "visibility": 10000,
  "location": "London",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## 🌡️ Units

- **metric**: Celsius (°C), meters/second (m/s)
- **imperial**: Fahrenheit (°F), miles/hour (mph)
- **standard**: Kelvin (K), meters/second (m/s)

## 🎯 Example Agent Interactions

### Basic Usage

```
User: Check weather in Berlin
Agent: The current temperature in Berlin is 15°C with partly cloudy skies.
      Humidity: 72%, Wind: 4.1 m/s
```

### Comparison

```
User: Compare weather in London and Tokyo
Agent: Let me check both locations...
Agent: London: 18°C, partly cloudy
Agent: Tokyo: 25°C, sunny
Agent: Tokyo is warmer by 7°C
```

### Planning Activities

```
User: Should I bring an umbrella to New York?
Agent: Let me check the weather in New York...
Agent: Current conditions: 20°C, light rain
Agent: Yes, I'd recommend bringing an umbrella!
```

## 🚨 Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Location not found` | Invalid city name | Check spelling, try different format |
| `API key invalid` | Missing or wrong API key | Verify OpenWeatherMap API key |
| `Network error` | Connection issues | Check internet connection |
| `Rate limited` | Too many requests | Wait or upgrade API plan |

## 📝 Examples

### Shell Usage

```bash
# Current directory
./weather.sh "Paris"

# From anywhere (if in PATH)
weather "Tokyo"

# With logging
./weather.sh "London" >> weather.log
```

### In Scripts

```bash
#!/bin/bash
# Get weather and take action

WEATHER=$(./weather.sh "Berlin" metric)
TEMP=$(echo $WEATHER | jq '.temperature')

if (( $(echo "$TEMP < 10" | bc -l) )); then
    echo "Cold day - wear a jacket!"
fi
```

### With Cron

```bash
# Check weather every morning at 7 AM
0 7 * * * /path/to/weather.sh "Home" >> ~/weather-diary.txt
```

## 🔒 Security Considerations

- **API Key**: Never commit API keys to version control
- **Rate Limits**: Respect OpenWeatherMap's rate limits (60/min free)
- **Data Privacy**: Location data is sent to OpenWeatherMap
- **HTTPS**: All API calls use HTTPS encryption

## 📈 Limitations

- Free tier: 1,000 calls/day
- Updates: Every 10 minutes for current weather
- Historical data: Not available in free tier
- Forecast: Requires different API endpoint

## 🧩 Integration Tips

### With Pi Agent

```typescript
// In your agent configuration
const weatherTool = {
  name: "get_weather",
  label: "Check Weather",
  description: "Get current weather for any location",
  execute: async (location: string) => {
    const result = await bash(`${baseDir}/weather.sh "${location}"`);
    return { content: [{ type: "text", text: result }] };
  }
};
```

### With Other Tools

```bash
# Combine with calendar
if [ $(date +%u) -lt 6 ]; then
  # Weekday
  weather=$(./weather.sh "Office")
  echo "Weekday weather: $weather"
fi
```

## 🆚 Alternatives

| Service | Free Tier | Accuracy | Coverage |
|---------|-----------|----------|----------|
| OpenWeatherMap | 1,000/day | Good | Global |
| WeatherAPI | 1,000,000/month | Excellent | Global |
| AccuWeather | 50/day | Excellent | Global |
| Climacell | 10,000/month | Excellent | USA focused |

## 📚 Resources

- [OpenWeatherMap API Docs](https://openweathermap.org/current)
- [Free API Key Signup](https://home.openweathermap.org/users/sign_up)
- [Weather Icons](https://openweathermap.org/weather-conditions)

## 🤝 Contributing

Feel free to submit issues, fork and create pull requests. Areas for improvement:
- Add forecast functionality
- Support for multiple locations at once
- Weather alerts integration
- Historical data comparison

## 📄 License

MIT - Feel free to use and modify

## 🙏 Acknowledgments

- OpenWeatherMap for free API tier
- Pi team for the skills framework
- Community for feedback and improvements

---

**Last Updated**: 2026-01-15  
**Version**: 1.0.0  
**Author**: Community Contributor
