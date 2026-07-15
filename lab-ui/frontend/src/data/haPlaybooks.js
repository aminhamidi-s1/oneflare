// Raw workflow JSON is only needed for the collapsible "Workflow JSON" copy panel,
// so it is lazy-loaded (dynamic import → its own chunk) rather than bundled into the
// main app chunk. See loadHaWorkflowJson() below and WorkflowJsonPanel in ScenarioDetail.jsx.
const WORKFLOW_LOADERS = {
  'web-attacks': () => import('./ha-workflows/web-attacks.workflow.json'),
  'cred-stuffing': () => import('./ha-workflows/cred-stuffing.workflow.json'),
  'data-exfil': () => import('./ha-workflows/data-exfil.workflow.json'),
  'bot-scraper': () => import('./ha-workflows/bot-scraper.workflow.json'),
  'prompt-injection': () => import('./ha-workflows/prompt-injection.workflow.json'),
  'dns-tunneling': () => import('./ha-workflows/dns-tunneling.workflow.json'),
}

export async function loadHaWorkflowJson(workflowKey) {
  const loader = WORKFLOW_LOADERS[workflowKey]
  if (!loader) return null
  const mod = await loader()
  return mod.default ?? mod
}

// Structured, HA-editor-style diagram data + narrative for the Hyperautomation (HA)
// response workflow behind each attack scenario's "Response Playbook" tab.
//
// Derived from the actual workflow JSON (hyperautomation/<name>/*.workflow.json) and
// its README — node labels/detail are collapsed to the README's own block-by-block
// abstraction level (variable/plumbing actions folded into their parent step), the
// same abstraction the README's own ASCII flow diagrams use. Nothing here is invented:
// every gate condition, connection, and action mirrors what's documented.
//
// diagram.blocks shape is documented in ../components/HAPlaybookDiagram.jsx.

const UNKNOWN_DEVICE =
  'Cloudflare alerts key on src_ip, not an S1 agent id, so they bind to "Unknown Device" in ' +
  'the console until the asset-enrichment solution runs — containment here is deliberately ' +
  'network-edge / IP-centric (Cloudflare block or challenge), not EDR host isolation.'

// ---------------------------------------------------------------------------
// web-attacks — shared by sqli / xss / traversal
// ---------------------------------------------------------------------------

function webAttacksDiagram(triggerLabel) {
  return {
    blocks: [
      { kind: 'trigger', label: triggerLabel, detail: 'name contains "CF-WAF-", severity HIGH/CRITICAL → extracts attacker_ip, host, sample_uri, lowest_score' },
      {
        kind: 'enrichment',
        nodes: [
          { label: 'Search Related S1 Events', detail: 'SDL PowerQuery — class_uid=4002 events from attacker_ip, 6h → correlated_count' },
          { label: 'VirusTotal IP Report', detail: 'core HTTP GET /ip_addresses/{ip} → vt_malicious' },
        ],
      },
      {
        kind: 'decision',
        label: 'Reputation & Correlation Gate',
        detail: 'vt_malicious > 0  OR  correlated_count > 3',
        converge: true,
        branches: {
          true: {
            label: 'contain',
            nodes: [
              { label: 'Block Attacker IP at Cloudflare', detail: 'mode = block (zone firewall access rule)', variant: 'destructive' },
            ],
          },
          false: {
            label: 'monitor',
            nodes: [
              { label: 'Challenge Attacker IP at Cloudflare', detail: 'mode = managed_challenge (reversible)', variant: 'action' },
            ],
          },
        },
      },
      {
        kind: 'action',
        nodes: [
          { label: 'Add S1 IOC', detail: 'IPV4 indicator, 7-day validity', variant: 'note' },
          { label: 'Compose Note + Add Alert Note', detail: 'UAM addAlertNote, HTML-encoded', variant: 'note' },
          { label: 'Raise Alert Verdict', detail: 'analyst-facing verdict (best-effort mutation)', variant: 'note' },
        ],
      },
      {
        kind: 'notify',
        nodes: [
          { label: 'Notify SOC Slack', detail: '#oneflare-soc' },
          { label: 'Send Email', detail: 'SOC receipt' },
        ],
      },
    ],
  }
}

const WEB_ATTACKS_WHY =
  'One parametrized workflow (`web-attacks`) answers all three Cloudflare WAF ML detections — ' +
  'SQLi, XSS, and Path Traversal/LFI share a `CF-WAF-` alert-name prefix, so a single flow ' +
  'blocks/challenges the offending src_ip rather than duplicating the same logic three times. ' +
  'The destructive Cloudflare block only fires on independent evidence (VirusTotal reputation ' +
  'or >3 correlated S1 events for the same IP in 6h); a lone hit gets a non-destructive managed ' +
  'challenge instead. ' + UNKNOWN_DEVICE

const WEB_ATTACKS_CONNECTIONS = [
  'Cloudflare (Zone → Firewall Services: Edit)',
  'SentinelOne SDL (Bearer)',
  'SentinelOne (ApiToken)',
  'Slack (chat:write)',
  'Send Email (platform SMTP)',
  'VirusTotal API key (x-apikey header)',
]

const webAttacksEntry = (triggerLabel, why) => ({
  workflowKey: 'web-attacks',
  workflowFile: 'web-attacks.workflow.json',
  title: 'Web-Attack (WAF) Response — shared workflow',
  why,
  connections: WEB_ATTACKS_CONNECTIONS,
  diagram: webAttacksDiagram(triggerLabel),
})

// ---------------------------------------------------------------------------
// cred-stuffing
// ---------------------------------------------------------------------------

const credStuffingEntry = {
  workflowKey: 'cred-stuffing',
  workflowFile: 'cred-stuffing.workflow.json',
  title: 'Credential Stuffing / Brute-Force Response',
  why:
    'Both attack shapes (single-IP brute force and multi-credential stuffing) surface as a high ' +
    'failed-login count for one src_ip, so the workflow acts per-IP rather than per-label. It ' +
    'recomputes failed_logins/distinct_uas and checks for any successful login from that IP ' +
    '(an account-takeover foothold) before deciding contain vs. challenge — an IP that already ' +
    'landed a valid login is contained regardless of reputation. ' + UNKNOWN_DEVICE +
    ' The alert also carries no UserEmail (HTTP Requests dataset), so per-user Access step-up ' +
    'is not possible from this alert — the zone-wide "under attack" escalation is the substitute.',
  connections: [
    'SentinelOne (ApiToken)',
    'SentinelOne SDL (Bearer)',
    'Cloudflare (Firewall + Zone Settings: Edit)',
    'Slack (#novamind-soc)',
    'AbuseIPDB API key',
    'Platform mailer',
  ],
  diagram: {
    blocks: [
      { kind: 'trigger', label: 'CF-Access-CredStuffing — HIGH/CRITICAL', detail: 'Login Brute Force / Credential Stuffing on portal.novamind.ai → client_ip' },
      { kind: 'gate', label: 'Src IP Resolved?', detail: 'client_ip != "no-ip"', elseLabel: 'No Source IP note (terminal, gap-path)' },
      {
        kind: 'enrichment',
        nodes: [
          { label: 'S1 Auth Failure Recompute', detail: 'failed_logins + distinct_uas over 24h' },
          { label: 'S1 Cross-Surface Activity', detail: 'login_successes — ATO foothold signal' },
          { label: 'AbuseIPDB IP Reputation', detail: 'abuseConfidenceScore' },
        ],
      },
      {
        kind: 'decision',
        label: 'Malicious or High-Risk Src IP',
        detail: 'abuseConfidenceScore ≥ 50  OR  failed_logins ≥ 20  OR  login_successes ≥ 1',
        converge: false,
        branches: {
          true: {
            label: 'contain',
            nodes: [
              { label: 'CF IP Access Rule — Block', detail: 'portal zone', variant: 'destructive' },
              { label: 'Escalate Zone — Under Attack', detail: 'security_level = under_attack (JS interstitial)', variant: 'destructive' },
              { label: 'Add IOC for Attacker IP', detail: 'IPV4, 7-day TTL', variant: 'note' },
              { label: 'Add Containment Note', detail: 'UAM addAlertNote', variant: 'note' },
              { label: 'Raise Alert Confidence', detail: 'analystVerdict = SUSPICIOUS', variant: 'note' },
              { label: 'Notify SOC Slack', detail: 'containment summary', variant: 'notify' },
              { label: 'Send SOC Email', detail: 'containment receipt', variant: 'notify' },
            ],
          },
          false: {
            label: 'challenge',
            nodes: [
              { label: 'CF IP Access Rule — Challenge', detail: 'mode = managed_challenge (step-up)', variant: 'action' },
              { label: 'Add Challenge Note', detail: 'UAM addAlertNote', variant: 'note' },
              { label: 'Notify SOC Slack', detail: 'monitor-path summary', variant: 'notify' },
            ],
          },
        },
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// data-exfil
// ---------------------------------------------------------------------------

const dataExfilEntry = {
  workflowKey: 'data-exfil',
  workflowFile: 'data-exfil.workflow.json',
  title: 'Data-Exfiltration Response (api.novamind.ai)',
  why:
    'Two evidence gates guard two blast radii. Any resolved IP gets zone-scoped containment ' +
    '(block the exfil routes + the source IP, note, IOC) on the detection\'s own volume floor — ' +
    'no TI required. The destructive, account-wide edge block and API-credential flag/revoke ' +
    'only fire on independent threat-intel confirmation (VirusTotal malicious or AbuseIPDB ≥ 50), ' +
    'per the project\'s evidence discipline: max classification without TI is SUSPICIOUS, never ' +
    'TRUE_POSITIVE. ' + UNKNOWN_DEVICE,
  connections: [
    'SentinelOne SDL (Bearer)',
    'SentinelOne (ApiToken)',
    'Cloudflare (Zone + Account Firewall: Edit)',
    'Slack (#novamind-soc)',
    'Send Email (platform mailer)',
    'VirusTotal API key',
    'AbuseIPDB API key',
    'NovaMind incident-key header (X-Incident-Key)',
  ],
  diagram: {
    blocks: [
      { kind: 'trigger', label: 'CF-API-Exfil — HIGH/CRITICAL', detail: 'sensitive_hits ≥ 10 OR max_bytes ≥ 1 MiB → client_ip' },
      {
        kind: 'enrichment',
        nodes: [
          { label: 'Search Related API Activity', detail: 'S1 SDL — resolves the authenticated caller for this src_ip, 24h' },
          { label: 'VirusTotal IP Report', detail: 'vt_malicious' },
          { label: 'AbuseIPDB Check', detail: 'abuse_score' },
        ],
      },
      { kind: 'gate', label: 'IP Resolved?', detail: 'client_ip != "no-ip"', elseLabel: 'no action (no fabricated block target)' },
      {
        kind: 'action',
        nodes: [
          { label: 'Block Exfil Routes for IP', detail: '/export, /download, /api/v1/customers/export', variant: 'destructive' },
          { label: 'Block Source IP at Zone', detail: 'IP access rule', variant: 'destructive' },
          { label: 'Add S1 Alert Note + IOC', detail: 'IPV4, exfiltration category, risk 95', variant: 'note' },
          { label: 'Raise Analyst Verdict', detail: 'suspicious — pending TI confirmation', variant: 'note' },
          { label: 'Notify SOC Slack', detail: 'DLP tap, #novamind-soc', variant: 'notify' },
        ],
      },
      {
        kind: 'decision',
        label: 'Escalate Confirmed Malicious?',
        detail: 'vt_malicious > 0  OR  abuse_score ≥ 50',
        converge: false,
        branches: {
          true: {
            label: 'TI-confirmed',
            nodes: [
              { label: 'Account Global Edge Block', detail: 'account-level IP rule — blocks shop/portal/api', variant: 'destructive' },
              { label: 'Flag Compromised API Credential', detail: 'NovaMind Worker /api/incident — revoke token', variant: 'destructive' },
              { label: 'Send Email — CRITICAL Escalation', detail: 'SOC + DLP', variant: 'notify' },
            ],
          },
          false: {
            label: 'unconfirmed',
            nodes: [
              { label: 'Send Email — Contained', detail: 'SOC, monitoring, no account-wide block', variant: 'notify' },
            ],
          },
        },
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// bot-scraper
// ---------------------------------------------------------------------------

const botScraperEntry = {
  workflowKey: 'bot-scraper',
  workflowFile: 'bot-scraper.workflow.json',
  title: 'Bot / Scraper — Graduated Mitigation (BotScore)',
  why:
    'The response keys on Cloudflare\'s ML BotScore verdict — never the User-Agent, which ' +
    'validated scraper hits trivially spoofed (Wrath-AIO, libwww-perl, PhantomJS). It is ' +
    'challenge-first by default (a reversible interstitial that real browsers pass and headless ' +
    'scrapers don\'t); the hard IP block is reserved for reputation-confirmed or high-volume ' +
    '(≥200 req/24h) offenders. ' + UNKNOWN_DEVICE,
  connections: [
    'Cloudflare',
    'SentinelOne (ApiToken)',
    'SentinelOne SDL (Bearer)',
    'VirusTotal API key',
    'Slack (#oneflare-soc)',
    'Platform SMTP',
  ],
  diagram: {
    blocks: [
      { kind: 'trigger', label: 'CF-Bot-Scraper (BotScore) — MED/HIGH/CRIT', detail: 'BotScore ≤ 29, ≥20 requests/src_ip → src_ip' },
      { kind: 'gate', label: 'Valid Source IP?', detail: 'src_ip != "no-ip"', elseLabel: 'dead-end (no-op)' },
      {
        kind: 'enrichment',
        nodes: [
          { label: 'Search Related Activity', detail: 'S1 SDL — related_events, distinct_hosts/paths, min_botscore' },
          { label: 'Check IP Reputation', detail: 'VirusTotal — malicious count + AS owner/ASN' },
        ],
      },
      {
        kind: 'decision',
        label: 'Malicious or High Volume',
        detail: 'vt_malicious ≥ 3  OR  related_events ≥ 200',
        converge: true,
        branches: {
          true: { label: 'block', nodes: [{ label: 'Response Mode = block', detail: 'cf_mode variable', variant: 'destructive' }] },
          false: { label: 'challenge', nodes: [{ label: 'Response Mode = managed_challenge', detail: 'cf_mode variable', variant: 'action' }] },
        },
      },
      {
        kind: 'action',
        nodes: [
          { label: 'Apply CF IP Access Rule', detail: 'mode = {{cf_mode}}, target = src_ip', variant: 'destructive' },
          { label: 'Add S1 Alert Note', detail: 'evidence summary, confidence = SUSPICIOUS', variant: 'note' },
        ],
      },
      {
        kind: 'notify',
        nodes: [
          { label: 'Notify SOC Slack', detail: '#oneflare-soc' },
          { label: 'Email SOC', detail: 'core SMTP' },
        ],
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// prompt-injection
// ---------------------------------------------------------------------------

const promptInjectionEntry = {
  workflowKey: 'prompt-injection',
  workflowFile: 'prompt-injection.workflow.json',
  title: 'LLM Prompt-Injection Response (Pyxis chat)',
  why:
    'This is the network/identity-level half of defense-in-depth: it blocks or challenges the ' +
    'offending src_ip on the /api/v1/chat route at the Cloudflare edge and records the ATLAS ' +
    'technique in the alert note — it does not inspect prompt content. A sustained campaign ' +
    '(≥5 chat POSTs/24h from one IP) or a VirusTotal-confirmed bad IP escalates to a hard block ' +
    'and TRUE_POSITIVE/HIGH; a clean one-off probe gets a managed challenge and stays ' +
    'SUSPICIOUS — pending confirmation. ' + UNKNOWN_DEVICE,
  connections: [
    'SentinelOne SDL (Bearer)',
    'SentinelOne (ApiToken)',
    'Cloudflare (Zone Firewall Services: Edit)',
    'Slack (#ai-security-soc)',
    'Send Email (platform mailer)',
    'VirusTotal API key',
  ],
  diagram: {
    blocks: [
      { kind: 'trigger', label: 'CF-AI-PromptInjection — HIGH/CRITICAL', detail: '≥5 chat POSTs/src_ip on /api/v1/chat → client_ip' },
      {
        kind: 'enrichment',
        nodes: [
          { label: 'S1 Related Chat Abuse Search', detail: 'SDL PowerQuery — 24h chat POSTs from this IP → related_chat_posts' },
          { label: 'VirusTotal IP Reputation', detail: 'vt_malicious' },
        ],
      },
      { kind: 'gate', label: 'IP Resolved?', detail: 'client_ip != "no-ip"', elseLabel: 'No-IP note (manual review, terminal)' },
      {
        kind: 'decision',
        label: 'Malicious or Sustained',
        detail: 'vt_malicious > 0  OR  related_chat_posts ≥ 5',
        converge: false,
        branches: {
          true: {
            label: 'block',
            nodes: [
              { label: 'CF Block — Chat Route', detail: 'WAF rule: path=/api/v1/chat AND ip.src=IP → block', variant: 'destructive' },
              { label: 'CF IP Access Block', detail: 'zone-wide', variant: 'destructive' },
              { label: 'Note Block (ATLAS)', detail: 'AML.T0054 / AML.T0057 + endpoint + correlation', variant: 'note' },
              { label: 'Raise Confidence', detail: 'TRUE_POSITIVE / HIGH', variant: 'note' },
              { label: 'Add IOC', detail: 'IPV4, ml-attack, risk 90', variant: 'note' },
              { label: 'Notify AI Safety SOC', detail: '#ai-security-soc', variant: 'notify' },
              { label: 'Send Email', detail: 'block receipt', variant: 'notify' },
            ],
          },
          false: {
            label: 'challenge',
            nodes: [
              { label: 'CF Challenge — Chat Route', detail: 'managed_challenge on /api/v1/chat', variant: 'action' },
              { label: 'Note Monitor (ATLAS)', detail: 'soft-containment rationale', variant: 'note' },
              { label: 'Set Suspicious', detail: 'SUSPICIOUS / MEDIUM — pending confirmation', variant: 'note' },
              { label: 'Notify AI Safety SOC', detail: '#ai-security-soc', variant: 'notify' },
            ],
          },
        },
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// dns-tunneling
// ---------------------------------------------------------------------------

const dnsTunnelingEntry = {
  workflowKey: 'dns-tunneling',
  workflowFile: 'dns-tunneling.workflow.json',
  title: 'DNS Tunneling / C2 Beaconing Response',
  why:
    'Containment blocks the registered base-domain (the "zone"), not the leftmost DGA labels, ' +
    'since fast-flux rotates those — the Gateway DNS policy blocks the whole zone plus a ' +
    'defense-in-depth source-IP zone block. The gate is domain reputation OR persistence: a ' +
    'VirusTotal-confirmed malicious domain contains immediately; an unrated-but-sustained tunnel ' +
    '(≥20 related beacons in 6h) also contains. Endpoint isolation only fires when device_uid is ' +
    'bound to a real asset — otherwise it no-ops safely. ' + UNKNOWN_DEVICE,
  connections: [
    'SentinelOne SDL (Bearer)',
    'SentinelOne (ApiToken)',
    'Cloudflare (Zero Trust Gateway + Zone Firewall: Edit)',
    'Slack (#oneflare-soc)',
    'Send Email (platform mailer)',
    'VirusTotal API key',
  ],
  diagram: {
    blocks: [
      { kind: 'trigger', label: 'CF-Gateway-DNSTunnel — HIGH/CRITICAL', detail: 'OCSF DNS Activity → src_ip, base_domain (zone), evidence, device_uid' },
      { kind: 'gate', label: 'Targets Present?', detail: 'base_domain AND src_ip resolved', elseLabel: 'dead-end (no fabricated block target)' },
      {
        kind: 'enrichment',
        nodes: [
          { label: 'Search Related DNS Beaconing', detail: 'S1 SDL — same src_ip beaconing over 6h → related_beacon_count' },
          { label: 'Domain Reputation VirusTotal', detail: 'VT domain report on base_domain' },
        ],
      },
      {
        kind: 'decision',
        label: 'Malicious Domain OR Sustained Beaconing',
        detail: 'VT malicious > 0   OR   related_beacon_count ≥ 20 / 6h',
        converge: false,
        branches: {
          true: {
            label: 'contain',
            nodes: [
              { label: 'Block C2 Domain at Gateway', detail: 'Zero Trust Gateway DNS policy — blocks the whole zone', variant: 'destructive' },
              { label: 'Block Source IP Zone Rule', detail: 'defense-in-depth', variant: 'destructive' },
              { label: 'Add S1 IOCs', detail: 'DNS (domain) + IPV4 (source), 7-day TTL', variant: 'note' },
              { label: 'Isolate Endpoint', detail: 'gated on device_uid bound to a real asset', variant: 'destructive' },
              { label: 'Add Confirmed Note + Raise Verdict', detail: 'SUSPICIOUS — never auto TRUE_POSITIVE', variant: 'note' },
              { label: 'Notify SOC Slack', detail: 'containment summary', variant: 'notify' },
              { label: 'Email SOC', detail: 'HTML containment receipt', variant: 'notify' },
            ],
          },
          false: {
            label: 'monitor',
            nodes: [
              { label: 'Add Monitor Note', detail: 'no block — evidence insufficient', variant: 'note' },
              { label: 'Notify SOC Slack', detail: 'monitor summary', variant: 'notify' },
              { label: 'Email SOC', detail: 'monitor receipt', variant: 'notify' },
            ],
          },
        },
      },
    ],
  },
}

export const HA_PLAYBOOKS = {
  sqli: webAttacksEntry('CF-WAF-SQLi — HIGH/CRITICAL', WEB_ATTACKS_WHY),
  xss: webAttacksEntry('CF-WAF-XSS — HIGH/CRITICAL', WEB_ATTACKS_WHY),
  traversal: webAttacksEntry('CF-WAF-Traversal — HIGH/CRITICAL', WEB_ATTACKS_WHY),
  cred: credStuffingEntry,
  exfil: dataExfilEntry,
  bot: botScraperEntry,
  promptinj: promptInjectionEntry,
  dns: dnsTunnelingEntry,
}
