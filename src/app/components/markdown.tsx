import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { HTMLAttributes } from "react";
import "katex/dist/katex.min.css";

interface CodeProps extends HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface LessonMarkdownProps {
  content?: string; // initial value
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

export default function LessonMarkdown({
  content = "",
  onChange,
  readOnly = true,
}: LessonMarkdownProps) {
  const [value, setValue] = useState(content);

  useEffect(() => {
    setValue(content);
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue);
  };

  return (
    <div className="overflow-y-auto prose prose-sm max-w-none leading-relaxed break-words">
      {readOnly ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            h1: ({ ...props }) => (
              <h1 className="text-xl font-bold mt-8 mb-4" {...props} />
            ),
            h2: ({ ...props }) => (
              <h2 className="text-lg font-bold mt-6 mb-3" {...props} />
            ),
            h3: ({ ...props }) => (
              <h3 className="text-lg font-medium mt-4 mb-2" {...props} />
            ),
            strong: ({ ...props }) => (
              <strong className="font-semibold" {...props} />
            ),
            ul: ({ ...props }) => (
              <ul className="list-disc pl-5 my-4" {...props} />
            ),
            ol: ({ ...props }) => (
              <ol className="list-decimal pl-5 my-4" {...props} />
            ),
            li: ({ ...props }) => <li className="my-2" {...props} />,
            a: ({ ...props }) => (
              <a
                className="text-blue-600 hover:text-blue-800 hover:underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            ),
            table: ({ ...props }) => (
              <div className="overflow-x-auto my-6">
                <table
                  className="min-w-full border-collapse border border-gray-300"
                  {...props}
                />
              </div>
            ),
            thead: ({ ...props }) => (
              <thead className="bg-gray-100" {...props} />
            ),
            tbody: ({ ...props }) => <tbody {...props} />,
            tr: ({ ...props }) => (
              <tr className="border-b border-gray-200" {...props} />
            ),
            th: ({ ...props }) => (
              <th
                className="border border-gray-300 px-4 py-2 font-semibold text-left"
                {...props}
              />
            ),
            td: ({ ...props }) => (
              <td className="border border-gray-300 px-4 py-2" {...props} />
            ),
            code({ inline, className, children, ...props }: CodeProps) {
              if (inline) {
                if (/\$.+\$/.test(String(children))) {
                  return (
                    <span {...props} className={className}>
                      {children}
                    </span>
                  );
                }
                return (
                  <code
                    className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm break-words whitespace-pre-wrap"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <span className="block bg-gray-100 p-4 rounded-lg overflow-x-auto max-w-full">
                  <code className="text-sm" {...props}>
                    {children}
                  </code>
                </span>
              );
            },
          }}
        >
          {value}
        </ReactMarkdown>
      ) : (
        <textarea
          value={value}
          onChange={handleChange}
          className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring focus:ring-blue-300"
        />
      )}
    </div>
  );
}
