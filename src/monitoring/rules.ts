/**
 * Request inspection rules. Pure and synchronous: precompiled expressions,
 * no I/O, so the proxy can run them on every request.
 */

export type Category =
  | "path_scan"
  | "sqli"
  | "xss"
  | "path_traversal"
  | "cmd_injection"
  | "bad_bot"
  | "honeypot"
  | "forbidden_method";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Detection {
  ruleId: string;
  category: Category;
  severity: Severity;
  score: number;
  /** Part of the request that matched, truncated and stripped of control characters. */
  excerpt: string;
}

export interface InspectedRequest {
  method: string;
  path: string;
  search: string;
  userAgent: string | null;
}

interface Rule {
  id: string;
  category: Category;
  severity: Severity;
  score: number;
  target: "path" | "query" | "url" | "ua" | "method";
  pattern: RegExp;
}

/** Trap paths: no legitimate visitor of this site ever requests them. */
const HONEYPOT = /^\/(?:wp-login\.php|xmlrpc\.php|\.env(?:\.[\w-]+)?|\.git\/(?:config|HEAD)|wp-config\.php(?:\.bak)?|admin\/config\.php|phpmyadmin\/?|backup\.(?:zip|sql|tar\.gz)|db\.sql|\.aws\/credentials|\.ssh\/id_rsa|acces-interne-sauvegarde)$/i;

const RULES: Rule[] = [
  { id: "honeypot.path", category: "honeypot", severity: "high", score: 20, target: "path", pattern: HONEYPOT },
  {
    id: "scan.known-paths",
    category: "path_scan",
    severity: "medium",
    score: 15,
    target: "path",
    pattern: /^\/(?:\.env(?:\.[\w-]+)?|wp-login\.php|xmlrpc\.php|wp-config\.php|wp-admin|wp-content|wp-includes|wordpress|phpmyadmin|pma|myadmin|mysql|vendor\/phpunit|cgi-bin|server-status|server-info|actuator|\.git|\.svn|\.hg|\.ds_store|\.vscode|\.idea|config\.json|composer\.(?:json|lock)|package-lock\.json|hnap1|boaform|owa|autodiscover|telescope|_profiler|solr|jenkins|manager\/html|console|webui|shell|setup\.php|install\.php)(?:\/|$)/i,
  },
  {
    id: "scan.script-extension",
    category: "path_scan",
    severity: "low",
    score: 10,
    target: "path",
    pattern: /\.(?:php\d?|phtml|asp|aspx|jsp|jspx|cgi|pl|env|ini|bak|old|swp|sql|log|cfg|conf)$/i,
  },
  {
    id: "traversal.dot-dot",
    category: "path_traversal",
    severity: "high",
    score: 40,
    target: "url",
    pattern: /(?:\.\.[/\\]|[/\\]\.\.(?:$|[/\\?])|%2e%2e(?:%2f|%5c|\/)|\.\.%(?:2f|5c)|%252e%252e)/i,
  },
  {
    id: "traversal.system-files",
    category: "path_traversal",
    severity: "high",
    score: 40,
    target: "url",
    pattern: /(?:\/etc\/(?:passwd|shadow|hosts)|\/proc\/self\/|win\.ini|boot\.ini|c:\\windows)/i,
  },
  {
    id: "sqli.union-select",
    category: "sqli",
    severity: "high",
    score: 40,
    target: "query",
    pattern: /\bunion\b[\s\S]{0,40}?\bselect\b|\bselect\b[\s\S]{0,60}?\bfrom\b[\s\S]{0,60}?\b(?:information_schema|pg_catalog|sysobjects|mysql\.user)\b/i,
  },
  {
    id: "sqli.tautology",
    category: "sqli",
    severity: "high",
    score: 40,
    target: "query",
    pattern: /['"`]\s*(?:or|and)\s+['"`]?\w+['"`]?\s*(?:=|like)\s*['"`]?\w+|\bor\s+1\s*=\s*1\b|['"`]\s*;\s*(?:drop|delete|insert|update|truncate)\s/i,
  },
  {
    id: "sqli.time-based",
    category: "sqli",
    severity: "high",
    score: 40,
    target: "query",
    pattern: /\b(?:sleep|pg_sleep|benchmark)\s*\(\s*\d|\bwaitfor\s+delay\b|\bxp_cmdshell\b|\bload_file\s*\(|\binto\s+(?:out|dump)file\b/i,
  },
  {
    id: "xss.script",
    category: "xss",
    severity: "high",
    score: 40,
    target: "url",
    pattern: /<\s*\/?\s*script\b|javascript\s*:|vbscript\s*:|<\s*(?:iframe|svg|img|body|object|embed)\b[^>]*\bon[a-z]+\s*=|\bon(?:error|load|mouseover|focus|toggle)\s*=\s*['"]?\s*[a-z]+\s*\(|document\.(?:cookie|domain)|\balert\s*\(/i,
  },
  {
    id: "cmd.shell",
    category: "cmd_injection",
    severity: "critical",
    score: 80,
    target: "url",
    pattern: /(?:;|\||&&|`|\$\()\s*(?:cat|ls|id|whoami|uname|wget|curl|nc|ncat|bash|sh|zsh|powershell|cmd(?:\.exe)?|python|perl|chmod|rm)\b|\$\{jndi:|\$\{(?:env|sys|lower|upper):|\bphpinfo\s*\(|\b(?:base64_decode|eval|system|passthru|shell_exec)\s*\(/i,
  },
  {
    id: "bot.scanner",
    category: "bad_bot",
    severity: "high",
    score: 40,
    target: "ua",
    pattern: /\b(?:sqlmap|nikto|nmap|masscan|zgrab|gobuster|dirbuster|dirb|wpscan|nuclei|acunetix|nessus|openvas|w3af|havij|fimap|feroxbuster|ffuf|wfuzz|jaeles|xray|commix|arachni|skipfish|netsparker|burp\s?collaborator|zmeu|morfeus)\b/i,
  },
  { id: "method.forbidden", category: "forbidden_method", severity: "medium", score: 20, target: "method", pattern: /^(?:TRACE|TRACK|CONNECT|DEBUG|PROPFIND|PROPPATCH|MKCOL|COPY|MOVE|LOCK|UNLOCK)$/ },
];

const SENSITIVE_PREFIXES = ["/admin", "/auth", "/api", "/espace-client", "/f/"];
const SCRIPTED_CLIENTS = /^(?:python-requests|python-urllib|go-http-client|curl|wget|java\/|okhttp|libwww-perl|httpclient|aiohttp|axios\/|node-fetch|scrapy)/i;
const KNOWN_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

/** URL decoding applied twice, so double encoded payloads are seen too. */
export function safeDecode(value: string): string {
  let result = value;
  for (let round = 0; round < 2; round += 1) {
    try {
      const decoded = decodeURIComponent(result.replace(/\+/g, " "));
      if (decoded === result) break;
      result = decoded;
    } catch {
      break;
    }
  }
  return result;
}

/** Keeps the matched part with some context, never more than 500 characters. */
export function excerptOf(source: string, match: RegExpExecArray | null): string {
  const start = Math.max(0, (match?.index ?? 0) - 40);
  const text = source.slice(start, start + 200);
  return text.replace(/[\u0000-\u001f\u007f]/gu, " ").slice(0, 500);
}

export function inspectRequest(request: InspectedRequest): Detection[] {
  const method = request.method.toUpperCase();
  const rawPath = request.path;
  const path = safeDecode(rawPath);
  const query = safeDecode(request.search.replace(/^\?/, ""));
  const targets: Record<Rule["target"], string> = {
    path,
    query,
    url: `${rawPath}${request.search} ${path} ${query}`,
    ua: request.userAgent ?? "",
    method,
  };
  const detections: Detection[] = [];
  const seen = new Set<Category>();
  for (const rule of RULES) {
    // A path scan already identified is not counted twice by the extension rule.
    if (rule.id === "scan.script-extension" && seen.has("path_scan")) continue;
    const source = targets[rule.target];
    if (!source) continue;
    const match = rule.pattern.exec(source);
    if (!match) continue;
    seen.add(rule.category);
    detections.push({ ruleId: rule.id, category: rule.category, severity: rule.severity, score: rule.score, excerpt: excerptOf(source, match) });
  }

  if (!KNOWN_METHODS.has(method) && !seen.has("forbidden_method")) {
    detections.push({ ruleId: "method.unknown", category: "forbidden_method", severity: "low", score: 10, excerpt: method.slice(0, 20) });
  }

  const sensitive = SENSITIVE_PREFIXES.some((prefix) => path.startsWith(prefix));
  const ua = (request.userAgent ?? "").trim();
  if (!ua && !seen.has("bad_bot")) {
    detections.push({ ruleId: "bot.empty-ua", category: "bad_bot", severity: sensitive ? "medium" : "low", score: sensitive ? 15 : 5, excerpt: "(user-agent vide)" });
  } else if (sensitive && SCRIPTED_CLIENTS.test(ua) && !seen.has("bad_bot")) {
    detections.push({ ruleId: "bot.scripted-sensitive", category: "bad_bot", severity: "low", score: 10, excerpt: ua.slice(0, 120) });
  }
  return detections;
}

/** Hidden trap link added to public pages (rel nofollow, excluded in robots.txt). */
export const TRAP_PATH = "/acces-interne-sauvegarde";

// "bot" is matched as a suffix too (Googlebot, bingbot, AhrefsBot).
const BOTS = /(?:bot\b|bot\/|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|embedly|quora link preview|lighthouse|pagespeed|headlesschrome|uptime|monitor|pingdom|statuscake|python-requests|curl\/|wget\/)/i;

/** Known crawlers and previewers, ignored by the audience statistics. */
export function isKnownBot(userAgent: string | null): boolean {
  return !userAgent || BOTS.test(userAgent);
}
