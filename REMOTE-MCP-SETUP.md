# Raga Remote MCP Connector

This is for Claude on web, mobile, CEO laptop, and other devices.

Local `claude_desktop_config.json` only works on that one computer. For all devices, deploy `remote-mcp` as a public HTTPS service and add it in Claude as a custom connector.

## What It Gives Claude

The connector is read-only and can query these MongoDB collections:

- `employeeDailyReports`
- `employeeReportSubmissions`
- `dmrDailySnapshots`
- `stockDailySnapshots`
- `stockSiteSnapshots`
- `projectDashboard`

Claude gets tools like:

- `list_collections`
- `count_documents`
- `find_documents`
- `aggregate_documents`
- `latest_employee_reports`
- `latest_dmr_snapshots`
- `latest_stock_snapshots`

## Local Test

Open PowerShell in:

```powershell
C:\Users\my792\Desktop\raga\remote-mcp
```

Create `.env` from `.env.example`:

```powershell
copy .env.example .env
notepad .env
```

Set:

```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=sheets
RAGA_MCP_API_KEY=make-a-long-secret-password
```

Then run:

```powershell
npm start
```

Check health:

```powershell
curl http://localhost:8787/health
```

## Deploy

Deploy the `remote-mcp` folder to any Node host that gives HTTPS, for example Render, Railway, Fly.io, or a VPS.

Set these environment variables on the host:

```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=sheets
RAGA_MCP_API_KEY=make-a-long-secret-password
```

Start command:

```bash
npm start
```

After deployment, your MCP URL will be:

```text
https://your-domain.example.com/mcp
```

## Add In Claude

In Claude:

1. Open Settings.
2. Go to Connectors.
3. Add custom connector.
4. Name: `Raga Mongo`
5. URL: `https://your-domain.example.com/mcp`
6. Add request header:

```text
Authorization: Bearer your-RAGA_MCP_API_KEY-value
```

Then ask Claude:

```text
Use Raga Mongo to list collections.
```

Then:

```text
Use Raga Mongo to count documents in employeeDailyReports, dmrDailySnapshots, and stockSiteSnapshots.
```

## Important

Use a MongoDB user that is read-only for the `sheets` database. This connector code does not write data, but the database user should also be read-only.
