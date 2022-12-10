import Homey from 'homey';
import http from 'http';

class TemperaturnuApp extends Homey.App {

  async onInit() {
    this.log('temperatur.nu app is running...');

    // Action flow card - report temperature
    const reportTemperatureCard = this.homey.flow.getActionCard('report-temperature');
    reportTemperatureCard.registerRunListener(async (args) => {
      this.log('[reportTemperatureAction] Activated with hash: ' + args['hash'] + ' and temperature: ' + args['temperature']);

      const t = this;
      const url = 'http://www.temperatur.nu/rapportera.php?hash=' + args['hash'] + '&t=' + args['temperature'];

      http.get(url, (res) => {
        t.log('[reportTemperatureAction] Response received');
        var body = '';
        res.on('data', (data) => {
          body += data;
        });
        res.on('end', () => {
          if (body.substring(0, 2) == 'ok')
            t.log('[reportTemperatureAction] Response is OK, reporting temperature: ' + args['temperature']);
          else
            t.log('[reportTemperatureAction] Response is not OK');
        });
      }).on('error', (err) => {
        t.log('[reportTemperatureAction] Error: ' + err.message);
      });
      return Promise.resolve(true)
    });

  }
}

module.exports = TemperaturnuApp;
