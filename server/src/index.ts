// Discord Bot Server with 24/7 Reconnect Logic
// Supports: Notes sync, File uploads, SMS notifications, Camera/Mic recordings

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Client, GatewayIntentBits, EmbedBuilder, TextChannel, AttachmentBuilder } from 'discord.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  Note,
  FileRecord,
  SMSMessage,
  SyncPayload,
  BotStatus,
  REQUIRED_PERMISSIONS,
  generateId,
  formatBytes,
} from './shared';

// ============================================
// CONFIGURATION
// ============================================

const config = {
  // Discord
  discordToken: process.env.DISCORD_TOKEN || '',
  discordGuildId: process.env.DISCORD_GUILD_ID || '',
  discordChannelId: process.env.DISCORD_CHANNEL_ID || '', // Optional: specific channel for notifications

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '', // For admin operations

  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Reconnect
  reconnectIntervals: [15000, 30000, 60000, 120000, 300000], // 15s, 30s, 1m, 2m, 5m
  maxReconnectAttempts: 10,
};

// Validate required config
const requiredEnv = ['DISCORD_TOKEN', 'DISCORD_GUILD_ID', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  console.error('Please copy .env.example to .env and fill in the values');
  process.exit(1);
}

// ============================================
// SUPABASE CLIENT (Using ws transport for Node.js 22)
// ============================================

const supabase: SupabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  realtime: { transport: ws }
});
const supabaseAdmin: SupabaseClient = createClient(config.supabaseUrl, config.supabaseServiceKey || config.supabaseAnonKey, {
  realtime: { transport: ws }
});

// ============================================
// DISCORD CLIENT
// ============================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

// Bot status tracking
let botStatus: BotStatus = {
  connected: false,
  guildId: null,
  lastReconnect: null,
  uptime: Date.now(),
};

let reconnectAttempt = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// ============================================
// EXPRESS APP
// ============================================

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    bot: botStatus,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - botStatus.uptime,
  });
});

// ============================================
// DISCORD EVENT HANDLERS
// ============================================

client.once('ready', async (readyClient) => {
  console.log(`✅ Discord bot ready: ${readyClient.user.tag}`);

  botStatus = {
    connected: true,
    guildId: config.discordGuildId,
    lastReconnect: new Date(),
    uptime: Date.now(),
  };

  reconnectAttempt = 0;

  // Start heartbeat
  startHeartbeat();

  // Register slash commands
  await registerSlashCommands(readyClient);

  // Send startup notification
  await sendStartupNotification(readyClient);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Handle commands prefixed with !
  if (message.content.startsWith('!')) {
    await handleLegacyCommand(message);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await handleSlashCommand(interaction);
});

client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Discord client warning:', warning);
});

client.on('disconnect', async (event: any) => {
  console.log(`🔌 Discord disconnected: ${event.code} - ${event.reason}`);
  botStatus.connected = false;
  scheduleReconnect();
});

client.on('reconnecting', () => {
  console.log('🔄 Discord reconnecting...');
});

client.on('resume', (replayed: number) => {
  console.log(`🔄 Discord session resumed, replayed ${replayed} events`);
  botStatus.connected = true;
  botStatus.lastReconnect = new Date();
});

// ============================================
// RECONNECT LOGIC
// ============================================

function scheduleReconnect(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  if (reconnectAttempt >= config.maxReconnectAttempts) {
    console.error('❌ Max reconnect attempts reached. Manual intervention required.');
    return;
  }

  const delay = config.reconnectIntervals[Math.min(reconnectAttempt, config.reconnectIntervals.length - 1)];
  console.log(`⏳ Scheduling reconnect attempt ${reconnectAttempt + 1} in ${delay}ms`);

  reconnectTimeout = setTimeout(async () => {
    reconnectAttempt++;
    try {
      await client.login(config.discordToken);
    } catch (error) {
      console.error('❌ Reconnect failed:', error);
      scheduleReconnect();
    }
  }, delay);
}

function startHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(async () => {
    if (!botStatus.connected) return;

    try {
      const guild = client.guilds.cache.get(config.discordGuildId);
      if (!guild) {
        console.warn('⚠️ Guild not found in cache');
        return;
      }

      // Verify bot is still in guild
      const me = await guild.members.fetchMe();
      if (!me) {
        console.warn('⚠️ Bot not found in guild');
        botStatus.connected = false;
        scheduleReconnect();
      }
    } catch (error) {
      console.error('❌ Heartbeat check failed:', error);
    }
  }, 60000); // Every minute
}

// ============================================
// SLASH COMMANDS
// ============================================

async function registerSlashCommands(discordClient: Client): Promise<void> {
  const guild = discordClient.guilds.cache.get(config.discordGuildId);
  if (!guild) {
    console.error('❌ Guild not found for command registration');
    return;
  }

  const commands = [
    {
      name: 'sync',
      description: 'Sync notes from Supabase to Discord',
    },
    {
      name: 'notes',
      description: 'List all notes',
      options: [
        { name: 'limit', description: 'Number of notes to show', type: 4, required: false }, // INTEGER
      ],
    },
    {
      name: 'files',
      description: 'List all uploaded files',
      options: [
        { name: 'type', description: 'Filter by type', type: 3, required: false, choices: [ // STRING
          { name: 'Camera', value: 'camera' },
          { name: 'Microphone', value: 'microphone' },
          { name: 'SMS', value: 'sms' },
          { name: 'File', value: 'file' },
          { name: 'Note', value: 'note' },
        ]},
      ],
    },
    {
      name: 'sms',
      description: 'List recent SMS messages',
      options: [
        { name: 'limit', description: 'Number of messages to show', type: 4, required: false },
      ],
    },
    {
      name: 'status',
      description: 'Check bot and system status',
    },
    {
      name: 'upload',
      description: 'Upload a file to Supabase Storage',
      options: [
        { name: 'file', description: 'File to upload', type: 11, required: true }, // ATTACHMENT
        { name: 'type', description: 'File type', type: 3, required: false, choices: [
          { name: 'Camera', value: 'camera' },
          { name: 'Microphone', value: 'microphone' },
          { name: 'File', value: 'file' },
        ]},
      ],
    },
    {
      name: 'note',
      description: 'Create a new note',
      options: [
        { name: 'title', description: 'Note title', type: 3, required: true },
        { name: 'content', description: 'Note content', type: 3, required: true },
      ],
    },
    {
      name: 'permissions',
      description: 'Show required permissions for mobile app',
    },
  ];

  try {
    await guild.commands.set(commands);
    console.log('✅ Slash commands registered');
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
}

async function handleSlashCommand(interaction: any): Promise<void> {
  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'sync':
        await handleSyncCommand(interaction);
        break;
      case 'notes':
        await handleNotesCommand(interaction);
        break;
      case 'files':
        await handleFilesCommand(interaction);
        break;
      case 'sms':
        await handleSmsCommand(interaction);
        break;
      case 'status':
        await handleStatusCommand(interaction);
        break;
      case 'upload':
        await handleUploadCommand(interaction);
        break;
      case 'note':
        await handleNoteCommand(interaction);
        break;
      case 'permissions':
        await handlePermissionsCommand(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown command', ephemeral: true });
    }
  } catch (error) {
    console.error(`❌ Error handling ${commandName}:`, error);
    await interaction.reply({ content: 'An error occurred', ephemeral: true });
  }
}

async function handleSyncCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  try {
    // Fetch notes from Supabase
    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Send as embed
    const embed = new EmbedBuilder()
      .setTitle('📝 Notes Synced from Supabase')
      .setColor(0x2ECC71)
      .setTimestamp()
      .setFooter({ text: `Total: ${notes?.length || 0} notes` });

    if (notes && notes.length > 0) {
      notes.slice(0, 10).forEach((note: Note) => {
        embed.addFields({
          name: note.title.substring(0, 256),
          value: note.content.substring(0, 1024),
          inline: false,
        });
      });

      if (notes.length > 10) {
        embed.addFields({ name: '...', value: `And ${notes.length - 10} more notes`, inline: false });
      }
    } else {
      embed.setDescription('No notes found');
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Sync error:', error);
    await interaction.editReply({ content: 'Failed to sync notes' });
  }
}

async function handleNotesCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  const limit = interaction.options.getInteger('limit') || 20;

  try {
    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const embed = new EmbedBuilder()
      .setTitle('📝 Your Notes')
      .setColor(0x3498DB)
      .setTimestamp();

    if (notes && notes.length > 0) {
      notes.forEach((note: Note) => {
        embed.addFields({
          name: note.title.substring(0, 256),
          value: `${note.content.substring(0, 500)}${note.content.length > 500 ? '...' : ''}`,
          inline: false,
        });
      });
    } else {
      embed.setDescription('No notes yet. Create one with `/note`');
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Notes error:', error);
    await interaction.editReply({ content: 'Failed to fetch notes' });
  }
}

async function handleFilesCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  const type = interaction.options.getString('type');

  try {
    let query = supabase.from('files').select('*').order('created_at', { ascending: false }).limit(20);

    if (type) {
      query = query.eq('type', type);
    }

    const { data: files, error } = await query;

    if (error) throw error;

    const embed = new EmbedBuilder()
      .setTitle('📁 Uploaded Files')
      .setColor(0x9B59B6)
      .setTimestamp()
      .setFooter({ text: `Total: ${files?.length || 0} files` });

    if (files && files.length > 0) {
      files.forEach((file: FileRecord) => {
        embed.addFields({
          name: `${getFileIcon(file.type)} ${file.filename}`,
          value: `Type: ${file.type} | Size: ${formatBytes(file.size)} | ${new Date(file.created_at).toLocaleString()}`,
          inline: false,
        });
      });
    } else {
      embed.setDescription('No files uploaded yet');
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Files error:', error);
    await interaction.editReply({ content: 'Failed to fetch files' });
  }
}

async function handleSmsCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  const limit = interaction.options.getInteger('limit') || 20;

  try {
    const { data: messages, error } = await supabase
      .from('sms_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const embed = new EmbedBuilder()
      .setTitle('📱 SMS Messages')
      .setColor(0xE67E22)
      .setTimestamp();

    if (messages && messages.length > 0) {
      messages.forEach((msg: SMSMessage) => {
        const directionIcon = msg.direction === 'incoming' ? '📥' : '📤';
        embed.addFields({
          name: `${directionIcon} ${msg.phone_number}`,
          value: `${msg.message.substring(0, 500)}${msg.message.length > 500 ? '...' : ''}\nStatus: ${msg.status} | ${new Date(msg.created_at).toLocaleString()}`,
          inline: false,
        });
      });
    } else {
      embed.setDescription('No SMS messages yet');
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ SMS error:', error);
    await interaction.editReply({ content: 'Failed to fetch SMS messages' });
  }
}

async function handleStatusCommand(interaction: any): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Bot Status')
    .setColor(botStatus.connected ? 0x2ECC71 : 0xE74C3C)
    .addFields(
      { name: 'Discord', value: botStatus.connected ? '🟢 Connected' : '🔴 Disconnected', inline: true },
      { name: 'Guild', value: botStatus.guildId || 'Unknown', inline: true },
      { name: 'Uptime', value: formatUptime(Date.now() - botStatus.uptime), inline: true },
      { name: 'Last Reconnect', value: botStatus.lastReconnect ? botStatus.lastReconnect.toLocaleString() : 'Never', inline: true },
      { name: 'Reconnect Attempts', value: reconnectAttempt.toString(), inline: true },
      { name: 'Supabase', value: '🟢 Connected', inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleUploadCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  const attachment = interaction.options.getAttachment('file');
  const type = interaction.options.getString('type') || 'file';

  if (!attachment) {
    await interaction.editReply({ content: 'No file provided' });
    return;
  }

  try {
    // Download file from Discord
    const response = await fetch(attachment.url);
    const buffer = await response.arrayBuffer();
    const fileData = Buffer.from(buffer);

    // Upload to Supabase Storage
    const filename = `${type}_${generateId()}_${attachment.name}`;
    const { data, error } = await supabaseAdmin.storage
      .from('uploads')
      .upload(filename, fileData, {
        contentType: attachment.contentType || 'application/octet-stream',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from('uploads').getPublicUrl(filename);

    // Save file record
    const fileRecord: Partial<FileRecord> = {
      filename: attachment.name,
      type: type as FileRecord['type'],
      storage_path: filename,
      size: fileData.length,
      metadata: { discordUrl: attachment.url, publicUrl: urlData.publicUrl },
      user_id: interaction.user.id,
      created_at: new Date().toISOString(),
    };

    const { error: dbError } = await supabaseAdmin.from('files').insert(fileRecord);
    if (dbError) throw dbError;

    const embed = new EmbedBuilder()
      .setTitle('✅ File Uploaded')
      .setColor(0x2ECC71)
      .addFields(
        { name: 'Filename', value: attachment.name, inline: true },
        { name: 'Type', value: type, inline: true },
        { name: 'Size', value: formatBytes(fileData.length), inline: true },
        { name: 'URL', value: urlData.publicUrl, inline: false },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Notify mobile app via realtime
    await notifyMobileApp('file_uploaded', fileRecord);
  } catch (error) {
    console.error('❌ Upload error:', error);
    await interaction.editReply({ content: 'Failed to upload file' });
  }
}

async function handleNoteCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  const title = interaction.options.getString('title');
  const content = interaction.options.getString('content');

  if (!title || !content) {
    await interaction.editReply({ content: 'Title and content required' });
    return;
  }

  try {
    const note: Partial<Note> = {
      title,
      content,
      user_id: interaction.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from('notes').insert(note).select().single();
    if (error) throw error;

    const embed = new EmbedBuilder()
      .setTitle('✅ Note Created')
      .setColor(0x2ECC71)
      .addFields(
        { name: 'Title', value: title, inline: false },
        { name: 'Content', value: content.substring(0, 1024), inline: false },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Notify mobile app via realtime
    await notifyMobileApp('note_created', data);
  } catch (error) {
    console.error('❌ Note creation error:', error);
    await interaction.editReply({ content: 'Failed to create note' });
  }
}

async function handlePermissionsCommand(interaction: any): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('📱 Mobile App Permissions Required')
    .setColor(0x3498DB)
    .setDescription('The mobile app needs these permissions for full phone access:')
    .setTimestamp();

  REQUIRED_PERMISSIONS.forEach((perm) => {
    embed.addFields({
      name: `${getPermissionIcon(perm.type)} ${perm.label}`,
      value: `Key: \`${perm.key}\` | Type: \`${perm.type}\``,
      inline: true,
    });
  });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLegacyCommand(message: any): Promise<void> {
  const args = message.content.slice(1).split(' ');
  const command = args[0].toLowerCase();

  const commands: Record<string, (msg: any, args: string[]) => Promise<void>> = {
    sync: async (msg) => {
      const { data: notes } = await supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(10);
      const embed = new EmbedBuilder().setTitle('📝 Notes Sync').setColor(0x2ECC71);
      if (notes?.length) {
        notes.forEach((n: Note) => embed.addFields({ name: n.title, value: n.content.substring(0, 500) }));
      } else {
        embed.setDescription('No notes');
      }
      await msg.reply({ embeds: [embed] });
    },
    notes: async (msg) => {
      const { data: notes } = await supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(20);
      const embed = new EmbedBuilder().setTitle('📝 Notes').setColor(0x3498DB);
      if (notes?.length) {
        notes.forEach((n: Note) => embed.addFields({ name: n.title, value: n.content.substring(0, 300) }));
      } else {
        embed.setDescription('No notes');
      }
      await msg.reply({ embeds: [embed] });
    },
    files: async (msg) => {
      const { data: files } = await supabase.from('files').select('*').order('created_at', { ascending: false }).limit(20);
      const embed = new EmbedBuilder().setTitle('📁 Files').setColor(0x9B59B6);
      if (files?.length) {
        files.forEach((f: FileRecord) => embed.addFields({ name: `${getFileIcon(f.type)} ${f.filename}`, value: `${f.type} • ${formatBytes(f.size)}` }));
      } else {
        embed.setDescription('No files');
      }
      await msg.reply({ embeds: [embed] });
    },
    status: async (msg) => {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Status')
        .setColor(botStatus.connected ? 0x2ECC71 : 0xE74C3C)
        .addFields(
          { name: 'Discord', value: botStatus.connected ? '🟢' : '🔴', inline: true },
          { name: 'Uptime', value: formatUptime(Date.now() - botStatus.uptime), inline: true },
        )
        .setTimestamp();
      await msg.reply({ embeds: [embed] });
    },
    help: async (msg) => {
      const embed = new EmbedBuilder()
        .setTitle('📋 Commands')
        .setColor(0x3498DB)
        .addFields(
          { name: '!sync', value: 'Sync notes from Supabase', inline: true },
          { name: '!notes', value: 'List notes', inline: true },
          { name: '!files', value: 'List files', inline: true },
          { name: '!sms', value: 'List SMS', inline: true },
          { name: '!status', value: 'Bot status', inline: true },
          { name: '!help', value: 'Show this help', inline: true },
        );
      await msg.reply({ embeds: [embed] });
    },
  };

  if (commands[command]) {
    await commands[command](message, args.slice(1));
  }
}

// ============================================
// API ENDPOINTS FOR MOBILE APP
// ============================================

// Get all notes
app.get('/api/notes', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ GET /api/notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Create note
app.post('/api/notes', async (req: Request, res: Response) => {
  try {
    const { title, content, user_id } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }

    const note: Partial<Note> = {
      title,
      content,
      user_id: user_id || 'mobile-app',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from('notes').insert(note).select().single();
    if (error) throw error;

    // Notify Discord
    await notifyDiscord('note_created', data);

    res.status(201).json(data);
  } catch (error) {
    console.error('❌ POST /api/notes error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Update note
app.put('/api/notes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const { data, error } = await supabaseAdmin
      .from('notes')
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Note not found' });

    await notifyDiscord('note_updated', data);

    res.json(data);
  } catch (error) {
    console.error('❌ PUT /api/notes error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete note
app.delete('/api/notes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin.from('notes').delete().eq('id', id);
    if (error) throw error;

    await notifyDiscord('note_deleted', { id });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/notes error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Get files
app.get('/api/files', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    let query = supabase.from('files').select('*').order('created_at', { ascending: false }).limit(50);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('❌ GET /api/files error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Upload file (from mobile app)
app.post('/api/files', async (req: Request, res: Response) => {
  try {
    const { filename, type, base64, metadata } = req.body;

    if (!filename || !type || !base64) {
      return res.status(400).json({ error: 'Filename, type, and base64 required' });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64, 'base64');
    const storagePath = `${type}_${generateId()}_${filename}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('uploads')
      .upload(storagePath, buffer, {
        contentType: getContentType(filename),
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage.from('uploads').getPublicUrl(storagePath);

    const fileRecord: Partial<FileRecord> = {
      filename,
      type: type as FileRecord['type'],
      storage_path: storagePath,
      size: buffer.length,
      metadata: { ...metadata, publicUrl: urlData.publicUrl },
      user_id: req.body.user_id || 'mobile-app',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from('files').insert(fileRecord).select().single();
    if (error) throw error;

    await notifyDiscord('file_uploaded', data);

    res.status(201).json(data);
  } catch (error) {
    console.error('❌ POST /api/files error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// SMS endpoints
app.get('/api/sms', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('sms_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ GET /api/sms error:', error);
    res.status(500).json({ error: 'Failed to fetch SMS' });
  }
});

app.post('/api/sms', async (req: Request, res: Response) => {
  try {
    const { phone_number, message, direction, user_id } = req.body;

    if (!phone_number || !message) {
      return res.status(400).json({ error: 'Phone number and message required' });
    }

    const sms: Partial<SMSMessage> = {
      phone_number,
      message,
      direction: direction || 'outgoing',
      status: 'sent',
      user_id: user_id || 'mobile-app',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from('sms_messages').insert(sms).select().single();
    if (error) throw error;

    await notifyDiscord('sms_sent', data);

    res.status(201).json(data);
  } catch (error) {
    console.error('❌ POST /api/sms error:', error);
    res.status(500).json({ error: 'Failed to save SMS' });
  }
});

// Permission check endpoint
app.get('/api/permissions', (_req: Request, res: Response) => {
  res.json({
    required: REQUIRED_PERMISSIONS,
    granted: [], // Mobile app should send its granted permissions
  });
});

// Bot status endpoint
app.get('/api/bot/status', (_req: Request, res: Response) => {
  res.json(botStatus);
});

// ============================================
// REALTIME NOTIFICATIONS
// ============================================

async function notifyDiscord(event: string, data: unknown): Promise<void> {
  if (!botStatus.connected || !config.discordChannelId) return;

  try {
    const channel = client.channels.cache.get(config.discordChannelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(`📱 Mobile App: ${event.replace(/_/g, ' ').toUpperCase()}`)
      .setColor(getEventColor(event))
      .setTimestamp()
      .setFooter({ text: `Event: ${event}` });

    // Add relevant fields based on event type
    if (data && typeof data === 'object') {
      Object.entries(data as Record<string, unknown>).slice(0, 5).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
          embed.addFields({ name: key, value: String(value).substring(0, 1024), inline: true });
        }
      });
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Discord notification error:', error);
  }
}

async function notifyMobileApp(event: string, data: unknown): Promise<void> {
  // This would use Supabase Realtime to notify the mobile app
  // For now, we'll use a simple broadcast channel
  try {
    await supabaseAdmin.channel('mobile-sync').send({
      type: 'broadcast',
      event,
      payload: { type: event, data, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('❌ Mobile notification error:', error);
  }
}

async function sendStartupNotification(discordClient: Client): Promise<void> {
  if (!config.discordChannelId) return;

  try {
    const channel = discordClient.channels.cache.get(config.discordChannelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('🚀 Phone Access Bot Started')
      .setColor(0x2ECC71)
      .addFields(
        { name: 'Guild', value: config.discordGuildId, inline: true },
        { name: 'Supabase', value: config.supabaseUrl, inline: true },
        { name: 'Time', value: new Date().toLocaleString(), inline: true },
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Startup notification error:', error);
  }
}

// ============================================
// UTILITIES
// ============================================

function getFileIcon(type: string): string {
  const icons: Record<string, string> = {
    camera: '📷',
    microphone: '🎙️',
    sms: '📱',
    file: '📄',
    note: '📝',
  };
  return icons[type] || '📄';
}

function getPermissionIcon(type: string): string {
  const icons: Record<string, string> = {
    camera: '📷',
    microphone: '🎙️',
    storage: '💾',
    files: '📁',
    sms: '📱',
    connectivity: '🌐',
    photos: '🖼️',
    sensors: '📡',
    location: '📍',
  };
  return icons[type] || '🔐';
}

function getEventColor(event: string): number {
  const colors: Record<string, number> = {
    note_created: 0x2ECC71,
    note_updated: 0x3498DB,
    note_deleted: 0xE74C3C,
    file_uploaded: 0x9B59B6,
    sms_sent: 0xE67E22,
    sms_received: 0xF39C12,
  };
  return colors[event] || 0x3498DB;
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    pdf: 'application/pdf',
    txt: 'text/plain',
    json: 'application/json',
  };
  return types[ext || ''] || 'application/octet-stream';
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

async function start(): Promise<void> {
  try {
    // Start Express server
    app.listen(config.port, () => {
      console.log(`🌐 Express server running on port ${config.port}`);
      console.log(`   Health: http://localhost:${config.port}/health`);
      console.log(`   API: http://localhost:${config.port}/api`);
    });

    // Connect to Discord
    console.log('🔌 Connecting to Discord...');
    await client.login(config.discordToken);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');

  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (reconnectTimeout) clearTimeout(reconnectTimeout);

  await client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');

  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (reconnectTimeout) clearTimeout(reconnectTimeout);

  await client.destroy();
  process.exit(0);
});

start();