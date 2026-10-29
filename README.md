# temperatur.nu
With this app you can report your outdoor temperature to the Swedish site [temperatur.nu](https://www.temperatur.nu), or get your favorite station as a device.

### Device settings
When a temperature device is created it gets the closest station using geolocation. If geolocation is not available for some reason a default station is used. It is possible to change station ID by going to device settings and then Advanced settings. A station ID is needed for the device to work, and the station ID is the last part of an URL without the html part. To obtain an station ID, navigate to [temperatur.nu](https://www.temperatur.nu) and click on a city of interest. Look at the URL in the address bar and remember the last part. For example, in the URL https://www.temperatur.nu/evenas.html, station ID is evenas.

### Flow support
*Triggers*

At the moment there are four triggers available: 
- The temperature has changed (triggers when temperature has changed) 
- The temperature is updated (triggers every time temperature is fetched from the API)
- The temperature is greater than a set value
- The temperature is less than a set value

*Actions*

One action flow card is available called *Report temperature*. Add the card to a flow and fill in your stations hash code and select a temperature token.

### API usage
The app polls each station every five minutes. Unsigned API requests are limited to 15 per
30 minutes per client and IP address. Three devices can exceed this limit, as can additional
apps sharing the same connection. When requests are blocked, the device becomes unavailable
and retries on the next polling cycle. Signed API access can be configured by the developer.

### ToDo
- Show timestamp of temperature value, this is available in the API.

### Known issues
- Version 1.1.3 or older could crash on Homey v8+, use latest version of the app instead.

### Changelog
- **v3.1.1 (2026-10-29)**
  - Updated App Store descriptions and imagery, added support links and a Swedish readme, and removed outdated sponsor credits.
- **v3.1.0 (2026-10-25)**
  - Stability changes
  - Improved error recovery, polling, station changes and temperature reporting.
  - Secure HTTPS connections and support for temperatur.nu API 1.20.
- **v3.0.5 (2023-04-01)**
  - More error handling
- **v3.0.4 (2023-03-28)**
  - Added some error handling
- **v3.0.3 (2022-12-15)**
  - Fixes to prevent crashes
- **v3.0.2 (2022-12-12)**
  - Complete rebuild to Homey SDKv3
  - Version numbering changed to match Homey SDK version
- **v1.1.3 (2020-09-15)**
  - Updated README
- **v1.1.2 (2020-09-12)**
  - Updated node-fetch to v2.6.1
  - Code clean-up
- **v1.1.1 (2019-04-09)**
  - Bug fixed that make the app crash
- **v1.1.0 (2019-03-22)**
  - Added an action flow card that reports temperature to temperatur.nu
- **v1.0.2 (2019-03-18)**
  - Station ID no longer needs to be in lowercase
  - Temperature is now fetched directly when station ID changed
- **v1.0.1 (2019-03-18)**
  - 1.5.x compatibility fix
- **v1.0.0 (2019-03-17)**
  - First public version
