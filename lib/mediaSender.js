'use strict';

// Resolvers hand back a plain link. Sending that link as text makes the bot feel
// broken: users expect .play and .yta to deliver a real playable file. This
// module downloads the resolved link and uploads it to WhatsApp as proper audio,
// video or document attachments.

const MAX_BYTES = 64 * 1024 * 1024; // WhatsApp rejects uploads beyond ~64MB.
const DOWNLOAD_TIMEOUT_MS = 120000;

const AUDIO_TYPES = new Map([
    ['audio/mpeg', 'mp3'], ['audio/mp3', 'mp3'], ['audio/mp4', 'm4a'],
    ['audio/m4a', 'm4a'], ['audio/x-m4a', 'm4a'], ['audio/aac', 'aac'],
    ['audio/ogg', 'ogg'], ['audio/opus', 'opus'], ['audio/webm', 'webm'],
    ['audio/wav', 'wav'], ['audio/x-wav', 'wav'], ['audio/flac', 'flac']
]);

const VIDEO_TYPES = new Map([
    ['video/mp4', 'mp4'], ['video/webm', 'webm'], ['video/quicktime', 'mov'],
    ['video/x-matroska', 'mkv'], ['video/3gpp', '3gp']
]);

// Filenames reach the user's filesystem, so strip anything path-like or hostile.
function safeFileName(title, extension) {
    const base = (typeof title === 'string' ? title : '')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    return `${base || 'download'}.${extension}`;
}

const IMAGE_TYPES = new Map([
    ['image/jpeg', 'jpg'], ['image/jpg', 'jpg'], ['image/png', 'png'],
    ['image/gif', 'gif'], ['image/webp', 'webp']
]);

function extensionFor(kind, contentType, fallbackUrl) {
    const type = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (kind === 'audio' && AUDIO_TYPES.has(type)) return AUDIO_TYPES.get(type);
    if (kind === 'video' && VIDEO_TYPES.has(type)) return VIDEO_TYPES.get(type);
    if (kind === 'file') {
        for (const table of [VIDEO_TYPES, AUDIO_TYPES, IMAGE_TYPES]) {
            if (table.has(type)) return table.get(type);
        }
        try {
            const found = /\.([a-z0-9]{2,6})$/i.exec(new URL(fallbackUrl).pathname)?.[1];
            if (found) return found.toLowerCase();
        } catch { /* fall through */ }
        return 'bin';
    }

    // Content-Type is often generic (octet-stream) on CDN redirects, so fall
    // back to the extension in the URL path before guessing.
    try {
        const path = new URL(fallbackUrl).pathname;
        const found = /\.([a-z0-9]{2,5})$/i.exec(path)?.[1]?.toLowerCase();
        const allowed = kind === 'audio'
            ? ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'wav', 'flac', 'webm']
            : ['mp4', 'webm', 'mov', 'mkv', '3gp'];
        if (found && allowed.includes(found)) return found;
    } catch { /* fall through to the default */ }

    return kind === 'audio' ? 'mp3' : 'mp4';
}

function mimeFor(kind, extension, contentType) {
    if (kind === 'file') {
        const type = String(contentType || '').split(';')[0].trim().toLowerCase();
        if (type && !type.includes('octet-stream')) return type;
        for (const table of [VIDEO_TYPES, AUDIO_TYPES, IMAGE_TYPES]) {
            for (const [mime, ext] of table) if (ext === extension) return mime;
        }
        return 'application/octet-stream';
    }
    for (const [mime, ext] of (kind === 'audio' ? AUDIO_TYPES : VIDEO_TYPES)) {
        if (ext === extension) return mime;
    }
    return kind === 'audio' ? 'audio/mpeg' : 'video/mp4';
}

// A resolver can return an HTML error page with HTTP 200. Uploading that would
// produce a file that plays as silence, so verify the payload really is media.
function looksLikeMedia(buffer, contentType, kind) {
    const type = String(contentType || '').toLowerCase();
    if (type.startsWith('text/') || type.includes('json') || type.includes('html')) return false;
    if (buffer.length < 4096) return false;

    const head = buffer.subarray(0, 16);
    const ascii = head.toString('ascii');
    if (ascii.startsWith('<!DO') || ascii.startsWith('<htm') || ascii.startsWith('<?xm')) return false;

    // A document may legitimately be any binary type, so only reject error pages.
    if (kind === 'file') return true;

    if (kind === 'audio') {
        if (ascii.startsWith('ID3')) return true;                       // MP3 with tags
        if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return true;  // raw MPEG frame
        if (ascii.startsWith('OggS') || ascii.startsWith('fLaC') || ascii.startsWith('RIFF')) return true;
        if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return true; // m4a
        if (head[0] === 0x1a && head[1] === 0x45) return true;           // webm
        // An audio/* content type with real bytes is good enough otherwise.
        return type.startsWith('audio/') || type.includes('octet-stream');
    }

    if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return true; // mp4/mov
    if (head[0] === 0x1a && head[1] === 0x45) return true;               // webm/mkv
    return type.startsWith('video/') || type.includes('octet-stream');
}

async function fetchMedia(url, kind, referer = null) {
    let response;
    try {
        response = await fetch(url, {
            redirect: 'follow',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
                accept: '*/*',
                'accept-language': 'en-US,en;q=0.9',
                ...(referer ? { referer } : {})
            },
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
        });
    } catch (error) {
        throw new Error(error.name === 'TimeoutError' ? 'The download timed out.' : 'The download could not be started.');
    }
    if (!response.ok) throw new Error(`The download failed with status ${response.status}.`);

    // Reject oversized files before buffering them into memory when possible.
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
        throw new Error('That file is too large to send on WhatsApp.');
    }

    const contentType = response.headers.get('content-type');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) throw new Error('That file is too large to send on WhatsApp.');
    if (!looksLikeMedia(buffer, contentType, kind)) throw new Error('The resolved link did not return playable media.');

    const extension = extensionFor(kind, contentType, url);
    return { buffer, extension, mimetype: mimeFor(kind, extension, contentType), bytes: buffer.length };
}

// Audio is sent twice on purpose: once as a voice-style playable message and
// once as a document, which is what users mean by "mp3 and document format" —
// the playable one streams in-chat, the document one can be saved to storage.
async function sendAudio(sock, jid, quoted, media, title) {
    const fileName = safeFileName(title, media.extension);
    await sock.sendMessage(jid, {
        audio: media.buffer,
        mimetype: media.mimetype,
        fileName,
        ptt: false
    }, { quoted });
    await sock.sendMessage(jid, {
        document: media.buffer,
        mimetype: media.mimetype,
        fileName
    }, { quoted });
    return fileName;
}

async function sendVideo(sock, jid, quoted, media, title, caption) {
    const fileName = safeFileName(title, media.extension);
    await sock.sendMessage(jid, {
        video: media.buffer,
        mimetype: media.mimetype,
        fileName,
        caption: caption || undefined
    }, { quoted });
    return fileName;
}

// Pinterest and MediaFire return whatever the user saved: an image should render
// inline, a video should play, anything else is a document.
async function sendFile(sock, jid, quoted, media, title, caption) {
    if (media.mimetype.startsWith('image/')) {
        const fileName = safeFileName(title, media.extension);
        await sock.sendMessage(jid, {
            image: media.buffer, mimetype: media.mimetype, caption: caption || undefined
        }, { quoted });
        return fileName;
    }
    if (media.mimetype.startsWith('video/')) {
        return sendVideo(sock, jid, quoted, media, title, caption);
    }
    return sendDocument(sock, jid, quoted, media, title);
}

async function sendDocument(sock, jid, quoted, media, title) {
    const fileName = safeFileName(title, media.extension);
    await sock.sendMessage(jid, {
        document: media.buffer,
        mimetype: media.mimetype,
        fileName
    }, { quoted });
    return fileName;
}

module.exports = {
    MAX_BYTES,
    fetchMedia,
    sendAudio,
    sendVideo,
    sendDocument,
    sendFile,
    safeFileName,
    extensionFor,
    mimeFor,
    looksLikeMedia
};
