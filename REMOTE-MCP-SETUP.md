# Raga Remote MCP Connector

This is for Claude on web, mobile, CEO laptop, and other devices.

Local `claude_desktop_config.json` only works on that one computer. For all devices, use the hosted backend MCP endpoint and add it in Claude as a custom connector.

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
- `latest_employee_reports`
- `latest_dmr_snapshots`
- `latest_stock_snapshots`

## Backend Env

```env
RAGA_MCP_API_KEY=make-a-long-secret-password
```

With the hosted dashboard backend, your MCP URL is:

```text
https://dashboard.nexarrow.eu/api/mcp
```

## Add In Claude

In Claude:

1. Open Settings.
2. Go to Connectors.
3. Add custom connector.
4. Name: `Raga Mongo`
5. URL: `https://dashboard.nexarrow.eu/api/mcp`
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
