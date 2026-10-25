import Homey from 'homey';
import {
  getStations, RequestHandle, stationId, temperatureValue,
} from '../../lib/api';

const POLL_INTERVAL = 300000;

class TemperatureDevice extends Homey.Device {

  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<boolean>;
  private request: RequestHandle = {};
  private stopped = false;
  private revision = 0;
  private station: unknown;

  async onInit() {
    this.station = this.getSetting('stationid');
    await this.fetchTemperature();
  }

  async onSettings({ newSettings, changedKeys }: { newSettings: object; changedKeys: string[] }): Promise<void> {
    if (!changedKeys.includes('stationid')) return;
    const nextStation = stationId((newSettings as { stationid?: unknown }).stationid);
    if (nextStation === this.station) return;
    this.station = nextStation;
    this.revision += 1;
    this.request.cancel?.();
    this.clearTimer();
    await this.inFlight;
    await this.fetchTemperature();
  }

  private clearTimer() {
    if (this.timer) this.homey.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private stop() {
    this.stopped = true;
    this.revision += 1;
    this.clearTimer();
    this.request.cancel?.();
  }

  async onDeleted() {
    this.stop();
  }

  async onUninit() {
    this.stop();
  }

  async fetchTemperature(): Promise<boolean> {
    if (this.stopped) return false;
    if (this.inFlight) return this.inFlight;
    this.clearTimer();
    this.inFlight = this.updateTemperature(this.revision);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = undefined;
      if (!this.stopped) {
        this.timer = this.homey.setTimeout(() => {
          this.fetchTemperature().catch((error) => this.error(error));
        }, POLL_INTERVAL);
      }
    }
  }

  private async updateTemperature(revision: number): Promise<boolean> {
    const isCurrent = () => !this.stopped && revision === this.revision;
    try {
      const id = stationId(this.station);
      const stations = await getStations({ p: id }, {
        clientId: Homey.env.TEMPERATUR_CLIENT_ID || `HomeyApp${this.getData().id}`,
        clientKey: Homey.env.TEMPERATUR_CLIENT_KEY,
      }, this.request);
      if (!isCurrent()) return false;
      const station = stations.find((item) => item.id === id);
      if (!station) throw new Error('Requested station was not returned by the service');
      const temperature = temperatureValue(station.temp);
      await this.setCapabilityValue('measure_temperature', temperature);
      if (!isCurrent()) return false;
      await this.setAvailable();
      await this.unsetWarning();
      if (!isCurrent()) return false;
      await this.homey.flow.getDeviceTriggerCard('temperature-updated').trigger(this, { temperature });
      this.log(`Temperature updated: ${temperature}`);
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      const message = error instanceof Error ? error.message : 'Temperature update failed';
      this.error(message);
      await this.setUnavailable(message).catch((failure) => this.error(failure));
      return false;
    }
  }

}

module.exports = TemperatureDevice;
