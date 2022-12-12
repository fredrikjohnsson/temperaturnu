import Homey from 'homey';

const fetch = require('node-fetch');

class TemperatureDriver extends Homey.Driver {

  async onInit() {
    this.log('TemperatureDriver has been inited');
  }

  async onPairListDevices() {
    const station = this.getNearestStation();
    this.log('[onPairListDevices] Using station: ' + (await station).title + ', ID: ' + (await station).stationId);
    
    return [
      {
        name: (await station).title,
        data: {
          id: guid(),
        },
        settings: {
          stationid: (await station).stationId,
        },
      },
    ];
  }

  async getNearestStation(): Promise<{title: string, stationId: string}> {
    // Get current geolocation
    const lon = this.homey.geolocation.getLongitude();
    const lat = this.homey.geolocation.getLatitude();
    
    // Create a temporary client ID
    const cli = 'HomeyApp' + guid();
    
    // Check if geolocation is set
    if (lon && lat) {
      // Make API call
      const url = 'http://api.temperatur.nu/tnu_1.17.php?lat='+ lat +'&lon=' + lon + '&cli=' + cli;
      let response = await fetch(url);

      // If API call was successful, extract title and station ID and return that
      if (response.ok) {
        const jsonData = await response.text();
        const jsonObj = JSON.parse(jsonData);
        const title = jsonObj.stations[0].title;
        const stationId = jsonObj.stations[0].id;
        return {title, stationId};
      }
    }
    
    // Something when wrong when getting location, use default
    const title = "Stenungsund";
    const stationId = 'hogenorum';
    return {title, stationId};
  }

}

module.exports = TemperatureDriver;

/*
  Generation of device id
*/
function guid() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}