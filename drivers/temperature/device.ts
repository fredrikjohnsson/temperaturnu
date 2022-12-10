import Homey from 'homey';

const fetch = require('node-fetch');

const baseUrl = 'api.temperatur.nu/tnu_1.17.php';

class TemperatureDevice extends Homey.Device {
  async onInit() {
    this.log('TemperatureDevice has been initialized');

    const POLL_INTERVAL = 300000; // 5 minutes
    const stationId = this.getSetting('stationid');

    // Check if station ID is set
    if (stationId != null) {
      // Fetch temperature
      this.log('[TemperatureDevice] Fetching temperature');
      this.fetchTemperature();

      // Set to fetch temperature at an interval
      setInterval(this.fetchTemperature.bind(this), POLL_INTERVAL);
    } else {
      this.log('[TemperatureDevice] Station ID is missing in settings');
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('TemperatureDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings(event: { oldSettings: {}, newSettings: {}, changedKeys: [] }): Promise<string|void> {
    if (this.getSetting('stationid') != null) {
      this.log('TemperatureDevice settings where changed, fetching temperature');
      this.fetchTemperature();
    }
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('TemperatureDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('TemperatureDevice has been deleted');
  }

  async fetchTemperature(): Promise<boolean|void> {
    // Get station ID
    const stationId = this.getSetting('stationid');

    // Fetch JSON with lowercase station ID
    const jsonData = await this.fetchData(stationId.toLowerCase());

    if (jsonData != '') {
      // Extract temperature from JSON
      const jsonObj = JSON.parse(jsonData);
      const temperature = parseFloat(jsonObj.stations[0].temp);        

      // Save temperature
      const varType = typeof(temperature);
      if (varType != 'number' || isNaN(temperature)) {
        this.log('[fetchTemperature] Variable is not of type number (is ' + varType + ') or temperature is NaN: ' + temperature);
        return Promise.resolve(false);
      }
  
      this.log('[fetchTemperature] Setting temperatur to ' + temperature);
      this.setCapabilityValue('measure_temperature', temperature).catch(this.error);

      // Temperature updated trigger
      const temperatureUpdatedCard = this.homey.flow.getDeviceTriggerCard('temperature-updated');
      temperatureUpdatedCard.trigger(this, {'temperature': temperature});
      
      return Promise.resolve(true)
    }
    
    this.log('[fetchTemperature] No JSON data, can not save temperature');
    return Promise.resolve(false);
  }

  async fetchData(stationId: string): Promise<string> {
    this.log('[fetchData] Start');
    
    const deviceId = this.getData().id;
    const cli = 'HomeyApp' + deviceId;

    // Build URL without http://, prepared for md5 hash
    const url = baseUrl + '?p=' + stationId + '&cli=' + cli;

    // Make API call
    this.log('[fetchData] Fetching data using unsigned URL')
    let response = await fetch('http://' + url);

    // Take care of not ok responses
    if (!response.ok) {
      this.log('[fetchData] Response not OK from API, no data returned');
      return '';
    }

    // Parse JSON data and extract title
    const jsonData = await response.text();
    const jsonObj = JSON.parse(jsonData);
    const client = jsonObj.client;

    // Return JSON if not max API calls have been reached
    if (client == 'unsigned') {
      this.log('[fetchData] Returning JSON data');
      this.setWarning(null);
      return jsonData;
    } else {
      this.log('[fetchData] To many API calls, returning nothing');
      this.setWarning('To many API calls, temperature not updated');
      return '';
    }
  }
}

module.exports = TemperatureDevice;
