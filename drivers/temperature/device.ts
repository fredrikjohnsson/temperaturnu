import Homey from 'homey';

const fetch = require('node-fetch');

const baseUrl = 'api.temperatur.nu/tnu_1.17.php';
const apiInfo = 'Temperatur.nu API 1.17';

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
    } else {
      this.log('[TemperatureDevice] Station ID is missing in settings');
    }

    // Set to fetch temperature at an interval
    setInterval(this.fetchTemperature.bind(this), POLL_INTERVAL);
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
    if (this.getSetting('stationid') != null) {
      this.log('TemperatureDevice was renamed, fetching temperature');
      this.fetchTemperature();
    }
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

    if (jsonData != '' && jsonData != undefined) {
      // Extract data from JSON
      const jsonObj = JSON.parse(jsonData);
      const title = jsonObj.title;

      // Verify that correct API info is in JSON data
      if (title != apiInfo) { 
        this.log('[fetchTemperature] API info is not correct in JSON data');
        return Promise.resolve(false)
      }

      // Extract temperature from JSON
      let temperature = jsonObj.stations[0].temp;

      // Check for undefined temperature
      if (temperature != undefined) { 
        temperature = parseFloat(temperature)
      } else {
        this.log('[fetchTemperature] Temperature is undefined in JSON');
        return Promise.resolve(false)
      }

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
      temperatureUpdatedCard.trigger(this, {'temperature': temperature}).catch(this.error);
      
      return Promise.resolve(true)
    }
    
    this.log('[fetchTemperature] No JSON data, can not get temperature');
    this.setUnavailable().catch(this.error);
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
    let response;
    try {
      response = await fetch('http://' + url);  
    } catch (err) {
      this.log('[fetchData] Error during fetch: ' + err);
      return '';
    }
    

    // Take care of not ok responses
    if (!response.ok) {
      this.log('[fetchData] Response not OK from API, no data returned');
      return '';
    }

    // Parse JSON data
    let jsonData;
    let jsonObj;
    try {
      jsonData = await response.text();
      jsonObj = JSON.parse(jsonData);
    } catch (err) {
      this.log('[fetchData] JSON not valid, aborting..');
      return '';
    }
    
    // Check if station is available in result
    let station;
    try {
      station = jsonObj.stations[0];
    } catch (err) {
      this.log('[fetchData] Stations are missing from API call, aborting..');
      return '';
    }

    // Return JSON if not max API calls have been reached
    const client = jsonObj.client;
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
