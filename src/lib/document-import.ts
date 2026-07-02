import { marked } from "marked";
import mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";

const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
  "img",
  "h1",
  "h2",
  "h3",
  "h4",
  "pre",
  "code",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);

const allowedAttributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: ["href", "name", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  code: ["class"],
};

export function sanitizeArticleHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto", "tel", "data"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  });
}

export function markdownToHtml(markdown: string) {
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  return sanitizeArticleHtml(marked.parse(markdown, { async: false }) as string);
}

export async function docxToHtml(buffer: Buffer) {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
      ],
    },
  );

  return sanitizeArticleHtml(result.value);
}

export async function docxToMarkdown(buffer: Buffer) {
  const mammothWithMarkdown = mammoth as typeof mammoth & {
    convertToMarkdown: typeof mammoth.convertToHtml;
  };

  const result = await mammothWithMarkdown.convertToMarkdown(
    { buffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
      ],
    },
  );

  return result.value.trim();
}
