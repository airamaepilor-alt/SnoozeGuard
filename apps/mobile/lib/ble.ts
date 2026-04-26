import { BleManager } from "react-native-ble-plx";

export const SG_SERVICE_UUID    = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
export const SG_CMD_CHAR_UUID   = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
export const SG_EVENT_CHAR_UUID = "beb5483f-36e1-4688-b7f5-ea07361b26a8";

// Singleton — never recreate BleManager
let _mgr: BleManager | null = null;
export function getBleManager(): BleManager {
  if (!_mgr) _mgr = new BleManager();
  return _mgr;
}

export function bleDeviceName(deviceId: string): string {
  return `SG-${deviceId}`;
}
