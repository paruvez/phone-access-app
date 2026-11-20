// Shared types and utilities for phone-access-app

export interface Note {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface FileRecord {
  id: string;
  filename: string;
  type: 'camera' | 'microphone' | 'sms' | 'file' | 'note';
  storage_path: string;
  size: number;
  metadata: Record<string, unknown>;
  user_id: string;
  created_at: string;
}

export interface SMSMessage {
  id: string;
  phone_number: string;
  message: string;
  direction: 'incoming' | 'outgoing';
  status: 'sent' | 'delivered' | 'failed';
  user_id: string;
  created_at: string;
}

export interface PermissionState {
  camera: boolean;
  microphone: boolean;
  storage: boolean;
  files: boolean;
  sms: boolean;
  connectivity: boolean;
  photos: boolean;
  sensors: boolean;
  location: boolean;
}

export interface DiscordCommand {
  name: string;
  description: string;
  handler: (data: unknown) => Promise<unknown>;
}

export interface BotStatus {
  connected: boolean;
  guildId: string | null;
  lastReconnect: Date | null;
  uptime: number;
}

export interface SyncPayload {
  type: 'note_created' | 'note_updated' | 'note_deleted' | 'file_uploaded' | 'sms_sent' | 'sms_received';
  data: unknown;
  timestamp: string;
  userId: string;
}

export const REQUIRED_PERMISSIONS = [
  { key: 'camera', label: 'Camera Access', type: 'camera' as const },
  { key: 'microphone', label: 'Microphone Access', type: 'microphone' as const },
  { key: 'storage', label: 'File Storage', type: 'storage' as const },
  { key: 'files', label: 'File Access', type: 'files' as const },
  { key: 'sms', label: 'SMS Access', type: 'sms' as const },
  { key: 'connectivity', label: 'Connection & Background', type: 'connectivity' as const },
  { key: 'photos', label: 'Photo Library', type: 'photos' as const },
  { key: 'sensors', label: 'Sensor Access', type: 'sensors' as const },
  { key: 'location', label: 'Location', type: 'location' as const },
] as const;

export type PermissionKey = typeof REQUIRED_PERMISSIONS[number]['key'];

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}