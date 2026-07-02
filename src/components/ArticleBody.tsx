import { markdownToHtml, sanitizeArticleHtml } from "@/lib/document-import";

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function ArticleBody({ content }: { content: string }) {
  return (
    <div
      className="article-body"
      dangerouslySetInnerHTML={{
        __html: looksLikeHtml(content)
          ? sanitizeArticleHtml(content)
          : markdownToHtml(content),
      }}
    />
  );
}
