import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const PORT = Number(process.env.PORT || 8787);
const MONGODB_URI = process.env.MONGODB_URI || process.env.RAGA_MONGODB_READONLY_URI;
const DB_NAME = process.env.MONGODB_DB || 'sheets';
const API_KEY = process.env.RAGA_MCP_API_KEY || process.env.MCP_API_KEY;
const MAX_LIMIT = Number(process.env.MCP_MAX_LIMIT || 200);

const ALLOWED_COLLECTIONS = new Set(
  (process.env.MCP_ALLOWED_COLLECTIONS || [
    'employeeDailyReports',
    'employeeReportSubmissions',
    'dmrDailySnapshots',
    'stockDailySnapshots',
    'stockSiteSnapshots',
    'projectDashboard',
  ].join(','))
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean),
);

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI or RAGA_MONGODB_READONLY_URI');
}

const mongo = new MongoClient(MONGODB_URI, { maxPoolSize: 10 });
let dbPromise;

function getDb() {
  if (!dbPromise) {
    dbPromise = mongo.connect().then(() => mongo.db(DB_NAME));
  }
  return dbPromise;
}

function requireAuth(req, res, next) {
  if (!API_KEY) return next();

  const auth = req.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const apiKey = req.get('x-api-key') || req.query.key || '';

  if (bearer === API_KEY || apiKey === API_KEY) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

function safeLimit(limit) {
  const parsed = Number(limit || 50);
  if (!Number.isFinite(parsed) || parsed < 1) return 50;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function assertCollection(collection) {
  if (!ALLOWED_COLLECTIONS.has(collection)) {
    throw new Error(`Collection not allowed: ${collection}`);
  }
}

function toJson(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (item && typeof item === 'object' && item._bsontype === 'ObjectId') {
        return item.toString();
      }
      return item;
    }),
  );
}

function textResult(data) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(toJson(data), null, 2),
      },
    ],
  };
}

function makeServer() {
  const server = new McpServer({
    name: 'raga-mongo-remote',
    version: '1.0.0',
  });

  server.registerTool(
    'list_collections',
    {
      title: 'List allowed MongoDB collections',
      description: 'Lists the MongoDB collections this read-only connector can query.',
      inputSchema: {},
    },
    async () => textResult({ database: DB_NAME, collections: [...ALLOWED_COLLECTIONS].sort() }),
  );

  server.registerTool(
    'count_documents',
    {
      title: 'Count MongoDB documents',
      description: 'Counts documents in an allowed collection using an optional MongoDB filter.',
      inputSchema: {
        collection: z.string(),
        filter: z.record(z.any()).optional().default({}),
      },
    },
    async ({ collection, filter }) => {
      assertCollection(collection);
      const db = await getDb();
      const count = await db.collection(collection).countDocuments(filter || {});
      return textResult({ collection, count });
    },
  );

  server.registerTool(
    'find_documents',
    {
      title: 'Find MongoDB documents',
      description: 'Reads documents from an allowed collection. This connector never writes data.',
      inputSchema: {
        collection: z.string(),
        filter: z.record(z.any()).optional().default({}),
        projection: z.record(z.any()).optional(),
        sort: z.record(z.any()).optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().default(50),
      },
    },
    async ({ collection, filter, projection, sort, limit }) => {
      assertCollection(collection);
      const db = await getDb();
      let cursor = db.collection(collection).find(filter || {}, { projection }).limit(safeLimit(limit));
      if (sort) cursor = cursor.sort(sort);
      const documents = await cursor.toArray();
      return textResult({ collection, limit: safeLimit(limit), documents });
    },
  );

  server.registerTool(
    'aggregate_documents',
    {
      title: 'Aggregate MongoDB documents',
      description: 'Runs a read-only aggregation pipeline on an allowed collection.',
      inputSchema: {
        collection: z.string(),
        pipeline: z.array(z.record(z.any())).default([]),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().default(50),
      },
    },
    async ({ collection, pipeline, limit }) => {
      assertCollection(collection);
      const blocked = ['$out', '$merge', '$function', '$accumulator'];
      const serialized = JSON.stringify(pipeline || []);
      if (blocked.some((operator) => serialized.includes(`"${operator}"`))) {
        throw new Error('Only read-only aggregation stages are allowed');
      }
      const db = await getDb();
      const documents = await db
        .collection(collection)
        .aggregate([...(pipeline || []), { $limit: safeLimit(limit) }], { allowDiskUse: false })
        .toArray();
      return textResult({ collection, limit: safeLimit(limit), documents });
    },
  );

  server.registerTool(
    'latest_employee_reports',
    {
      title: 'Latest employee daily reports',
      description: 'Gets the latest employee daily reports mirrored from Google Sheets.',
      inputSchema: {
        employeeName: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().default(25),
      },
    },
    async ({ employeeName, limit }) => {
      const filter = employeeName ? { employeeName: new RegExp(employeeName, 'i') } : {};
      const db = await getDb();
      const documents = await db
        .collection('employeeDailyReports')
        .find(filter)
        .sort({ reportDate: -1, submittedAt: -1, updatedAt: -1 })
        .limit(safeLimit(limit))
        .toArray();
      return textResult({ collection: 'employeeDailyReports', documents });
    },
  );

  server.registerTool(
    'latest_dmr_snapshots',
    {
      title: 'Latest DMR snapshots',
      description: 'Gets latest DMR daily snapshots for projects and dates.',
      inputSchema: {
        projectName: z.string().optional(),
        date: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().default(25),
      },
    },
    async ({ projectName, date, limit }) => {
      const filter = {};
      if (projectName) filter.projectName = new RegExp(projectName, 'i');
      if (date) filter.date = date;
      const db = await getDb();
      const documents = await db
        .collection('dmrDailySnapshots')
        .find(filter)
        .sort({ date: -1, snapshotAt: -1, updatedAt: -1 })
        .limit(safeLimit(limit))
        .toArray();
      return textResult({ collection: 'dmrDailySnapshots', documents });
    },
  );

  server.registerTool(
    'latest_stock_snapshots',
    {
      title: 'Latest stock snapshots',
      description: 'Gets latest stock snapshots across all configured stock sheets/sites.',
      inputSchema: {
        siteName: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().default(25),
      },
    },
    async ({ siteName, limit }) => {
      const filter = siteName ? { siteName: new RegExp(siteName, 'i') } : {};
      const db = await getDb();
      const documents = await db
        .collection('stockSiteSnapshots')
        .find(filter)
        .sort({ snapshotAt: -1, updatedAt: -1 })
        .limit(safeLimit(limit))
        .toArray();
      return textResult({ collection: 'stockSiteSnapshots', documents });
    },
  );

  return server;
}

const app = express();
const origins = (process.env.MCP_ALLOWED_ORIGINS || '*').split(',').map((item) => item.trim());
app.use(cors({ origin: origins.includes('*') ? '*' : origins, exposedHeaders: ['Mcp-Session-Id'] }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    res.json({ ok: true, database: DB_NAME });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.all('/mcp', requireAuth, async (req, res) => {
  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`Raga remote MCP listening on http://localhost:${PORT}/mcp`);
});
