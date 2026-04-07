import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../services/api';
import { PhotoEntry } from '../store/incidentDraft';

const QUEUE_KEY        = 'sync_queue';
const LOV_CACHE_KEY    = 'lov_cache';
const ID_MAP_KEY       = 'incident_id_map';   // localId → server numeric id
const LOV_CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Pure-JS UUID (no native deps) ───────────────────────────────────────────
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface PhotoQueueMeta {
  uri: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  capturedAt: string;
  patientNumber?: number;
}

interface SyncQueueItem {
  id: string;
  type: 'incident' | 'photo';
  payload?: unknown;
  // For photo items — one of these will be set:
  incidentLocalId?: string;   // used when incident was queued offline
  incidentServerId?: number;  // used when incident already created on server
  photoMeta?: PhotoQueueMeta;
  createdAt: string;
  attempts: number;
}

// ─── ID-map helpers ───────────────────────────────────────────────────────────
async function storeServerId(localId: string, serverId: number) {
  const raw = await AsyncStorage.getItem(ID_MAP_KEY);
  const map: Record<string, number> = raw ? JSON.parse(raw) : {};
  map[localId] = serverId;
  await AsyncStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
}

async function lookupServerId(localId: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(ID_MAP_KEY);
  if (!raw) return null;
  return (JSON.parse(raw) as Record<string, number>)[localId] ?? null;
}

// ─── Upload a single photo and delete the local file on success ───────────────
// Returns true  → uploaded (or file already gone — nothing left to do)
// Returns false → transient failure, caller should retry
async function uploadAndClean(
  serverId: number,
  meta: PhotoQueueMeta,
): Promise<boolean> {
  // Guard: if the file no longer exists (e.g. app reinstall wiped the
  // container or the Expo experience sandbox changed), skip silently.
  // There is nothing to upload, so treat this as "done".
  const info = await FileSystem.getInfoAsync(meta.uri);
  if (!info.exists) {
    console.warn('[sync] Photo file missing, dropping from queue:', meta.uri);
    return true;   // done — remove from queue
  }

  try {
    await api.uploadPhoto(serverId, meta.uri, {
      latitude:  meta.latitude  ?? undefined,
      longitude: meta.longitude ?? undefined,
      altitude:  meta.altitude  ?? undefined,
      capturedAt: meta.capturedAt,
    });
    // Server confirmed receipt — delete local file
    await FileSystem.deleteAsync(meta.uri, { idempotent: true });
    return true;
  } catch {
    return false;  // transient failure — caller will retry
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSync() {
  const [isOnline, setIsOnline]   = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) processSyncQueue().catch(console.error);
    });
    return unsub;
  }, []);

  const enqueue = useCallback(async (item: Omit<SyncQueueItem, 'attempts' | 'createdAt'>) => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
    queue.push({ ...item, attempts: 0, createdAt: new Date().toISOString() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, []);

  // ── Process the offline sync queue ─────────────────────────────────────────
  const processSyncQueue = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (!raw) return;
      const queue: SyncQueueItem[] = JSON.parse(raw);
      const remaining: SyncQueueItem[] = [];

      for (const item of queue) {
        try {
          if (item.type === 'incident' && item.payload) {
            const result = await api.createIncident(item.payload) as { id: number };
            // Store server ID so photo items can find it
            const localId = (item.payload as { localId: string }).localId;
            await storeServerId(localId, result.id);

          } else if (item.type === 'photo' && item.photoMeta) {
            // Resolve server ID — either directly stored or look up via localId
            let serverId: number | null = item.incidentServerId ?? null;
            if (!serverId && item.incidentLocalId) {
              serverId = await lookupServerId(item.incidentLocalId);
            }

            if (serverId) {
              const done = await uploadAndClean(serverId, item.photoMeta);
              if (!done && item.attempts < 5) {
                remaining.push({ ...item, attempts: item.attempts + 1 });
              }
              // done=true (uploaded or file gone) → item is simply not pushed to remaining
              // done=false with attempts>=5 → also dropped permanently
            } else {
              // Incident not yet on server — keep in queue
              remaining.push({ ...item, attempts: item.attempts + 1 });
            }
          }
        } catch {
          if (item.attempts < 5) {
            remaining.push({ ...item, attempts: item.attempts + 1 });
          }
          // Drop permanently after 5 failed attempts
        }
      }

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // ── Save incident + upload photos ───────────────────────────────────────────
  /**
   * Creates the incident on the server (or queues it if offline),
   * then uploads each photo and deletes the local copy on success.
   */
  const saveIncident = useCallback(async (
    payload: unknown,
    photos: PhotoEntry[],
  ): Promise<{ queued: boolean }> => {
    const localId = (payload as { localId: string }).localId;

    if (isOnline) {
      try {
        const result = await api.createIncident(payload) as { id: number };
        const serverId = result.id;
        await storeServerId(localId, serverId);

        // Upload each photo; queue any that transiently fail
        for (const photo of photos) {
          const meta: PhotoQueueMeta = {
            uri:           photo.uri,
            latitude:      photo.latitude,
            longitude:     photo.longitude,
            altitude:      photo.altitude,
            capturedAt:    photo.capturedAt,
            patientNumber: photo.patientNumber,
          };
          const done = await uploadAndClean(serverId, meta);
          if (!done) {
            // Transient failure — queue with known server ID for retry
            await enqueue({
              id: uuidv4(),
              type: 'photo',
              incidentServerId: serverId,
              photoMeta: meta,
            });
          }
        }

        return { queued: false };
      } catch {
        // Incident creation failed — fall through to offline queue
      }
    }

    // ── Offline path ────────────────────────────────────────────────────────
    await enqueue({ id: localId, type: 'incident', payload });
    for (const photo of photos) {
      await enqueue({
        id: uuidv4(),
        type: 'photo',
        incidentLocalId: localId,   // resolved once incident syncs
        photoMeta: {
          uri:           photo.uri,
          latitude:      photo.latitude,
          longitude:     photo.longitude,
          altitude:      photo.altitude,
          capturedAt:    photo.capturedAt,
          patientNumber: photo.patientNumber,
        },
      });
    }
    return { queued: true };
  }, [isOnline, enqueue]);

  // ── LOV cache ───────────────────────────────────────────────────────────────
  const refreshLovs = useCallback(async () => {
    if (!isOnline) return;
    const tables = ['call_types', 'reasons', 'areas', 'transports', 'hospitals',
                    'responders', 'medical_history_presets', 'drugs'];
    const cache: Record<string, unknown[]> = {};
    await Promise.all(tables.map(async (t) => {
      try { cache[t] = await api.getLov(t) as unknown[]; } catch { /* keep existing */ }
    }));
    try {
      cache['areas_nested'] = await api.getAreas() as unknown[];
    } catch { /* keep existing */ }
    await AsyncStorage.setItem(LOV_CACHE_KEY, JSON.stringify({ data: cache, ts: Date.now() }));
  }, [isOnline]);

  const getCachedLov = useCallback(async (table: string): Promise<unknown[]> => {
    const raw = await AsyncStorage.getItem(LOV_CACHE_KEY);
    if (!raw) return [];
    const { data, ts } = JSON.parse(raw) as { data: Record<string, unknown[]>; ts: number };
    if (Date.now() - ts > LOV_CACHE_TTL_MS && isOnline) {
      refreshLovs().catch(console.error);
    }
    return data[table] ?? [];
  }, [isOnline, refreshLovs]);

  return { isOnline, isSyncing, saveIncident, refreshLovs, getCachedLov, processSyncQueue };
}
