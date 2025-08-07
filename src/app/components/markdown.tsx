import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { HTMLAttributes } from "react";

interface CodeProps extends HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function LessonMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none leading-relaxed space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: CodeProps) {
            if (inline) {
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
