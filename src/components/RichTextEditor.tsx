"use client";

import { useEffect, useId, useRef, useState } from "react";

type RichTextEditorProps = {
  name: string;
  initialValue?: string;
  label?: string;
};

const sizeMap: Record<string, string> = {
  "2": "14px",
  "3": "16px",
  "4": "20px",
  "5": "26px",
  "6": "34px",
};

function runCommand(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function RichTextEditor({
  name,
  initialValue = "",
  label = "正文",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const [status, setStatus] = useState("");
  const [fileName, setFileName] = useState("");

  const sync = () => {
    if (hiddenRef.current && editorRef.current) {
      hiddenRef.current.value = editorRef.current.innerHTML;
    }
  };

  const normalizeFonts = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll("font[size]").forEach((node) => {
      const font = node as HTMLElement;
      const size = font.getAttribute("size") ?? "3";
      font.removeAttribute("size");
      font.style.fontSize = sizeMap[size] ?? "16px";
    });
  };

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = initialValue;
    sync();
  }, [initialValue]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    runCommand(command, value);
    normalizeFonts();
    sync();
  };

  const addLink = () => {
    const href = window.prompt("输入链接地址");
    if (href) exec("createLink", href);
  };

  const addImage = () => {
    const src = window.prompt("输入图片地址");
    if (src) exec("insertImage", src);
  };

  const importDocument = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setStatus("正在导入...");
    const data = new FormData();
    data.append("file", file);

    const response = await fetch("/api/import-document", {
      method: "POST",
      body: data,
    });

    const result = (await response.json()) as { html?: string; error?: string };
    if (!response.ok || !result.html) {
      setStatus(result.error || "导入失败");
      return;
    }

    if (editorRef.current) {
      editorRef.current.innerHTML = result.html;
      sync();
    }
    setStatus("已导入，可以继续编辑");
  };

  return (
    <div className="word-editor-field">
      <div className="editor-label">{label}</div>
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={initialValue} />
      <div className="editor-import rich-import">
        <input
          ref={fileRef}
          id={fileInputId}
          className="sr-only"
          type="file"
          accept=".docx,.md,.markdown"
          onChange={(event) => {
            setFileName(event.target.files?.[0]?.name ?? "");
            setStatus("");
          }}
        />
        <label className="button secondary file-trigger" htmlFor={fileInputId}>
          选择文件
        </label>
        <button className="button secondary" type="button" onClick={importDocument}>
          导入 Word/Markdown
        </button>
        <span className="file-name">{fileName || "支持 .docx / .md / .markdown"}</span>
        {status ? <span className="editor-status">{status}</span> : null}
      </div>

      <div className="word-toolbar" aria-label="文章编辑工具栏">
        <div className="toolbar-group">
          <select aria-label="段落样式" defaultValue="P" onChange={(event) => exec("formatBlock", event.target.value)}>
            <option value="P">正文</option>
            <option value="H1">一级标题</option>
            <option value="H2">二级标题</option>
            <option value="H3">三级标题</option>
            <option value="BLOCKQUOTE">引用</option>
          </select>
          <select aria-label="字号" defaultValue="3" onChange={(event) => exec("fontSize", event.target.value)}>
            <option value="2">小字</option>
            <option value="3">标准</option>
            <option value="4">大字</option>
            <option value="5">强调</option>
            <option value="6">标题字</option>
          </select>
        </div>

        <div className="toolbar-group">
          <button type="button" title="加粗" onClick={() => exec("bold")}>B</button>
          <button type="button" title="斜体" onClick={() => exec("italic")}>I</button>
          <button type="button" title="下划线" onClick={() => exec("underline")}>U</button>
          <button type="button" title="删除线" onClick={() => exec("strikeThrough")}>S</button>
        </div>

        <div className="toolbar-group color-tools">
          <label title="文字颜色">
            文字
            <input type="color" defaultValue="#18201d" onChange={(event) => exec("foreColor", event.target.value)} />
          </label>
          <label title="背景颜色">
            背景
            <input type="color" defaultValue="#fff4b8" onChange={(event) => exec("hiliteColor", event.target.value)} />
          </label>
        </div>

        <div className="toolbar-group">
          <button type="button" title="左对齐" onClick={() => exec("justifyLeft")}>左</button>
          <button type="button" title="居中" onClick={() => exec("justifyCenter")}>中</button>
          <button type="button" title="右对齐" onClick={() => exec("justifyRight")}>右</button>
          <button type="button" title="两端对齐" onClick={() => exec("justifyFull")}>齐</button>
        </div>

        <div className="toolbar-group">
          <button type="button" title="无序列表" onClick={() => exec("insertUnorderedList")}>列表</button>
          <button type="button" title="编号列表" onClick={() => exec("insertOrderedList")}>编号</button>
          <button type="button" title="减少缩进" onClick={() => exec("outdent")}>减少缩进</button>
          <button type="button" title="增加缩进" onClick={() => exec("indent")}>增加缩进</button>
        </div>

        <div className="toolbar-group">
          <button type="button" title="插入链接" onClick={addLink}>链接</button>
          <button type="button" title="插入图片" onClick={addImage}>图片</button>
          <button type="button" title="水平线" onClick={() => exec("insertHorizontalRule")}>分割线</button>
        </div>

        <div className="toolbar-group">
          <button type="button" title="撤销" onClick={() => exec("undo")}>撤销</button>
          <button type="button" title="重做" onClick={() => exec("redo")}>重做</button>
          <button type="button" title="清除格式" onClick={() => exec("removeFormat")}>清除格式</button>
        </div>
      </div>

      <div
        ref={editorRef}
        className="rich-editor word-editor"
        contentEditable
        onInput={sync}
        onBlur={sync}
        suppressContentEditableWarning
      />
    </div>
  );
}
