// ── Canonical knowledge-object registry (single source of truth) ─────────────
//
// Every deployable SentinelOne artifact the lab ships — STAR/scheduled detection
// rules, Hyperautomation response workflows, and SDL dashboards — is listed here,
// each tied to the scenario it belongs to. BOTH the Architecture page (the
// "knowledge objects" collapsibles + the Deploy wizard) AND the Scenarios pages
// read from this module, so editing an object here (or its underlying vendored
// JSON) updates every surface at once — no duplicated, drifting copies.
//
// The detection rule bodies are the ACTUAL deployed rule JSON (verbatim copies of
// detections/<name>/*.rule.json), so "what the card shows" == "what deploys".

import webSqli from './detections/web-sqli.rule.json'
import webXss from './detections/web-xss.rule.json'
import webTraversal from './detections/web-traversal.rule.json'
import credStuffing from './detections/cred-stuffing.rule.json'
import dataExfil from './detections/data-exfil.rule.json'
import botScraper from './detections/bot-scraper.rule.json'
import promptInjection from './detections/prompt-injection.rule.json'
import dnsTunneling from './detections/dns-tunneling.rule.json'

import threatDetectionDashboard from './dashboards/threat-detection.dashboard.json'
import ingestionInventoryDashboard from './dashboards/ingestion-inventory.dashboard.json'

// deployedId = the rule id currently live in the reference S1 tenant (for
// reference/dedup only; a user deploying to their OWN console gets fresh ids).
const DETECTION_DEFS = [
  { key: 'web-sqli',         scenarioId: 'sqli',      rule: webSqli,         deployedId: '2519092985434164473' },
  { key: 'web-xss',          scenarioId: 'xss',       rule: webXss,          deployedId: '2519092991281024296' },
  { key: 'web-traversal',    scenarioId: 'traversal', rule: webTraversal,    deployedId: '2519092998092573998' },
  { key: 'cred-stuffing',    scenarioId: 'cred',      rule: credStuffing,    deployedId: '2519093004283366750' },
  { key: 'data-exfil',       scenarioId: 'exfil',     rule: dataExfil,       deployedId: '2519093015733817725' },
  { key: 'bot-scraper',      scenarioId: 'bot',       rule: botScraper,      deployedId: '2523842940840264774' },
  { key: 'prompt-injection', scenarioId: 'promptinj', rule: promptInjection, deployedId: '2519093028014740613' },
  { key: 'dns-tunneling',    scenarioId: 'dns',       rule: dnsTunneling,    deployedId: '2519102258169184569' },
]

// Normalize each detection to the shape both the UI and the deploy layer consume.
// Facts (name/severity/queryType/query) come straight from the deployed rule JSON.
export const DETECTIONS = DETECTION_DEFS.map(({ key, scenarioId, rule, deployedId }) => {
  const data = rule.data || {}
  return {
    type: 'detection',
    key,
    scenarioId,
    name: data.name || key,
    description: data.description || '',
    severity: data.severity || 'Medium',
    queryType: data.queryType || 'scheduled',
    query: data.scheduledParams?.query || data.s1ql || '',
    runIntervalMinutes: data.scheduledParams?.runIntervalMinutes ?? null,
    lookbackWindowMinutes: data.scheduledParams?.lookbackWindowMinutes ?? null,
    deployedId,
    rule, // full deployable JSON
  }
})

// Hyperautomation response workflows. workflowKey matches the loaders in
// haPlaybooks.js (src/data/ha-workflows/<key>.workflow.json) so the raw JSON is
// lazy-loaded on demand. web-attacks covers three scenarios.
export const HA_WORKFLOWS = [
  { type: 'ha', key: 'web-attacks',      scenarioIds: ['sqli', 'xss', 'traversal'], name: 'CF-WAF Web-Attack Response', detail: 'SQLi / XSS / Path-Traversal — parametrized', connections: ['Cloudflare', 'VirusTotal', 'SentinelOne', 'Slack', 'Email'] },
  { type: 'ha', key: 'cred-stuffing',    scenarioIds: ['cred'],       name: 'CF-Access Credential-Attack Response', detail: 'Brute force / credential stuffing', connections: ['Cloudflare', 'AbuseIPDB', 'SentinelOne', 'Slack', 'Email'] },
  { type: 'ha', key: 'data-exfil',       scenarioIds: ['exfil'],      name: 'CF-API Data-Exfiltration Response', detail: 'Bulk pull / endpoint enumeration', connections: ['Cloudflare', 'VirusTotal', 'AbuseIPDB', 'SentinelOne', 'Slack', 'Email'] },
  { type: 'ha', key: 'bot-scraper',      scenarioIds: ['bot'],        name: 'CF-Bot Scraper Mitigation', detail: 'Low-BotScore automated scraping', connections: ['Cloudflare', 'VirusTotal', 'SentinelOne', 'Slack', 'Email'] },
  { type: 'ha', key: 'prompt-injection', scenarioIds: ['promptinj'],  name: 'CF-AI Prompt-Injection Response', detail: 'LLM jailbreak / injection probing', connections: ['Cloudflare', 'VirusTotal', 'SentinelOne', 'Slack', 'Email'] },
  { type: 'ha', key: 'dns-tunneling',    scenarioIds: ['dns'],        name: 'CF-Gateway DNS-Tunnel Response', detail: 'DNS tunneling / C2 beaconing', connections: ['Cloudflare', 'VirusTotal', 'SentinelOne', 'Slack', 'Email'] },
]

// SDL dashboards (config-as-JSON put to /dashboards/<name>).
export const DASHBOARDS = [
  { type: 'dashboard', key: 'threat-detection',  name: 'Cloudflare Threat Detection', deployPath: '/dashboards/threat-detection',            description: threatDetectionDashboard.description || '', tabs: (threatDetectionDashboard.tabs || []).length,  dashboard: threatDetectionDashboard },
  { type: 'dashboard', key: 'ingestion-inventory', name: 'Data Ingestion Inventory',  deployPath: '/dashboards/cloudflare-ingestion-inventory', description: ingestionInventoryDashboard.description || '', tabs: (ingestionInventoryDashboard.tabs || []).length, dashboard: ingestionInventoryDashboard },
]

// Lookups by scenario id — used by the Scenarios pages to pull canonical facts.
export const detectionForScenario = (scenarioId) => DETECTIONS.find(d => d.scenarioId === scenarioId) || null
export const haWorkflowsForScenario = (scenarioId) => HA_WORKFLOWS.filter(w => w.scenarioIds.includes(scenarioId))

// Everything the Deploy wizard can push, grouped by type.
export const KNOWLEDGE_OBJECT_GROUPS = [
  { type: 'detection', label: 'STAR / Scheduled Detections', items: DETECTIONS },
  { type: 'ha',        label: 'Hyperautomation Workflows',   items: HA_WORKFLOWS },
  { type: 'dashboard', label: 'SDL Dashboards',              items: DASHBOARDS },
]
