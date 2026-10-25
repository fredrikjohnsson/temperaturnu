import Homey from 'homey';
import { randomBytes } from 'crypto';
import { getStations, stationId } from '../../lib/api';

class TemperatureDriver extends Homey.Driver {

  private nearestStation?: Promise<{ title: string; stationId: string }>;
  private nearestAt = 0;

  async onPairListDevices() {
    if (!this.nearestStation || Date.now() - this.nearestAt >= 300000) {
      this.nearestAt = Date.now();
      this.nearestStation = this.getNearestStation();
    }
    const station = await this.nearestStation;
    return [{
      name: station.title,
      data: { id: randomBytes(16).toString('hex') },
      settings: { stationid: station.stationId },
    }];
  }

  async getNearestStation(): Promise<{ title: string; stationId: string }> {
    try {
      const lon = this.homey.geolocation.getLongitude();
      const lat = this.homey.geolocation.getLatitude();
      if (typeof lon === 'number' && typeof lat === 'number' && Number.isFinite(lon) && Number.isFinite(lat)) {
        const stations = await getStations({ lat: String(lat), lon: String(lon) }, {
          clientId: Homey.env.TEMPERATUR_CLIENT_ID || 'HomeyAppPairing',
          clientKey: Homey.env.TEMPERATUR_CLIENT_KEY,
        });
        return { title: stations[0].title, stationId: stationId(stations[0].id) };
      }
    } catch {
      this.log('Could not find the nearest station; using Högenorum. Station can be changed in settings.');
    }
    return { title: 'Stenungsund/Högenorum', stationId: 'hogenorum' };
  }

}

module.exports = TemperatureDriver;
