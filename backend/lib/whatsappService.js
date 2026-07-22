const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_STATE = { contacts: [], groups: [], messages: [] };

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

  function textFromMessage(message = {}) {
  if (message.text?.body) return message.text.body;
  if (message.button?.text) return message.button.text;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  const media = message.image || message.document || message.audio || message.video || message.sticker;
  return media?.caption || (media ? `[${message.type || "media"}]` : `[${message.type || "message"}]`);
}

function createWhatsAppService({ dataFile, accessToken, phoneNumberId, businessAccountId, appSecret, verifyToken, graphVersion = "v23.0" }) {
  let state = { ...DEFAULT_STATE };

  function load() {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    if (!fs.existsSync(dataFile)) {
      save();
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      state = {
        contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      };
    } catch (error) {
      console.error("Could not load WhatsApp data:", error.message);
      state = { ...DEFAULT_STATE };
    }
  }

  function replyIdFromMessage(message = {}) {
    return message.button?.payload
      || message.button?.text
      || message.interactive?.button_reply?.id
      || message.interactive?.button_reply?.title
      || message.interactive?.list_reply?.id
      || "";
  }

  function save() {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    const temp = `${dataFile}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state, null, 2));
    fs.renameSync(temp, dataFile);
  }

  function configured() {
    return Boolean(accessToken && phoneNumberId && businessAccountId && appSecret && verifyToken);
  }

  function assertConfigured() {
    if (!configured()) throw new Error("WhatsApp environment configuration is incomplete");
  }

  async function graphRequest(endpoint, options = {}) {
    assertConfigured();
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error?.message || `Meta API request failed (${response.status})`);
      error.status = response.status;
      error.metaCode = data.error?.code;
      throw error;
    }
    return data;
  }

  function addOrUpdateContact({ phone, name, profileName, source = "manual" }) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    let contact = state.contacts.find((item) => item.phone === normalized);
    const now = new Date().toISOString();
    if (contact) {
      contact.name = name || contact.name || profileName || normalized;
      contact.profileName = profileName || contact.profileName || null;
      contact.updatedAt = now;
    } else {
      contact = {
        id: crypto.randomUUID(),
        phone: normalized,
        name: name || profileName || normalized,
        profileName: profileName || null,
        source,
        createdAt: now,
        updatedAt: now,
      };
      state.contacts.push(contact);
    }
    return contact;
  }

  function storeMessage(message) {
    const existing = message.wamid && state.messages.find((item) => item.wamid === message.wamid);
    if (existing) {
      Object.assign(existing, message, { id: existing.id, updatedAt: new Date().toISOString() });
      return existing;
    }
    const record = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "received",
      ...message,
    };
    state.messages.push(record);
    if (state.messages.length > 10000) state.messages = state.messages.slice(-10000);
    return record;
  }

  function verifySignature(rawBody, signature) {
    if (!appSecret || appSecret === "your_meta_app_secret") return true;
    if (!signature || !rawBody) return false;
    const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(String(signature));
    return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  }

  function verifyWebhook(query = {}) {
    return query["hub.mode"] === "subscribe" && query["hub.verify_token"] === verifyToken
      ? query["hub.challenge"]
      : null;
  }

  function handleWebhook(body = {}, rawBody, signature) {
    if (!verifySignature(rawBody, signature)) {
      const error = new Error("Invalid WhatsApp webhook signature");
      error.status = 401;
      throw error;
    }

    const received = [];
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const profileMap = new Map((value.contacts || []).map((contact) => [normalizePhone(contact.wa_id), contact.profile?.name]));
        for (const message of value.messages || []) {
          const from = normalizePhone(message.from);
          const profileName = profileMap.get(from) || null;
          addOrUpdateContact({ phone: from, profileName, source: "whatsapp" });
          const media = message.image || message.document || message.audio || message.video || message.sticker || null;
          const record = storeMessage({
            wamid: message.id,
            direction: "inbound",
            from,
            to: normalizePhone(phoneNumberId),
            type: message.type || "text",
            text: textFromMessage(message),
            replyId: replyIdFromMessage(message),
            contextId: message.context?.id || null,
            mediaId: media?.id || null,
            mediaMimeType: media?.mime_type || null,
            mediaFilename: message.document?.filename || null,
            timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
            status: "received",
          });
          received.push(record);
        }
        for (const status of value.statuses || []) {
          const record = state.messages.find((message) => message.wamid === status.id);
          if (!record) continue;
          record.status = status.status || record.status;
          record.statusAt = status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString();
          record.error = status.errors?.[0]?.title || status.errors?.[0]?.message || null;
          record.updatedAt = new Date().toISOString();
        }
      }
    }
    save();
    return { received };
  }

  function templateParameter(text) {
    return { type: "text", text: String(text ?? "") };
  }

  async function sendMessage({ to, text, templateName, language = "en_US", templateParams = [], buttonUrlParam = "", templateButtons = [] }, actor = null) {
    const phone = normalizePhone(to);
    if (!phone) throw new Error("A valid recipient phone number is required");
    if (!text?.trim() && !templateName) throw new Error("Message text or template is required");
    addOrUpdateContact({ phone, source: "outbound" });
    const components = [];
    if (templateName && Array.isArray(templateParams) && templateParams.length) {
      components.push({ type: "body", parameters: templateParams.map(templateParameter) });
    }
    if (templateName && buttonUrlParam) {
      components.push({ type: "button", sub_type: "url", index: "0", parameters: [templateParameter(buttonUrlParam)] });
    }
    if (templateName && Array.isArray(templateButtons)) {
      templateButtons.forEach((button, index) => {
        const payload = String(button?.payload || button?.id || button?.text || "").trim();
        if (!payload) return;
        components.push({
          type: "button",
          sub_type: "quick_reply",
          index: String(button.index ?? index),
          parameters: [{ type: "payload", payload }],
        });
      });
    }
    const payload = templateName
      ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          ...(components.length ? { components } : {}),
        },
      }
      : { messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "text", text: { preview_url: true, body: text.trim() } };
    const result = await graphRequest(`${phoneNumberId}/messages`, { method: "POST", body: JSON.stringify(payload) });
    const record = storeMessage({
      wamid: result.messages?.[0]?.id || null,
      direction: "outbound",
      from: normalizePhone(phoneNumberId),
      to: phone,
      type: templateName ? "template" : "text",
      text: templateName ? `Template: ${templateName}${templateParams.length ? ` - ${templateParams.join(" | ")}` : ""}` : text.trim(),
      templateName: templateName || null,
      timestamp: new Date().toISOString(),
      status: "sent",
      sentBy: actor ? { id: actor.id, name: actor.displayName || actor.username } : null,
    });
    save();
    return record;
  }

  function listConversations(search = "") {
    const term = String(search || "").trim().toLowerCase();
    const map = new Map();
    for (const message of state.messages) {
      const phone = message.direction === "inbound" ? message.from : message.to;
      if (!phone) continue;
      const contact = state.contacts.find((item) => item.phone === phone);
      const current = map.get(phone);
      const timestamp = message.timestamp || message.createdAt;
      if (!current || new Date(timestamp) > new Date(current.lastMessage.timestamp || current.lastMessage.createdAt)) {
        map.set(phone, { phone, contact: contact || null, lastMessage: message });
      }
    }
    return [...map.values()]
      .filter((item) => !term || item.phone.includes(term) || String(item.contact?.name || "").toLowerCase().includes(term))
      .sort((a, b) => new Date(b.lastMessage.timestamp || 0) - new Date(a.lastMessage.timestamp || 0));
  }

  function listMessages(phone) {
    const normalized = normalizePhone(phone);
    return state.messages
      .filter((message) => message.from === normalized || message.to === normalized)
      .sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));
  }

  function findMessageByWamid(wamid) {
    if (!wamid) return null;
    return state.messages.find((message) => message.wamid === wamid) || null;
  }

  function clearConversation(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return 0;
    const before = state.messages.length;
    state.messages = state.messages.filter((message) => message.from !== normalized && message.to !== normalized);
    const deleted = before - state.messages.length;
    if (deleted > 0) save();
    return deleted;
  }

  function listContacts(search = "") {
    const term = String(search || "").trim().toLowerCase();
    return state.contacts
      .filter((contact) => !term || contact.phone.includes(term) || String(contact.name || "").toLowerCase().includes(term))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  function saveContact(input) {
    const contact = addOrUpdateContact(input);
    if (!contact) throw new Error("A valid phone number is required");
    save();
    return contact;
  }

  function deleteContact(id) {
    const index = state.contacts.findIndex((contact) => contact.id === id);
    if (index < 0) return false;
    const [removed] = state.contacts.splice(index, 1);
    state.groups.forEach((group) => { group.members = group.members.filter((phone) => phone !== removed.phone); });
    save();
    return true;
  }

  function saveGroup(input) {
    const name = String(input.name || "").trim();
    const members = [...new Set((input.members || []).map(normalizePhone).filter(Boolean))];
    if (!name) throw new Error("Group name is required");
    const now = new Date().toISOString();
    let group = input.id ? state.groups.find((item) => item.id === input.id) : null;
    if (group) Object.assign(group, { name, members, updatedAt: now });
    else {
      group = { id: crypto.randomUUID(), name, members, createdAt: now, updatedAt: now };
      state.groups.push(group);
    }
    save();
    return group;
  }

  function deleteGroup(id) {
    const before = state.groups.length;
    state.groups = state.groups.filter((group) => group.id !== id);
    if (state.groups.length === before) return false;
    save();
    return true;
  }

  async function sendGroup(id, payload, actor) {
    const group = state.groups.find((item) => item.id === id);
    if (!group) throw new Error("Recipient group not found");
    const results = [];
    for (const phone of group.members) {
      try {
        const message = await sendMessage({ ...payload, to: phone }, actor);
        results.push({ phone, success: true, messageId: message.id });
      } catch (error) {
        results.push({ phone, success: false, error: error.message });
      }
    }
    return { group, results, sent: results.filter((item) => item.success).length, failed: results.filter((item) => !item.success).length };
  }

  async function health() {
    const data = await graphRequest(`${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`);
    return { connected: true, displayPhoneNumber: data.display_phone_number || null, verifiedName: data.verified_name || null, qualityRating: data.quality_rating || null };
  }

  async function templates() {
    const data = await graphRequest(`${businessAccountId}/message_templates?limit=100&fields=name,status,language,category`);
    return data.data || [];
  }

  load();
  return {
    configured,
    config: () => ({ configured: configured(), phoneNumberId, businessAccountId, graphVersion }),
    verifyWebhook,
    handleWebhook,
    sendMessage,
    listConversations,
    listMessages,
    findMessageByWamid,
    clearConversation,
    listContacts,
    saveContact,
    deleteContact,
    listGroups: () => [...state.groups],
    saveGroup,
    deleteGroup,
    sendGroup,
    health,
    templates,
  };
}

module.exports = { createWhatsAppService, normalizePhone };
