import Homey from 'homey';
import { reportTemperature } from './lib/api';

class TemperaturnuApp extends Homey.App {

  async onInit() {
    this.homey.flow.getActionCard('report-temperature').registerRunListener(async (args) => {
      await reportTemperature(args.hash, args.temperature);
      this.log('Temperature report accepted');
      return true;
    });
    this.log('temperatur.nu app is running');
  }

}

module.exports = TemperaturnuApp;
