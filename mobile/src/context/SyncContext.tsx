import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSupabase } from './SupabaseContext';
import { Note, FileRecord, SMSMessage, SyncPayload } from '@phone-access/shared';
import { API_BASE_URL } from '@env';

interface SyncContextType {
  // Notes
  notes: Note[];
  fetchNotes: () => Promise<void>;
  createNote: (title: string, content: string) => Promise<Note | null>;
  updateNote: (id: string, title: string, content: string) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;

  // Files
  files: FileRecord[];
  fetchFiles: (type?: string) => Promise<void>;
  uploadFile: (file: {
    uri: string;
    filename: string;
    type: FileRecord['type'];
    metadata?: Record<string, unknown>;
  }) => Promise<FileRecord | null>;
  deleteFile: (id: string) => Promise<boolean>;

  // SMS
  smsMessages: SMSMessage[];
  fetchSms: () => Promise<void>;
  sendSms: (phoneNumber: string, message: string) => Promise<SMSMessage | null>;

  // Sync status
  isOnline: boolean;
  lastSync: Date | null;
  syncing: boolean;
  triggerSync: () => Promise<void>;

  // Realtime
  subscribeToChanges: (callback: (payload: SyncPayload) => void) => () => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { supabase, user } = useSupabase();
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [smsMessages, setSmsMessages] = useState<SMSMessage[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [realtimeChannel, setRealtimeChannel] = useState<any>(null);

  // Fetch functions
  const fetchNotes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Fetch notes error:', error);
    }
  }, [supabase]);

  const createNote = useCallback(async (title: string, content: string) => {
    try {
      const note = {
        title,
        content,
        user_id: user?.id || 'anonymous',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('notes').insert(note).select().single();
      if (error) throw error;

      setNotes(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Create note error:', error);
      return null;
    }
  }, [supabase, user]);

  const updateNote = useCallback(async (id: string, title: string, content: string) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => prev.map(n => n.id === id ? data : n));
      return data;
    } catch (error) {
      console.error('Update note error:', error);
      return null;
    }
  }, [supabase]);

  const deleteNote = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;

      setNotes(prev => prev.filter(n => n.id !== id));
      return true;
    } catch (error) {
      console.error('Delete note error:', error);
      return false;
    }
  }, [supabase]);

  // Delete file
  const deleteFile = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('files').delete().eq('id', id);
      if (error) throw error;

      setFiles(prev => prev.filter(f => f.id !== id));
      return true;
    } catch (error) {
      console.error('Delete file error:', error);
      return false;
    }
  }, [supabase]);

  const fetchFiles = useCallback(async (type?: string) => {
    try {
      let query = supabase.from('files').select('*').order('created_at', { ascending: false }).limit(50);
      if (type) query = query.eq('type', type);

      const { data, error } = await query;
      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Fetch files error:', error);
    }
  }, [supabase]);

  const uploadFile = useCallback(async (file: {
    uri: string;
    filename: string;
    type: FileRecord['type'];
    metadata?: Record<string, unknown>;
  }) => {
    try {
      const formData = new FormData();
      formData.append('filename', file.filename);
      formData.append('type', file.type);
      formData.append('user_id', user?.id || 'anonymous');
      formData.append('metadata', JSON.stringify(file.metadata || {}));

      // Append the file
      formData.append('file', {
        uri: file.uri,
        name: file.filename,
        type: file.metadata?.mimeType || 'application/octet-stream',
      } as any);

      const response = await fetch(`${API_BASE_URL}/api/files`, {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type - let fetch set it with boundary
        },
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setFiles(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Upload file error:', error);
      return null;
    }
  }, [user]);

  const fetchSms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sms_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSmsMessages(data || []);
    } catch (error) {
      console.error('Fetch SMS error:', error);
    }
  }, [supabase]);

  const sendSms = useCallback(async (phoneNumber: string, message: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          message,
          direction: 'outgoing',
          user_id: user?.id || 'anonymous',
        }),
      });

      if (!response.ok) throw new Error('Send SMS failed');

      const data = await response.json();
      setSmsMessages(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Send SMS error:', error);
      return null;
    }
  }, [user]);

  // Sync all data
  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      await Promise.all([
        fetchNotes(),
        fetchFiles(),
        fetchSms(),
      ]);
      setLastSync(new Date());
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  }, [fetchNotes, fetchFiles, fetchSms]);

  // Realtime subscription
  const subscribeToChanges = useCallback((callback: (payload: SyncPayload) => void) => {
    const channel = supabase
      .channel('mobile-sync')
      .on('broadcast', { event: '*' }, (payload) => {
        callback(payload.payload as SyncPayload);
      })
      .subscribe();

    setRealtimeChannel(channel);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Initial fetch and realtime setup
  useEffect(() => {
    triggerSync();

    const unsubscribe = subscribeToChanges((payload) => {
      console.log('Received realtime update:', payload.type);
      // Trigger refetch based on event type
      switch (payload.type) {
        case 'note_created':
        case 'note_updated':
        case 'note_deleted':
          fetchNotes();
          break;
        case 'file_uploaded':
          fetchFiles();
          break;
        case 'sms_sent':
        case 'sms_received':
          fetchSms();
          break;
      }
    });

    return () => {
      unsubscribe();
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [triggerSync, subscribeToChanges, fetchNotes, fetchFiles, fetchSms, realtimeChannel, supabase]);

  // Network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <SyncContext.Provider
      value={{
        notes,
        fetchNotes,
        createNote,
        updateNote,
        deleteNote,
        files,
        fetchFiles,
        uploadFile,
        deleteFile,
        smsMessages,
        fetchSms,
        sendSms,
        isOnline,
        lastSync,
        syncing,
        triggerSync,
        subscribeToChanges,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}