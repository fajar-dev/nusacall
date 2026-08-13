/**
 * DeviceManager for audio input/output device enumeration & preference persistence
 * Spec: 06-REALTIME-WEBRTC-SPEC.md §4.6
 */

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  groupId?: string;
}

export class DeviceManager {
  private static readonly STORAGE_KEY_INPUT = 'nusacall:selected_input_device';
  private static readonly STORAGE_KEY_OUTPUT = 'nusacall:selected_output_device';

  public async getAudioInputDevices(): Promise<AudioDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || `Mikrofon (${d.deviceId.slice(0, 5)})`,
        groupId: d.groupId,
      }));
  }

  public async getAudioOutputDevices(): Promise<AudioDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || `Speaker (${d.deviceId.slice(0, 5)})`,
        groupId: d.groupId,
      }));
  }

  public getSavedInputDeviceId(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(DeviceManager.STORAGE_KEY_INPUT);
  }

  public saveInputDeviceId(deviceId: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DeviceManager.STORAGE_KEY_INPUT, deviceId);
    }
  }

  public getSavedOutputDeviceId(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(DeviceManager.STORAGE_KEY_OUTPUT);
  }

  public saveOutputDeviceId(deviceId: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DeviceManager.STORAGE_KEY_OUTPUT, deviceId);
    }
  }
}
