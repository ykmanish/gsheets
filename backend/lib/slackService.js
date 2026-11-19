const crypto = require("crypto");

// Slack Web API client for the "UIPL Docs" app: posting, updating, DMs, modals and
// request-signature checks. It knows nothing about MRN/PRN or reports; server.js
// decides what to post and keeps the record of which card belongs to which request.

const SLACK_API = "https://slack.com/api";
const CHANNEL_CACHE_MS = 10 * 60_000;
const USER_CACHE_MS = 5 * 60_000;
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

// Slack mrkdwn treats &, < and > as markup.
function escapeText(value = "") {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(value = "", max = 280) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function isUrl(value = "") {
  return /^https?:\/\/\S+$/i.test(String(value || "").trim());
}

function createSlackService({ token = "", signingSecret = "" } = {}) {
  const configured = Boolean(token && signingSecret);
  let channelCache = { at: 0, byName: new Map() };
  const userCache = new Map();
  const emailCache = new Map();

  // Write methods take JSON; read methods are sent form-encoded, which every method accepts.
  async function api(method, params = {}, { json = true } = {}) {
    if (!token) throw new Error("Slack is not configured (SLACK_BOT_TOKEN missing)");
    const response = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": json ? "application/json; charset=utf-8" : "application/x-www-form-urlencoded",
      },
      body: json ? JSON.stringify(params) : new URLSearchParams(params),
    });
    const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
    if (!data.ok) {
      const error = new Error(`Slack ${method} failed: ${data.error || "unknown error"}`);
      error.slackError = data.error;
      throw error;
    }
    return data;
  }

  /** Accepts a channel ID, "name" or "#name"; names are looked up among public channels. */
  async function resolveChannel(nameOrId = "") {
    const value = String(nameOrId || "").trim().replace(/^#/, "");
    if (!value) throw new Error("No Slack channel configured");
    if (/^[CG][A-Z0-9]{6,}$/.test(value)) return value;
    const key = value.toLowerCase();
    if (Date.now() - channelCache.at > CHANNEL_CACHE_MS || !channelCache.byName.has(key)) {
      const byName = new Map();
      let cursor = "";
      do {
        const page = await api("conversations.list", { types: "public_channel", exclude_archived: "true", limit: "200", ...(cursor ? { cursor } : {}) }, { json: false });
        for (const channel of page.channels || []) byName.set(channel.name.toLowerCase(), channel.id);
        cursor = page.response_metadata?.next_cursor || "";
      } while (cursor);
      channelCache = { at: Date.now(), byName };
    }
    const id = channelCache.byName.get(key);
    if (!id) throw new Error(`Slack channel #${value} not found`);
    return id;
  }

  async function userInfo(userId) {
    const cached = userCache.get(userId);
    if (cached && Date.now() - cached.at < USER_CACHE_MS) return cached.user;
    const { user } = await api("users.info", { user: userId }, { json: false });
    userCache.set(userId, { at: Date.now(), user });
    return user;
  }

  /** The Slack user with this email, or null when they are not in the workspace. */
  async function userByEmail(email = "") {
    const key = String(email || "").trim().toLowerCase();
    if (!key) return null;
    const cached = emailCache.get(key);
    if (cached && Date.now() - cached.at < USER_CACHE_MS) return cached.user;
    try {
      const { user } = await api("users.lookupByEmail", { email: key }, { json: false });
      emailCache.set(key, { at: Date.now(), user });
      return user;
    } catch (error) {
      if (error.slackError === "users_not_found") {
        emailCache.set(key, { at: Date.now(), user: null });
        return null;
      }
      throw error;
    }
  }

  let membersCache = { at: 0, members: [] };

  /** Active human members of the workspace (bots and deactivated accounts left out). */
  async function listMembers() {
    if (Date.now() - membersCache.at < USER_CACHE_MS) return membersCache.members;
    const members = [];
    let cursor = "";
    do {
      const page = await api("users.list", { limit: "200", ...(cursor ? { cursor } : {}) }, { json: false });
      members.push(...(page.members || []).filter((member) => !member.deleted && !member.is_bot && member.id !== "USLACKBOT"));
      cursor = page.response_metadata?.next_cursor || "";
    } while (cursor);
    membersCache = { at: Date.now(), members };
    return members;
  }

  const postMessage = (message) => api("chat.postMessage", { unfurl_links: false, unfurl_media: false, ...message });
  const updateMessage = (message) => api("chat.update", message);
  const postEphemeral = (message) => api("chat.postEphemeral", message);
  const openView = (triggerId, view) => api("views.open", { trigger_id: triggerId, view });

  async function sendDm(userId, message) {
    const { channel } = await api("conversations.open", { users: userId });
    return postMessage({ channel: channel.id, ...message });
  }

  function verifyRequest({ rawBody = "", timestamp = "", signature = "" } = {}) {
    if (!signingSecret || !timestamp || !signature) return false;
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SIGNATURE_MAX_AGE_SECONDS) return false;
    const expected = `v0=${crypto.createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /**
   * An approval request card. `fields` are [label, value] pairs, `links` are [label, url]
   * pairs. With `decision` ({ event, by, at, comment }) the buttons give way to the outcome.
   */
  function approvalCardBlocks({ module, recordNo, title, fields = [], links = [], decision = null }) {
    const value = JSON.stringify({ module, recordNo });
    const shownFields = fields
      .filter(([, fieldValue]) => String(fieldValue ?? "").trim() && String(fieldValue).trim() !== "-")
      .slice(0, 10)
      .map(([label, fieldValue]) => ({ type: "mrkdwn", text: `*${escapeText(label)}*\n${escapeText(truncate(fieldValue))}` }));
    const linkButtons = links
      .filter(([, url]) => isUrl(url))
      .slice(0, 4)
      .map(([label, url], index) => ({ type: "button", text: { type: "plain_text", text: label }, url: String(url).trim(), action_id: `link:${index}` }));
    const blocks = [
      { type: "section", text: { type: "mrkdwn", text: `*${escapeText(title)}*  ·  \`${escapeText(recordNo)}\`` } },
    ];
    if (shownFields.length) blocks.push({ type: "section", fields: shownFields });
    const decisionButtons = decision ? [] : [
      {
        type: "button",
        style: "primary",
        text: { type: "plain_text", text: "Approve" },
        action_id: "approval:approved",
        value,
        confirm: {
          title: { type: "plain_text", text: `Approve ${truncate(recordNo, 16)}?` },
          text: { type: "mrkdwn", text: "The requester and the people concerned will be told it is approved." },
          confirm: { type: "plain_text", text: "Approve" },
          deny: { type: "plain_text", text: "Cancel" },
        },
      },
      { type: "button", style: "danger", text: { type: "plain_text", text: "Decline" }, action_id: "approval:declined", value },
      { type: "button", text: { type: "plain_text", text: "Comment" }, action_id: "approval:comment", value },
    ];
    const actions = [...decisionButtons, ...linkButtons];
    if (actions.length) blocks.push({ type: "actions", block_id: "approval_actions", elements: actions });
    if (decision) {
      const icon = decision.event === "approved" ? ":white_check_mark:" : ":x:";
      const verb = decision.event === "approved" ? "Approved" : "Declined";
      const when = Math.floor(new Date(decision.at || Date.now()).getTime() / 1000);
      const reason = decision.comment ? ` — ${escapeText(truncate(decision.comment, 200))}` : "";
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `${icon} *${verb}* by ${escapeText(decision.by)} · <!date^${when}^{date_short_pretty} {time}|${new Date(when * 1000).toISOString()}>${reason}` }],
      });
    } else {
      blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: ":hourglass_flowing_sand: Waiting for approval" }] });
    }
    return blocks;
  }

  /** Modal asking for a comment, or an optional reason when declining. */
  function decisionModal({ kind, module, recordNo }) {
    const declining = kind === "declined";
    return {
      type: "modal",
      callback_id: declining ? "approval_declined" : "approval_comment",
      private_metadata: JSON.stringify({ module, recordNo }),
      title: { type: "plain_text", text: truncate(`${declining ? "Decline" : "Comment on"} ${module}`, 24) },
      submit: { type: "plain_text", text: declining ? "Decline" : "Send" },
      close: { type: "plain_text", text: "Cancel" },
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `*${escapeText(module)} ${escapeText(recordNo)}*` } },
        {
          type: "input",
          block_id: "reason",
          optional: declining,
          label: { type: "plain_text", text: declining ? "Reason (optional)" : "Comment" },
          element: { type: "plain_text_input", action_id: "text", multiline: true, max_length: 1500 },
        },
      ],
    };
  }

  return {
    configured,
    api,
    resolveChannel,
    userInfo,
    userByEmail,
    listMembers,
    postMessage,
    updateMessage,
    postEphemeral,
    openView,
    sendDm,
    verifyRequest,
    approvalCardBlocks,
    decisionModal,
  };
}

module.exports = { createSlackService, escapeText, truncate };
