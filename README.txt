With this app you can report your outside temeprature to the Swedish site temperatur.nu, or get your favorite station as a device.

Device settings
After a temperature device is created, go to app settings and then Advanced settings. A station ID is needed for the device to work, and the station ID is the last part of an URL without the html part. To obtain an station ID, navigate to temperatur.nu and click on a city of interest. Look at the URL in the address bar and remember the last part. For example, in the URL https://www.temperatur.nu/evenas.html, station ID is evenas.

Flow support
Triggers

At the moment there are four triggers available:
* The temperature has changed (triggers when temperature has changed) 
* The temperature is updated (triggers every time temperature is fetched from the API)
* The temperature is greater than a set value
* The temperature is less than a set value

Actions

One action flow card is available called Report temperature. Add the card to a flow and fill in your stations hash code and select a temperature token.

Acknowledgement
 - Many thanks to m.nu for sponsoring the reporting flow card.
