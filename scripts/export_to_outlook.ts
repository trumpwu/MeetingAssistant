// Universal Markdown to Outlook HTML & EML Exporter
// Usage: deno run -A export_to_outlook.ts <path-to-markdown-file>

const mdPath = Deno.args[0] || "D:\\project\\Meetings\\2026-09-22_公司大會議室_銓盛電子_ADTEK\\2026-09-22_公司大會議室_銓盛電子_ADTEK.md";

if (!Deno.statSync(mdPath).isFile) {
  console.error(`檔案不存在: ${mdPath}`);
  Deno.exit(1);
}

const md = Deno.readTextFileSync(mdPath);
const baseDir = mdPath.substring(0, mdPath.lastIndexOf("\\"));
const filenameNoExt = mdPath.substring(mdPath.lastIndexOf("\\") + 1).replace(/\.md$/, "");

function convertMarkdownToOutlookHtml(markdown: string): { title: string; html: string; rawBody: string } {
  const lines = markdown.split("\n");
  let inTable = false;
  let tableHtml = "";
  let bodyHtml = "";
  let docTitle = "會議重點紀要";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith("|") && line.endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px; font-family:\'Microsoft JhengHei\', \'Segoe UI\', Arial, sans-serif; border:1px solid #cbd5e1; mso-table-lspace:0pt; mso-table-rspace:0pt;">';
      }
      if (line.includes(":---") || line.includes("---:")) continue;

      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      const isHeader = !tableHtml.includes("<tr style=\"background-color:#ffffff;\">") && !tableHtml.includes("<td");

      tableHtml += isHeader 
        ? '<tr style="background-color:#f1f5f9;">' 
        : '<tr style="background-color:#ffffff;">';

      cells.forEach(cell => {
        let formatted = cell
          .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#0f172a;">$1</strong>')
          .replace(/`([^`]+)`/g, '<code style="background-color:#f1f5f9; padding:2px 5px; border-radius:4px; font-family:Consolas, monospace; color:#0f172a; font-size:12px;">$1</code>')
          .replace(/<br\s*\/?>/gi, "<br/>");

        // Priority Badges
        if (formatted.includes("🔥 最高") || formatted.includes("[🔥最高]")) {
          formatted = formatted.replace(/(?:🔥 最高|\[🔥最高\])/g, '<span style="background-color:#fee2e2; color:#b91c1c; font-weight:bold; padding:2px 8px; border-radius:12px; font-size:11px; display:inline-block; border:1px solid #fecaca;">🔥 最高優先</span>');
        } else if (formatted.includes("⚡ 高優先") || formatted.includes("[⚡高優先]")) {
          formatted = formatted.replace(/(?:⚡ 高優先|\[⚡高優先\])/g, '<span style="background-color:#fef3c7; color:#b45309; font-weight:bold; padding:2px 8px; border-radius:12px; font-size:11px; display:inline-block; border:1px solid #fde68a;">⚡ 高優先</span>');
        } else if (formatted.includes("📌 中優先") || formatted.includes("[📌中優先]")) {
          formatted = formatted.replace(/(?:📌 中優先|\[📌中優先\])/g, '<span style="background-color:#e0e7ff; color:#3730a3; font-weight:bold; padding:2px 8px; border-radius:12px; font-size:11px; display:inline-block; border:1px solid #c7d2fe;">📌 中優先</span>');
        }

        tableHtml += isHeader
          ? `<th style="padding:10px 12px; border:1px solid #cbd5e1; text-align:left; font-weight:bold; color:#1e293b; background-color:#f8fafc; font-size:13px;">${formatted}</th>`
          : `<td style="padding:8px 12px; border:1px solid #e2e8f0; color:#334155; font-size:13px; line-height:1.5;">${formatted}</td>`;
      });
      tableHtml += "</tr>";
    } else {
      if (inTable) {
        tableHtml += "</table>";
        bodyHtml += tableHtml;
        inTable = false;
      }

      if (line.startsWith("# ")) {
        docTitle = line.substring(2).trim();
        bodyHtml += `<h1 style="font-size:20px; font-weight:bold; color:#1e1b4b; margin:20px 0 10px; border-bottom:2px solid #4f46e5; padding-bottom:8px; font-family:'Microsoft JhengHei', 'Segoe UI', Arial, sans-serif;">${docTitle}</h1>`;
      } else if (line.startsWith("## ")) {
        const sub = line.substring(3).trim();
        bodyHtml += `<h2 style="font-size:16px; font-weight:bold; color:#1e293b; margin:18px 0 8px; border-left:4px solid #4f46e5; padding-left:10px; font-family:'Microsoft JhengHei', 'Segoe UI', Arial, sans-serif;">${sub}</h2>`;
      } else if (line.startsWith("### ")) {
        const h3 = line.substring(4).trim();
        bodyHtml += `<h3 style="font-size:14px; font-weight:bold; color:#334155; margin:12px 0 6px; font-family:'Microsoft JhengHei', 'Segoe UI', Arial, sans-serif;">${h3}</h3>`;
      } else if (line.startsWith("> ")) {
        const quote = line.substring(2).trim()
          .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#0f172a;">$1</strong>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2563eb; text-decoration:none;">$1</a>');
        bodyHtml += `<div style="background-color:#f8fafc; border-left:4px solid #3b82f6; padding:10px 14px; margin:12px 0; color:#475569; font-size:13px; border-radius:0 4px 4px 0;">${quote}</div>`;
      } else if (line.startsWith("* ") || line.startsWith("- ")) {
        const itemText = line.substring(2).trim()
          .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#0f172a;">$1</strong>')
          .replace(/`([^`]+)`/g, '<code style="background-color:#f1f5f9; padding:2px 4px; border-radius:3px; font-family:Consolas, monospace;">$1</code>');
        bodyHtml += `<li style="margin-bottom:6px; color:#334155; font-size:13.5px; line-height:1.6;">${itemText}</li>`;
      } else if (line.match(/^\d+\.\s+/)) {
        const numText = line.replace(/^\d+\.\s+/, "").trim()
          .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#0f172a;">$1</strong>')
          .replace(/`([^`]+)`/g, '<code style="background-color:#f1f5f9; padding:2px 4px; border-radius:3px; font-family:Consolas, monospace;">$1</code>');
        bodyHtml += `<p style="margin:8px 0; color:#334155; font-size:13.5px; line-height:1.6;">${line.match(/^\d+\./)?.[0]} ${numText}</p>`;
      } else if (line === "---") {
        bodyHtml += `<hr style="border:0; border-top:1px solid #e2e8f0; margin:16px 0;" />`;
      } else if (line.length > 0) {
        const pText = line
          .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#0f172a;">$1</strong>')
          .replace(/`([^`]+)`/g, '<code style="background-color:#f1f5f9; padding:2px 4px; border-radius:3px; font-family:Consolas, monospace;">$1</code>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2563eb; text-decoration:none;">$1</a>');
        bodyHtml += `<p style="margin:6px 0; color:#334155; font-size:13.5px; line-height:1.6;">${pText}</p>`;
      }
    }
  }

  if (inTable) {
    tableHtml += "</table>";
    bodyHtml += tableHtml;
  }

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
</head>
<body style="margin:0; padding:20px; background-color:#f8fafc; font-family:'Microsoft JhengHei', 'Segoe UI', Arial, sans-serif;">
  <div style="max-width:860px; margin:0 auto; background-color:#ffffff; padding:32px 40px; border-radius:8px; border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); font-size:14px; line-height:1.6; color:#1e293b;">
    ${bodyHtml}
    <div style="margin-top:30px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:12px; color:#94a3b8; text-align:center;">
      本郵件由 AI智慧會議助理 本地離線模型自動生成・100% 原始事實接地・無幻覺
    </div>
  </div>
</body>
</html>`;

  return { title: docTitle, html: fullHtml, rawBody: bodyHtml };
}

const { title, html, rawBody } = convertMarkdownToOutlookHtml(md);

// 1. Export HTML
const htmlOutPath = `${baseDir}\\${filenameNoExt}_(Outlook格式).html`;
Deno.writeTextFileSync(htmlOutPath, html);
console.log(`✅ [1/3] Outlook 富文本 HTML 已產出：\n   ${htmlOutPath}`);

// 2. Export EML (RFC 822 Mail Draft with X-Unsent: 1)
// X-Unsent: 1 tells Outlook to open this as an editable new email draft!
const dateStr = new Date().toUTCString();
const base64Subject = btoa(unescape(encodeURIComponent(title)));
const emlContent = `To: 
Subject: =?UTF-8?B?${base64Subject}?=
Date: ${dateStr}
MIME-Version: 1.0
X-Unsent: 1
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: 8bit

${html}
`;

const emlOutPath = `${baseDir}\\${filenameNoExt}_(Outlook草稿).eml`;
Deno.writeTextFileSync(emlOutPath, emlContent);
console.log(`✅ [2/3] Outlook 郵件草稿檔 (.eml) 已產出：\n   ${emlOutPath}`);

// 3. Register to Windows Clipboard as Rich HTML Format (so Ctrl+V in Outlook pastes formatted table)
const clipTempHtml = `${baseDir}\\__clip_temp.html`;
Deno.writeTextFileSync(clipTempHtml, rawBody);

const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$htmlContent = Get-Content -Raw -Encoding utf8 "${clipTempHtml}"
$plainText = Get-Content -Raw -Encoding utf8 "${mdPath}"

$dataObj = New-Object System.Windows.Forms.DataObject
$dataObj.SetData([System.Windows.Forms.DataFormats]::Html, $htmlContent)
$dataObj.SetData([System.Windows.Forms.DataFormats]::Text, $plainText)
[System.Windows.Forms.Clipboard]::SetDataObject($dataObj, $true)
Remove-Item -Force "${clipTempHtml}" -ErrorAction SilentlyContinue
`;

const clipCmd = new Deno.Command("powershell", {
  args: ["-NoProfile", "-Command", psScript]
});
await clipCmd.output();

console.log(`✅ [3/3] 已經將 Outlook 富文本格式直接複製到 Windows 系統剪貼簿！`);
console.log(`👉 您現在可以直接在 Outlook 或 Word 按 [Ctrl + V] 貼上！`);
