'use strict';

// WhatsApp is end-to-end encrypted per device. When a recipient cannot decrypt
// something we sent, it asks us to send that exact message again. Baileys gets
// the original by calling getMessage(key).
//
// Returning a stub (or undefined) means the resend carries nothing, so the
// other phone never sees the reply and the bot looks silent from that device.
// This keeps a small in-memory ring of recently sent messages to answer those
// retries correctly.

const MAX_ENTRIES = 1000;

const store = new Map();

function keyOf(key) {
    if (!key) return null;
    const id = typeof key === 'string' ? key : key.id;
    return id || null;
}

function remember(key, message) {
    const id = keyOf(key);
    if (!id || !message) return;
    // Re-inserting moves the entry to the end, so the map stays ordered oldest
    // first and the cheapest eviction is simply dropping the first key.
    if (store.has(id)) store.delete(id);
    store.set(id, message);
    while (store.size > MAX_ENTRIES) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
    }
}

function recall(key) {
    const id = keyOf(key);
    if (!id) return null;
    return store.get(id) || null;
}

function size() {
    return store.size;
}

function clear() {
    store.clear();
}

module.exports = { remember, recall, size, clear, MAX_ENTRIES };
