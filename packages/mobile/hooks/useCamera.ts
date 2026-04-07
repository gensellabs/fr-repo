import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { PhotoEntry } from '../store/incidentDraft';

// Permanent photo storage directory inside the app's documents folder
const PHOTO_DIR = `${FileSystem.documentDirectory}incident_photos/`;

async function ensurePhotoDir() {
  // makeDirectoryAsync with intermediates:true is safe to call even if dir exists
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
}

export function useCamera() {
  const [requesting, setRequesting] = useState(false);

  async function capturePhoto(patientNumber?: number): Promise<PhotoEntry | null> {
    setRequesting(true);
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) {
        alert('Camera permission is required to capture scene photos.');
        return null;
      }

      // Request GPS simultaneously
      const locPerm = await Location.requestForegroundPermissionsAsync();

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        exif: true,
      });

      if (result.canceled || !result.assets[0]) return null;

      const asset = result.assets[0];

      // ── Copy to permanent storage so the URI survives app restarts ──────────
      await ensurePhotoDir();
      const fileName = `photo_${Date.now()}.jpg`;
      const permanentUri = `${PHOTO_DIR}${fileName}`;
      await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });

      // ── Capture GPS location ─────────────────────────────────────────────────
      let latitude: number | null = null;
      let longitude: number | null = null;
      let altitude: number | null = null;

      if (locPerm.granted) {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
          altitude = loc.coords.altitude ?? null;
        } catch {
          // GPS unavailable — photo still captured, just without coords
        }
      }

      return {
        uri: permanentUri,
        latitude,
        longitude,
        altitude,
        capturedAt: new Date().toISOString(),
        patientNumber,
        uploaded: false,
      };
    } finally {
      setRequesting(false);
    }
  }

  return { capturePhoto, requesting };
}
