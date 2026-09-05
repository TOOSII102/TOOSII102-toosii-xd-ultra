'use strict';

// Every reply the bot sends should look the same. Rather than rewrite the body
// of 100+ commands, the socket's sendMessage is wrapped once and any plain text
// reply is framed on the way out.
//
//   ╔═|〔  PING 〕
//   ║
//   ║ ▸ *Status*  : ✅ Online
//   ║
//   ╚═|〔 TOOSII-XD-ULTRA 〕

const TOP = '╔═|〔';
const BOTTOM = '╚═|〔';
const EDGE = '║';

// A message that already carries the frame must not be wrapped twice.
function isFramed(text) {
    return typeof text === 'string' && text.trimStart().startsWith(TOP);
}

function titleFor(name) {
    return String(name || 'TOOSII')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toUpperCase()
        .slice(0, 40) || 'TOOSII';
}

// Long AI answers and lyrics arrive as paragraphs. Wrapping keeps the frame
// straight on narrow phone screens instead of letting lines run past the edge.
function wrapLine(line, width) {
    if (line.length <= width) return [line];
    // A line holding a link is left whole. Splitting a URL across rows stops it
    // being tappable in WhatsApp, which matters more than a tidy right edge.
    if (/https?:\/\//i.test(line)) return [line];
    const out = [];
    let current = '';
    for (const word of line.split(/\s+/)) {
        if (!current) {
            current = word;
        } else if ((current + ' ' + word).length <= width) {
            current += ' ' + word;
        } else {
            out.push(current);
            current = word;
        }
        // A single unbroken token longer than the width is kept whole rather
        // than chopped mid-word.
    }
    if (current) out.push(current);
    return out;
}

function frame(text, title, botName, width = 46) {
    const body = String(text ?? '').replace(/\s+$/, '');
    const lines = [`${TOP}  ${titleFor(title)} 〕`, EDGE];

    for (const raw of body.split('\n')) {
        const trimmed = raw.replace(/\s+$/, '');
        if (!trimmed) {
            lines.push(EDGE);
            continue;
        }
        for (const piece of wrapLine(trimmed, width)) {
            lines.push(`${EDGE} ${piece}`);
        }
    }

    lines.push(EDGE, `${BOTTOM} ${botName} 〕`);
    return lines.join('\n');
}

// Wrap a Baileys socket so every outgoing text and media caption is framed.
// `titleResolver` supplies the heading for the command currently running.
function withFramedReplies(sock, botName, titleResolver) {
    const original = sock.sendMessage.bind(sock);

    sock.sendMessage = async (jid, content, options) => {
        try {
            if (content && typeof content === 'object') {
                const title = (typeof titleResolver === 'function' ? titleResolver() : null) || botName;

                if (typeof content.text === 'string' && content.text.trim() && !isFramed(content.text)) {
                    content = { ...content, text: frame(content.text, title, botName) };
                } else if (typeof content.caption === 'string' && content.caption.trim() && !isFramed(content.caption)) {
                    content = { ...content, caption: frame(content.caption, title, botName) };
                }
            }
        } catch {
            // Formatting must never prevent a reply from going out.
        }
        return original(jid, content, options);
    };

    return sock;
}

module.exports = { frame, isFramed, titleFor, wrapLine, withFramedReplies, TOP, BOTTOM, EDGE };
