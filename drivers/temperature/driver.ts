import Homey from 'homey';

class TemperatureDriver extends Homey.Driver {

  async onInit() {
    this.log('TemperatureDriver has been inited');
  }

  async onPairListDevices() {
    return [
      {
        name: 'Temperature',
        data: {
          id: guid(),
        },
      },
    ];
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