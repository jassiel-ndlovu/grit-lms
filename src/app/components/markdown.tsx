import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { HTMLAttributes } from "react";
import 'katex/dist/katex.min.css';

interface CodeProps extends HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function LessonMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Headers
          h1: ({ ...props }) => <h1 className="text-xl font-bold mt-8 mb-4" {...props} />,
          h2: ({ ...props }) => <h2 className="text-lg font-bold mt-6 mb-3" {...props} />,
          h3: ({ ...props }) => <h3 className="text-lg font-medium mt-4 mb-2" {...props} />,

          // Paragraphs
          strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
          
          // Lists
          ul: ({ ...props }) => <ul className="list-disc pl-5 my-4" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal pl-5 my-4" {...props} />,
          li: ({ ...props }) => <li className="my-2" {...props} />,
          
          // Code blocks
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
                  className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
                <code className="text-sm" {...props}>
                  {children}
                </code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}